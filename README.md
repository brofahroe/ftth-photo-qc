# FTTH Photo QC — Aplikasi Dokumentasi Foto Proyek (PWA)

Aplikasi web progresif (**Offline-First PWA**) untuk memudahkan pengambilan foto di lapangan (kamera HP + watermark timestamp & geolokasi otomatis) serta penyusunan laporan PDF dokumentasi proyek FTTH:

- **FOTO CW** (`FDT` 6 kotak & `FAT` 6 kotak — Grid 2x3)
- **FOTO EL** (`Input Splitter` 4 kotak, `Output Splitter` 8 kotak, & `OPM FAT` 8 kotak untuk 1310nm & 1550nm)
- **FOTO IMPLEMENTASI** (10 kotak tahapan `Digging Pole`, `Instal Pole`, `Pulling Cable`, `Instal Accessories`, `Concrete Pole` — Grid 2x5)

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

## Fitur Utama
1. **Mode Kamera Beruntun di HP**: Sekali buka kamera langsung memandu jepret urut dari Kotak #1 sampai selesai beserta indikator akurasi GPS live.
2. **Watermark Non-Destruktif**: Saklar on/off pasang watermark saat upload (agar foto yang sudah ber-watermark tidak tertimpa dobel), pembaca EXIF otomatis, serta fitur edit manual jam, koordinat, dan alamat untuk 1 foto maupun seluruh foto se-halaman.
3. **Upload Massal & Auto-Buat Halaman**: Tarik puluhan foto sekaligus untuk otomatis dipecah menjadi halaman-halaman baru sesuai template.
4. **3 Pilihan Kualitas PDF**: *Ringan*, *Standar Jernih* (angka layar OPM tajam saat di-zoom), dan *Kualitas Tinggi*.
5. **Backup & Pindah Perangkat (`.photoqc.zip`)**: Ekspor dan impor paket proyek utuh antara HP dan Laptop tanpa butuh akun cloud.
