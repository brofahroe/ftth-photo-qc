# FTTH Photo QC — Aplikasi Dokumentasi Foto Proyek (PWA)

Aplikasi web progresif (**Offline-First PWA**) untuk memudahkan pengambilan foto di lapangan serta penyusunan laporan PDF dokumentasi proyek FTTH. Watermark timestamp & geolokasi bersifat opsional dan nonaktif secara default:

- **FOTO CW** (halaman `Implementasi` 10 kotak, `FDT` 6 kotak, & `FAT` 6 kotak dalam satu dokumen)
- **FOTO CW SF** (Implementasi 10 kotak, FDT 6 kotak, & Pole SF 4 kotak sesuai contoh)
- **FOTO EL** (`Input Splitter` 4 kotak, `Output Splitter` 8 kotak, & `OPM FAT` 8 kotak untuk 1310nm & 1550nm)
- Halaman `Implementasi` berisi 10 kotak tahapan `Digging Pole`, `Instal Pole`, `Pulling Cable`, `Instal Accessories`, dan `Concrete Pole` (Grid 2x5), menjadi halaman pertama dokumen FOTO CW.

---

## Cara Menjalankan di Laptop / PC (Lokal)

1. Buka terminal di folder proyek ini, lalu jalankan:
   ```bash
   npm run dev
   ```
2. Buka alamat `http://localhost:5173` di browser (Chrome / Edge).

---

## Cara Pakai di HP saat di Lapangan (Gratis dengan HTTPS & Offline Mode)

Browser HP mewajibkan koneksi **HTTPS** untuk mengizinkan akses **Kamera** dan **GPS**. Karena seluruh data foto disimpan 100% lokal di memori perangkat Anda (**IndexedDB**) tanpa server database, Anda bisa memasang aplikasi ini secara **gratis selamanya** melalui salah satu cara berikut:

### Opsi 1: Cloudflare Pages / Netlify Drop (Paling Cepat — Tanpa Coding, 1 Menit)
1. Jalankan perintah build di Laptop:
   ```bash
   npm run build
   ```
2. Akan muncul folder `dist/`.
3. Buka **Cloudflare Pages** atau **app.netlify.com/drop**, lalu tarik (*drag & drop*) folder `dist/` ke halaman tersebut.
4. Anda langsung mendapatkan link `https://...` yang bisa dibuka di HP, di-**Install ke Layar Utama HP (Add to Home Screen)**, dan tetap berjalan **Offline** meskipun sinyal hilang di lapangan!

### Opsi 2: Vercel / GitHub Pages (Oomatis dari Git)
- Push proyek ini ke repository GitHub Anda:
  - Hubungkan ke **Vercel** (`vercel.json` sudah tersedia), **atau**
  - Aktifkan menu **Settings -> Pages -> Source: GitHub Actions** (`.github/workflows/deploy-pages.yml` sudah tersedia).

---

## Mode Kolaborasi Multi-User & Sinkronisasi Nextcloud

Aplikasi ini mendukung kolaborasi langsung di lapangan antar beberapa teknisi yang mengerjakan task yang sama secara bersamaan:

- **Database Metadata**: SQLite lokal server (`data/photoqc.db`) dengan mode WAL untuk performa tulis tinggi.
- **Realtime Presence & Soft Lock**: Menggunakan **Socket.io** agar saat Teknisi A membuka slot kamera tertentu, slot tersebut otomatis ditandai `Sedang difoto oleh [Nama]` di layar teknisi lain sehingga tidak bertabrakan.
- **Penyimpanan Nextcloud Otomatis**: Foto dan laporan PDF otomatis diunggah ke Nextcloud via WebDAV secara asinkron di latar belakang.
- **Offline-First Resilience**: Saat koneksi 4G di lapangan terputus, pengambilan foto tetap berjalan mulus menggunakan IndexedDB lokal HP dan akan otomatis disinkronkan ke server & Nextcloud begitu sinyal kembali.

### Cara Menjalankan Server Kolaborasi:

1. Salin `.env.example` menjadi `.env` lalu sesuaikan konfigurasi Nextcloud Anda:
   ```env
   PORT=3001
   CORS_ORIGIN=*

   # Konfigurasi Nextcloud WebDAV
   NEXTCLOUD_URL=https://cloud.perusahaan.com
   NEXTCLOUD_USERNAME=admin
   NEXTCLOUD_PASSWORD=app_token_atau_password_anda
   NEXTCLOUD_BASE_DIR=/PhotoQC
   ```

2. Jalankan server:
   ```bash
   npm run server
   ```
   Server akan berjalan di `http://localhost:3001` (sekaligus menyajikan frontend dan WebSocket).

3. Untuk development frontend mandiri dengan Vite:
   ```bash
   npm run dev
   ```
   Vite akan otomatis mem-proxy request `/api` dan `/socket.io` ke server backend di port 3001.

### Deploy frontend di Vercel dan backend terpisah

`vercel.json` hanya men-deploy frontend statis. Backend Photo QC (Express, SQLite, upload file, Socket.IO, dan worker Nextcloud) harus dijalankan pada host Node.js terpisah dengan penyimpanan persisten.

1. Deploy repository di host Node.js dan jalankan `npm run server`. Pastikan host menyediakan penyimpanan persisten untuk folder `data/` dan `uploads/`.
2. Atur `NEXTCLOUD_URL`, `NEXTCLOUD_USERNAME`, dan `NEXTCLOUD_PASSWORD` pada environment backend tersebut, lalu restart/redeploy backend.
3. Di Vercel, atur `VITE_API_URL` ke URL publik backend, misalnya `https://photo-qc-api.example.com` (tanpa `/` di akhir), untuk environment Production.
4. Redeploy frontend Vercel agar `VITE_API_URL` masuk ke build. Jangan gunakan prefix `VITE_` untuk kredensial Nextcloud karena variabel `VITE_*` tersedia di browser.
5. Buka aplikasi dan pilih **Nextcloud** → **Tes Koneksi WebDAV**.

---

## Fitur Utama
1. **Mode Kamera Beruntun di HP**: Sekali buka kamera langsung memandu jepret urut dari Kotak #1 sampai selesai beserta indikator akurasi GPS live.
2. **Watermark Non-Destruktif**: Watermark otomatis untuk kamera dan upload nonaktif secara default dan dapat diaktifkan manual. Tersedia pembaca EXIF serta fitur edit manual jam, koordinat, dan alamat untuk 1 foto maupun seluruh foto se-halaman.
3. **Upload Massal & Auto-Buat Halaman**: Tarik puluhan foto sekaligus untuk otomatis dipecah menjadi halaman-halaman baru sesuai template.
4. **3 Pilihan Kualitas PDF**: *Ringan*, *Standar Jernih* (angka layar OPM tajam saat di-zoom), dan *Kualitas Tinggi*.
5. **Backup & Pindah Perangkat (`.photoqc.zip`)**: Ekspor dan impor paket proyek utuh antara HP dan Laptop tanpa butuh akun cloud.
