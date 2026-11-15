const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Hafızada aktif servis konumları ve detaylı öğrenci kayıtları
const aktifServisler = {};
// Yapı: { "34S1001": [ { id, siraNo, ogrenciAd, veliAd, veliTel1, veliTel2, adres, lat, lng, plaka, durum }, ... ] }
const servisOgrencileri = {};

io.on('connection', (socket) => {
    // 1. Şoför konum gönderdiğinde
    socket.on('konumGonder', (veri) => {
        aktifServisler[veri.servisKodu] = {
            lat: veri.lat,
            lng: veri.lng,
            durum: veri.durum,
            sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
        };
        io.to(veri.servisKodu).emit('konumGuncellendi', aktifServisler[veri.servisKodu]);
    });

    // 2. Yönetim panelinden veya şoförden öğrenci listesi güncellendiğinde
    socket.on('ogrenciDurumGuncelle', (veri) => {
        const kod = veri.servisKodu.toUpperCase();
        servisOgrencileri[kod] = veri.ogrenciler;

        // İlgili plakaya bağlı şoför ve veli ekranlarına güncel listeyi aktar
        io.to(kod).emit('ogrenciBildirimi', {
            ogrenciler: veri.ogrenciler,
            mesaj: veri.bildirimMesaji || null,
            ogrenciAdi: veri.ogrenciAdi || null,
            durum: veri.durum || null,
            saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });
        
        // Şoför panelinin açık olduğu odaya doğrudan liste güncellemesi gönder
        io.to(kod).emit('mevcutOgrenciListesi', veri.ogrenciler);
    });

    // 3. Yönetim paneli tüm kayıtları istediğinde
    socket.on('yonetimTumunuGetir', () => {
        socket.emit('yonetimVeriListesi', servisOgrencileri);
    });

    // 4. Şoför bağlandığında kendi plakasının listesini al
    socket.on('soforListeyiGetir', (servisKodu) => {
        const kod = servisKodu.toUpperCase();
        socket.join(kod);
        if (servisOgrencileri[kod]) {
            socket.emit('mevcutOgrenciListesi', servisOgrencileri[kod]);
        }
    });

    // 5. Veli belirli bir servisi takibe başladığında
    socket.on('serviseAboneOl', (servisKodu) => {
        const kod = servisKodu.toUpperCase();
        socket.join(kod);
        if (aktifServisler[kod]) {
            socket.emit('konumGuncellendi', aktifServisler[kod]);
        }
        if (servisOgrencileri[kod]) {
            socket.emit('mevcutOgrenciListesi', servisOgrencileri[kod]);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});
