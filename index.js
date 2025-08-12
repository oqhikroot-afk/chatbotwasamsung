  // --- BAGIAN KODE WEB SERVER EXPRESS ---
  const express = require('express');
  const app = express();
  const port = process.env.PORT || 3000;

  app.get('/', (req, res) => {
    res.send('<h1>Server Bot Aktif. Silakan cek konsol untuk QR code.</h1>');
  });

  app.listen(port, () => {
    console.log(`Server Express berjalan di port ${port}`);
  });

  // --- BAGIAN KODE UNTUK BOT BAILEYS ---
  const qrcode = require('qrcode-terminal');
  const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
  } = require('@whiskeysockets/baileys');
  const { Boom } = require('@hapi/boom');
  const pino = require('pino');

  // [DIKOREKSI] ID admin dan testing dengan format Baileys
  const ADMIN_ID = '6282322001646@s.whatsapp.net';
  const TEST_NUMBER = '6282232767185@s.whatsapp.net';

  const roomAvailability = {
    nonAC: 0,
    AC: 0
  };
  let savedContacts = new Set();

  async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: Browsers.macOS('Desktop'),
      logger: pino({ level: 'silent' }),
      version,
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log("QR Code diterima, silakan scan.");
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Koneksi terputus:', lastDisconnect.error, '| Mencoba menghubungkan kembali:', shouldReconnect);
        if (shouldReconnect) {
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('Bot WhatsApp berhasil terhubung!');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('contacts.set', ({ contacts }) => {
      console.log('Mengambil daftar kontak...');
      contacts.forEach(contact => {
        if (!contact.id.endsWith('@g.us') && contact.id) {
          savedContacts.add(contact.id);
        }
      });
      console.log(`Berhasil mengambil ${savedContacts.size} kontak.`);
    });

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) {
        return;
      }

      const sender = msg.key.remoteJid;
      const messageBody = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      console.log('\n--- PESAN MASUK ---');
      console.log('Pengirim:', sender);
      console.log('Isi Pesan:', messageBody);

      if (sender.endsWith('@g.us')) {
        console.log('Pesan dari grup, diabaikan.');
        return;
      }

      if (sender !== TEST_NUMBER && savedContacts.has(sender)) {
        console.log('Pesan dari kontak tersimpan, diabaikan.');
        return;
      }

      console.log('Bot akan memproses pesan ini...');
      const body = messageBody.toLowerCase();

      if (body.includes('ketersediaan') || body.includes('kosong')) {
        if (roomAvailability.nonAC === 0 && roomAvailability.AC === 0) {
          await sock.sendMessage(sender, { text: 'Mohon maaf, saat ini semua kamar sudah terisi penuh. Kami akan segera menghubungi admin untuk Anda. Mohon tunggu sebentar ya.' });
          const notifikasiAdmin = `*NOTIFIKASI CHAT DARI BOT*\n\nAda pengguna (${sender}) yang menanyakan ketersediaan kamar, dan saat ini semua kamar sudah penuh. Silakan tindak lanjuti jika diperlukan.`;
          await sock.sendMessage(ADMIN_ID, { text: notifikasiAdmin });
        } else {
          let response = 'Saat ini, ketersediaan kamar kami:\n';
          if (roomAvailability.nonAC > 0) {
            response += `- Kamar non-AC: ${roomAvailability.nonAC} unit kosong.\n`;
          }
          if (roomAvailability.AC > 0) {
            response += `- Kamar AC: ${roomAvailability.AC} unit kosong.\n`;
          }
          await sock.sendMessage(sender, { text: response });
        }
      } else if (body.includes('selamat')) {
        await sock.sendMessage(sender, { text: 'Terima kasih, selamat datang di kos Griya Ida! Apakah Anda ingin tahu tentang fasilitas, harga, atau lokasi/alamat? Ketik salah satu untuk informasi lebih lanjut.'});
      } else if (body.includes('kos') || body.includes('kost') || body.includes('griya ida')) {
        await sock.sendMessage(sender, { text: 'Selamat datang di Kos Griya Ida! Kos kami menyediakan kamar dengan fasilitas lengkap dan harga terjangkau. Apakah Anda ingin tahu tentang fasilitas, harga, atau lokasi/alamat? Ketik salah satu untuk informasi lebih lanjut' });
      } else if (body.includes('fasilitas')) {
        await sock.sendMessage(sender, { text: 'Fasilitas di Kos Griya Ida: Kamar mandi dalam, AC, Wi-Fi gratis, lemari, meja belajar, dapur umum, listrik token tiap kamar, free air, tempat jemur pakaian dan area parkir. Kami juga memiliki CCTV untuk keamanan.Peraturan :Teman laki2 dilarang masuk pagar bangunan. Jika ada teman menginap maks 1 hari dgn ijin terlebih dahulu, jika lebih akan dikenakan biaya per hari 50rb. Ibu boleh menginap free sd 1 minggu' });
      } else if (body.includes('harga') || body.includes('biaya')) {
        await sock.sendMessage(sender, { text: 'Harga sewa kos kami mulai dari Rp 850.000/bulan untuk kamar non AC. Sedangkan Kamar menggunakan AC Rp 1.100.000/bulan. Harga sudah termasuk air. Listrik menggunakan token tiap kamar. Minimal booking per 6 (enam) bulan. Untuk detail harga kamar tertentu, silakan datang untuk survei.' });
      } else if (body.includes('lokasi') || body.includes('alamat')) {
        await sock.sendMessage(sender, { text: 'Lokasi kami sangat strategis di dekat kampus UNDIP sekitar 500 mtr dari Bundaran Tugu Undip. Kakak bisa mencari "Kos Griya Ida" di Google Maps. Atau, alamat lengkap kami ada di Jl. Tirtasari I No.8, Tembalang, Kec. Tembalang, Kota Semarang, Jawa Tengah 50275.' });
      } else if (body.includes('chat dengan admin') || body.includes('hubungi admin')) {
        await sock.sendMessage(sender, { text: 'Permintaan kakak sudah kami teruskan ke admin. Mohon tunggu sebentar, admin akan segera membalas pesan Kakak.' });
        const notifikasiAdmin = `*NOTIFIKASI CHAT DARI BOT*\n\nAda pengguna yang meminta bantuan admin. Pesan terakhir dari pengguna:\n\n"${messageBody}"\n\nUntuk membalasnya, silakan balas chat ini.`;
        await sock.sendMessage(ADMIN_ID, { text: notifikasiAdmin });
      } else {
        await sock.sendMessage(sender, { text: 'Mohon maaf, saya belum mengerti. Silakan tanyakan tentang harga, fasilitas, atau lokasi. Jika butuh bantuan, ketik "chat dengan admin".' });
      }
    });
  }

  connectToWhatsApp();