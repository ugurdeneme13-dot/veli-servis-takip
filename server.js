const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Kalıcı veri dosyası yolu
const VERI_DOSYASI = path.join(__dirname, 'veriler.json');

// Kayıtları diskten yükle
function verileriYukle() {
    try {
        if (fs.existsSync(VERI_DOSYASI)) {
            const icerik = fs.readFileSync(VERI_DOSYASI, 'utf8');
            return JSON.parse(icerik);
        }
    } catch (err) {
        console.error('Veri dosyası okuma hatası:', err);
    }
    return { tumKayitlar: [], servisOgrencileri: {} };
}

// Kayıtları diske yaz
function verileriKaydet() {
    try {
        fs.writeFileSync(VERI_DOSYASI, JSON.stringify({
            tumKayitlar,
            servisOgrencileri
        }, null, 2), 'utf8');
    } catch (err) {
        console.error('Veri dosyası yazma hatası:', err);
    }
}

let kayitliVeri = verileriYukle();
let tumKayitlar = kayitliVeri.tumKayitlar || [];
let servisOgrencileri = kayitliVeri.servisOgrencileri || {};
const aktifServisler = {};

// Plaka bazlı gruplamayı yeniden oluştur
function plakaGruplariniGuncelle() {
    const yeniGruplar = {};
    tumKayitlar.forEach(k => {
        const plaka = k.plaka.toUpperCase().replace(/\s+/g, '');
        if (!yeniGruplar[plaka]) yeniGruplar[plaka] = [];
        
        // Mevcut biniş/iniş durumunu koru
        const eskiKayit = (servisOgrencileri[plaka] || []).find(o => o.id === k.id);
        yeniGruplar[plaka].push({
            id: k.id,
            siraNo: k.siraNo,
            ad: `${k.siraNo}. ${k.ogrenciAd}`,
            ogrenciAd: k.ogrenciAd,
            veliAd: k.veliAd,
            veliTel1: k.veliTel1,
            veliTel2: k.veliTel2,
            adres: k.adres,
            lat: k.lat,
            lng: k.lng,
            durum: eskiKayit ? eskiKayit.durum : (k.durum || "Bekliyor")
        });
    });
    servisOgrencileri = yeniGruplar;
}

io.on('connection', (socket) => {
    // 1. Şoför canlı konum gönderdiğinde
    socket.on('konumGonder', (veri) => {
        const kod = veri.servisKodu.toUpperCase();
        aktifServisler[kod] = {
            lat: veri.lat,
            lng: veri.lng,
            durum: veri.durum,
            sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
        };
        io.to(kod).emit('konumGuncellendi', aktifServisler[kod]);
    });

    // 2. Yönetim panelinden öğrenci/konum kaydedildiğinde veya silindiğinde
    socket.on('yonetimKayitGuncelle', (guncelListe) => {
        tumKayitlar = guncelListe;
        plakaGruplariniGuncelle();
        verileriKaydet();

        // Tüm yönetim panellerine güncel listeyi gönder
        io.emit('yonetimVeriListesi', tumKayitlar);

        // İlgili şoför ve veli odalarına güncel listeyi dağıt
        Object.keys(servisOgrencileri).forEach(plaka => {
            io.to(plaka).emit('mevcutOgrenciListesi', servisOgrencileri[plaka]);
        });
    });

    // 3. Yönetim paneli açıldığında kayıtlı tüm verileri gönder
    socket.on('yonetimTumunuGetir', () => {
        socket.emit('yonetimVeriListesi', tumKayitlar);
    });

    // 4. Şoför öğrenci durumunu (Bindi/İndi/Gelmedi) güncellediğinde
    socket.on('ogrenciDurumGuncelle', (veri) => {
        const kod = veri.servisKodu.toUpperCase();
        servisOgrencileri[kod] = veri.ogrenciler;

        // Ana listedeki durumu da güncelle ve diske kaydet
        veri.ogrenciler.forEach(guncelOgr => {
            const idx = tumKayitlar.findIndex(t => t.id === guncelOgr.id);
            if (idx !== -1) tumKayitlar[idx].durum = guncelOgr.durum;
        });
        verileriKaydet();

        io.to(kod).emit('ogrenciBildirimi', {
            ogrenciler: veri.ogrenciler,
            mesaj: veri.bildirimMesaji || null,
            ogrenciAdi: veri.ogrenciAdi || null,
            durum: veri.durum || null,
            saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });
        io.to(kod).emit('mevcutOgrenciListesi', veri.ogrenciler);
    });

    // 5. Şoför bağlandığında kendi plakasının listesini ve ev konumlarını al
    socket.on('soforListeyiGetir', (servisKodu) => {
        const kod = servisKodu.toUpperCase();
        socket.join(kod);
        if (servisOgrencileri[kod]) {
            socket.emit('mevcutOgrenciListesi', servisOgrencileri[kod]);
        }
    });

    // 6. Veli belirli bir servisi takibe başladığında
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
