const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Hafızada aktif servis konumları ve öğrenci listeleri
const aktifServisler = {};
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

    // 2. Şoför öğrenci listesini veya öğrenci durumunu (Bindi/İndi) güncellediğinde
    socket.on('ogrenciDurumGuncelle', (veri) => {
        // veri: { servisKodu, ogrenciler, bildirimMesaji, ogrenciAdi, durum }
        servisOgrencileri[veri.servisKodu] = veri.ogrenciler;

        // Tüm velilere güncel listeyi ve anlık bildirimi gönder
        io.to(veri.servisKodu).emit('ogrenciBildirimi', {
            ogrenciler: veri.ogrenciler,
            mesaj: veri.bildirimMesaji,
            ogrenciAdi: veri.ogrenciAdi,
            durum: veri.durum,
            saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });
    });

    // 3. Şoför bağlandığında mevcut listeyi geri yükle
    socket.on('soforListeyiGetir', (servisKodu) => {
        socket.join(servisKodu);
        if (servisOgrencileri[servisKodu]) {
            socket.emit('mevcutOgrenciListesi', servisOgrencileri[servisKodu]);
        }
    });

    // 4. Veli belirli bir servisi takibe başladığında
    socket.on('serviseAboneOl', (servisKodu) => {
        socket.join(servisKodu);
        if (aktifServisler[servisKodu]) {
            socket.emit('konumGuncellendi', aktifServisler[servisKodu]);
        }
        if (servisOgrencileri[servisKodu]) {
            socket.emit('mevcutOgrenciListesi', servisOgrencileri[servisKodu]);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});
