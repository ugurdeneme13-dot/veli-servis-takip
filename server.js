const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 'public' klasöründeki HTML dosyalarını dışarıya aç
app.use(express.static(path.join(__dirname, 'public')));

// Aktif servislerin son konumlarını hafızada tut
const aktifServisler = {};

io.on('connection', (socket) => {
    console.log('Yeni bağlantı:', socket.id);

    // Şoförden konum verisi geldiğinde
    socket.on('konumGonder', (veri) => {
        // veri: { servisKodu: '34ABC123', lat: 40.96, lng: 29.26, durum: 'Yolda' }
        aktifServisler[veri.servisKodu] = {
            lat: veri.lat,
            lng: veri.lng,
            durum: veri.durum,
            sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
        };

        // Sadece ilgili servis kodunu takip eden velilere konumu ilet
        io.to(veri.servisKodu).emit('konumGuncellendi', aktifServisler[veri.servisKodu]);
    });

    // Veli belirli bir servisi takip etmek istediğinde
    socket.on('serviseAboneOl', (servisKodu) => {
        socket.join(servisKodu);
        console.log(`Veli ${socket.id}, ${servisKodu} servisini takibe başladı.`);
        
        // Eğer servisin halihazırda bir konumu varsa veliye hemen gönder
        if (aktifServisler[servisKodu]) {
            socket.emit('konumGuncellendi', aktifServisler[servisKodu]);
        }
    });

    socket.on('disconnect', () => {
        console.log('Bağlantı koptu:', socket.id);
    });
});

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor:`);
    console.log(`Şoför Ekranı: http://localhost:${PORT}/sofor.html`);
    console.log(`Veli Ekranı:  http://localhost:${PORT}/veli.html`);
});
