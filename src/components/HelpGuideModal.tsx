import React, { useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  FileDown,
  FolderUp,
  HelpCircle,
  Layers,
  MapPin,
  Smartphone,
  Sparkles,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';

interface HelpGuideModalProps {
  onClose: () => void;
  initialTab?: HelpTabId;
}

export type HelpTabId =
  | 'QUICKSTART'
  | 'TEMPLATES'
  | 'CAMERA_WM'
  | 'EDITOR_PDF'
  | 'OFFLINE_ZIP'
  | 'FAQ';

const HELP_TABS: { id: HelpTabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'QUICKSTART',
    label: 'Mulai Cepat',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'TEMPLATES',
    label: 'Jenis Dokumen',
    icon: <Layers className="w-4 h-4" />,
  },
  {
    id: 'CAMERA_WM',
    label: 'Kamera & Watermark',
    icon: <Camera className="w-4 h-4" />,
  },
  {
    id: 'EDITOR_PDF',
    label: 'Kelola Foto & PDF',
    icon: <FileDown className="w-4 h-4" />,
  },
  {
    id: 'OFFLINE_ZIP',
    label: 'Install HP & Backup ZIP',
    icon: <Smartphone className="w-4 h-4" />,
  },
  {
    id: 'FAQ',
    label: 'Tanya Jawab (FAQ)',
    icon: <HelpCircle className="w-4 h-4" />,
  },
];

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({
  onClose,
  initialTab = 'QUICKSTART',
}) => {
  const [activeTab, setActiveTab] = useState<HelpTabId>(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600/90 border border-blue-400/30 flex items-center justify-center shadow-md shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Panduan Penggunaan FTTH Photo QC
              </h2>
              <p className="text-xs text-slate-300">
                Petunjuk lengkap pengambilan foto lapangan, watermark GPS, & cetak laporan PDF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-slate-200 hover:bg-white/20 transition"
            title="Tutup Panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {HELP_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shrink-0 transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-slate-700">
          {activeTab === 'QUICKSTART' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-blue-950 leading-relaxed">
                  <strong>FTTH Photo QC</strong> dirancang agar tim lapangan maupun tim QC dapat
                  menyusun dokumentasi foto proyek dengan cepat, rapi, dan sesuai standar tabel
                  laporan tanpa perlu menyusun manual satu per satu di Excel/Word.
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  3 Langkah Mudah Membuat Laporan Dokumentasi
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl bg-blue-600 text-white text-xs font-extrabold">
                        1
                      </span>
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                        Persiapan
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">Buat Dokumen Baru</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Klik tombol <strong>Buat Dokumen Baru</strong>, pilih kategori laporan (
                      <strong>FOTO CW</strong>, <strong>FOTO EL</strong>, atau{' '}
                      <strong>IMPLEMENTASI</strong>), lalu isi data <em>Region</em>,{' '}
                      <em>OLT Name</em>, <em>Cluster Name</em>, dan <em>Cluster ID</em>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl bg-blue-600 text-white text-xs font-extrabold">
                        2
                      </span>
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                        Pengambilan Foto
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Potret Kamera / Upload Foto
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Di lapangan, gunakan tombol <strong>Kamera Beruntun</strong> untuk memotret
                      urut dari Kotak #1 sampai selesai lengkap dengan watermark waktu & GPS. Di PC,
                      gunakan <strong>Upload Sekaligus</strong> atau <strong>Massal</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">
                        3
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                        Hasil Akhir
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Export PDF atau Kirim .ZIP
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Klik <strong>Export PDF</strong> dan pilih kualitas gambar yang diinginkan
                      untuk mengunduh laporan PDF A4 siap kirim, atau klik{' '}
                      <strong>Backup .ZIP</strong> untuk memindahkan proyek dari HP ke Laptop.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dual Workflow Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <Smartphone className="w-4 h-4" />
                    <span>Cara Kerja di HP (Saat di Lapangan)</span>
                  </div>
                  <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      Buka aplikasi di browser Chrome/Safari (pastikan izin Kamera & Lokasi aktif).
                    </li>
                    <li>
                      Pilih halaman FDT/FAT yang sedang dikerjakan, lalu tekan{' '}
                      <strong>Kamera Beruntun</strong>.
                    </li>
                    <li>
                      Setiap jepretan langsung masuk ke kotak yang sesuai dan otomatis berpindah ke
                      kotak berikutnya.
                    </li>
                    <li>
                      Selesai di lapangan, Anda bisa langsung <strong>Export PDF</strong> di HP atau{' '}
                      <strong>Backup .ZIP</strong> untuk dikirim ke admin di kantor.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-100 border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 text-xs font-bold">
                    <FolderUp className="w-4 h-4" />
                    <span>Cara Kerja di Laptop / PC (Admin QC)</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      Jika foto dari tim lapangan sudah punya watermark bawaan,{' '}
                      <strong>matikan</strong> centang <em>"Pasang Watermark saat Upload"</em>.
                    </li>
                    <li>
                      Gunakan tombol <strong>Massal</strong> di panel daftar halaman untuk menarik
                      puluhan foto sekaligus dan memecahnya otomatis menjadi halaman-halaman baru.
                    </li>
                    <li>
                      Tukar posisi foto yang tertukar dengan tombol <strong>Tukar (⇄)</strong> atau
                      tarik (<em>drag & drop</em>) antar kotak.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TEMPLATES' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Standar Jenis Dokumen & Susunan Halaman
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap jenis dokumen sudah dilengkapi template halaman dan label keterangan kotak
                  otomatis sesuai format laporan QC FTTH.
                </p>
              </div>

              <div className="space-y-4">
                {/* CW */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      FOTO CW (Civil Work)
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      6 Foto per Halaman (Grid 2 Kolom × 3 Baris)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">1. Template Halaman FDT</div>
                      <p className="text-slate-600 leading-relaxed">
                        Berisi 6 kotak standar: FDT Tampak Depan (Tertutup), FDT Tampak Depan
                        (Terbuka), Pondasi FDT, Terminasi FDT, Koneksi Grounding FDT, dan Hasil
                        Pengukuran Grounding FDT.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">2. Template Halaman FAT</div>
                      <p className="text-slate-600 leading-relaxed">
                        Berisi 6 kotak standar: FAT Tampak Depan (Tertutup), FAT Tampak Depan
                        (Terbuka), Instalasi Pole/Clamp FAT, Terminasi FAT, Koneksi Splitter FAT,
                        dan Labeling FAT.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CW SF */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-extrabold text-indigo-800">FOTO CW SF</strong>
                    <span className="text-xs font-bold text-slate-600">Implementasi, FDT, dan Pole SF</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Mengikuti contoh <code>FOTO CW SF.pdf</code>: halaman Implementasi (10 kotak),
                    FDT (6 kotak), dan Pole SF ext (4 kotak). Halaman FDT dan Pole SF dapat
                    ditambahkan lagi dari menu Tambah Halaman.
                  </p>
                </div>

                {/* EL */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      FOTO EL (Electrical / Redaman OPM)
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      4 atau 8 Foto per Halaman
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">Input Splitter FDT (4 Kotak)</div>
                      <p className="text-slate-600 leading-relaxed">
                        Grid 2×2 khusus foto pengukuran redaman Input Splitter untuk panjang
                        gelombang 1310nm & 1550nm.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">Output Splitter FDT (8 Kotak)</div>
                      <p className="text-slate-600 leading-relaxed">
                        Grid 2×4 untuk dokumentasi hasil ukur redaman port Output 1 sampai dengan
                        Output 8 pada Splitter FDT.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">OPM FAT (8 Kotak)</div>
                      <p className="text-slate-600 leading-relaxed">
                        Grid 2×4 untuk dokumentasi hasil ukur OPM pada titik FAT (lambda 1310nm &
                        1550nm).
                      </p>
                    </div>
                  </div>
                </div>

                {/* IMPLE */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      FOTO IMPLEMENTASI
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      10 Foto per Halaman (Grid 2 Kolom × 5 Baris)
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Setiap halaman memuat 10 kotak yang terbagi menjadi 5 tahapan pekerjaan (masing-masing 2 foto kiri-kanan):{' '}
                    <strong>Digging Pole</strong>, <strong>Instal Pole</strong>,{' '}
                    <strong>Pulling Cable</strong>, <strong>Instal Accessories</strong>, dan{' '}
                    <strong>Concrete Pole</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CAMERA_WM' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Panduan Kamera Lapangan, GPS & Watermark
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cara mengambil foto dengan timestamp & koordinat otomatis maupun mengedit watermark
                  secara manual.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs sm:text-sm">
                    <Camera className="w-4 h-4" />
                    <span>Mode Kamera Beruntun (Guided Camera)</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      Tekan tombol biru <strong>Kamera Beruntun</strong> di atas halaman untuk
                      mulai memotret dari kotak kosong pertama, atau tekan tombol{' '}
                      <strong>Kamera</strong> pada salah satu kotak.
                    </li>
                    <li>
                      Di bagian atas layar kamera akan tampil <strong>Nomor Kotak</strong> dan{' '}
                      <strong>Instruksi Foto</strong> yang harus diambil saat itu.
                    </li>
                    <li>
                      Begitu tombol jepret ditekan, foto disimpan dan kamera otomatis mengarahkan
                      Anda ke kotak kosong berikutnya tanpa perlu keluar-masuk kamera.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs sm:text-sm">
                    <Compass className="w-4 h-4" />
                    <span>Indikator Akurasi GPS & Alamat</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>GPS Akurat (Hijau)</strong>: Koordinat satelit sudah mengunci dengan
                      akurasi tinggi dan siap dicetak ke watermark foto.
                    </li>
                    <li>
                      <strong>Mencari GPS (Kuning)</strong>: Tunggu beberapa detik di area terbuka
                      hingga koordinat muncul, atau tekan tombol penyegar GPS.
                    </li>
                    <li>
                      Jika internet tersedia, aplikasi otomatis mengambil nama{' '}
                      <strong>Kelurahan/Desa, Kecamatan, Kabupaten, dan Provinsi</strong> dari
                      koordinat GPS.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs sm:text-sm">
                    <Upload className="w-4 h-4" />
                    <span>Saklar "Pasang Watermark saat Upload"</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Terletak di sebelah kanan tombol Upload pada halaman dokumen:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Tidak Dicentang (Mati)</strong>: Gunakan jika foto yang Anda upload
                      dari galeri HP <em>sudah memiliki teks timestamp bawaan</em> agar tidak
                      tertumpuk dua watermark.
                    </li>
                    <li>
                      <strong>Dicentang (Aktif)</strong>: Gunakan jika foto yang di-upload masih
                      polos; aplikasi akan membaca jam & koordinat dari data EXIF foto secara
                      otomatis.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-600 font-bold text-xs sm:text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>Edit Watermark Manual & Se-Halaman</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      Klik ikon <strong>lokasi/pin (Edit Watermark)</strong> pada kartu foto untuk
                      mengaktifkan/mematikan watermark atau mengubah Tanggal, Jam, Koordinat
                      Lat/Lon, serta baris alamat.
                    </li>
                    <li>
                      Gunakan tombol <strong>Terapkan ke Semua Foto Halaman Ini</strong> jika Anda
                      ingin menyamakan lokasi/alamat untuk seluruh foto pada 1 titik FDT/FAT
                      sekaligus.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'EDITOR_PDF' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Mengelola Halaman, Menyusun Foto & Cetak PDF
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tips mempercepat penyusunan puluhan halaman FDT/FAT dan memilih kualitas ekspor
                  PDF.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
                    <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                    <span>Tukar Posisi Foto (Swap) & Putar Foto</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Salah menempatkan foto di Kotak #2 padahal seharusnya di Kotak #5? Tidak perlu
                    menghapus foto:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Di HP / Laptop</strong>: Klik tombol <strong>Tukar (⇄)</strong> pada
                      foto pertama, lalu klik tombol <strong>Tukar ke Sini</strong> pada kotak
                      tujuan.
                    </li>
                    <li>
                      <strong>Di Laptop</strong>: Anda juga bisa langsung menarik (
                      <em>drag & drop</em>) kartu foto ke kotak lain.
                    </li>
                    <li>
                      Klik tombol <strong>Putar (⟳)</strong> jika orientasi foto miring/terbalik,
                      dan klik teks keterangan di bawah foto jika ingin mengubah labelnya.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
                    <FolderUp className="w-4 h-4 text-indigo-600" />
                    <span>Upload Massal & Tambah Banyak Halaman</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Tombol "+ Halaman"</strong>: Anda bisa membuat banyak halaman FAT
                      sekaligus dengan mengetik daftar kode FAT (1 baris 1 kode, misal{' '}
                      <code>FAT S01-A01</code>, <code>FAT S01-A02</code>, dst).
                    </li>
                    <li>
                      <strong>Tombol "Massal"</strong>: Pilih puluhan foto sekaligus dari komputer.
                      Aplikasi akan mengisi halaman secara berurutan dan otomatis membuat halaman
                      baru jika kotak sudah penuh.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <span>Ganti Logo Vendor & Nama Proyek</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Klik tombol <strong>Logo & Proyek</strong> di bagian atas untuk mengganti:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Judul Proyek</strong> pada kop atas tabel PDF.
                    </li>
                    <li>
                      <strong>Logo Kiri & Logo Kanan</strong> (secara bawaan terisi logo ZTE &
                      Moratelindo, dapat diganti dengan gambar PNG/JPG perusahaan Anda atau
                      disembunyikan).
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-emerald-900">
                    <FileDown className="w-4 h-4 text-emerald-600" />
                    <span>3 Pilihan Kualitas Export PDF</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Ringan (Cepat Kirim WA)</strong>: Ukuran file PDF paling hemat untuk
                      pratinjau cepat.
                    </li>
                    <li>
                      <strong>Standar — Jernih (Rekomendasi)</strong>: Seimbang antara ukuran file
                      dan ketajaman; angka desimal pada layar OPM dan teks label kabel tetap terbaca
                      jelas saat di-zoom.
                    </li>
                    <li>
                      <strong>Kualitas Tinggi (Cetak / Arsip)</strong>: Resolusi maksimal untuk
                      dokumen serah terima akhir (BAST/ATP).
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'OFFLINE_ZIP' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Mode Offline di Lapangan & Pindah Perangkat (.ZIP)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aplikasi ini menggunakan teknologi Offline-First PWA & penyimpanan lokal
                  IndexedDB.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    <span>Cara Install Aplikasi ke Layar Utama HP</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Agar aplikasi bisa dibuka seperti aplikasi HP biasa tanpa mengetik alamat web
                    dan tetap berjalan saat tidak ada sinyal:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      <strong>Android (Chrome)</strong>: Klik tombol kuning{' '}
                      <strong>Install di HP</strong> di pojok kanan atas, atau buka menu titik tiga
                      Chrome lalu pilih <strong>Tambahkan ke Layar Utama / Install Aplikasi</strong>
                      .
                    </li>
                    <li>
                      <strong>iPhone (Safari)</strong>: Tekan tombol <strong>Share (Bagikan)</strong>{' '}
                      di bagian bawah Safari, lalu pilih{' '}
                      <strong>Add to Home Screen (Tambah ke Layar Utama)</strong>.
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
                    <WifiOff className="w-4 h-4 text-emerald-600" />
                    <span>100% Aman Tanpa Sinyal Internet</span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li>
                      Seluruh dokumen dan foto tersimpan langsung di memori dalam perangkat Anda (
                      <strong>IndexedDB</strong>), sehingga tidak akan hilang meskipun halaman
                      di-refresh atau HP dimatikan.
                    </li>
                    <li>
                      Saat di titik blank-spot (tanpa sinyal seluler), indikator atas akan berubah
                      menjadi <strong>Mode Offline Aktif</strong> dan Anda tetap bisa memotret serta
                      mencetak PDF seperti biasa.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 text-white p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
                  <Archive className="w-4 h-4" />
                  <span>Cara Memindahkan Proyek dari HP ke Laptop (Fitur Backup .ZIP)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Karena aplikasi ini tidak menggunakan server cloud berbayar, data di HP tidak
                  otomatis muncul di Laptop. Untuk melanjutkan pekerjaan HP di Laptop:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <div className="font-bold text-white mb-1">1. Ekspor di HP</div>
                    <p className="text-slate-300">
                      Buka dokumen di HP, lalu tekan tombol <strong>Backup .ZIP</strong> (ikon
                      kotak arsip) untuk mengunduh file <code>.photoqc.zip</code>.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <div className="font-bold text-white mb-1">2. Kirim File</div>
                    <p className="text-slate-300">
                      Kirim file <code>.photoqc.zip</code> tersebut ke Laptop melalui WhatsApp Web,
                      Telegram, Google Drive, atau kabel data.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <div className="font-bold text-white mb-1">3. Impor di Laptop</div>
                    <p className="text-slate-300">
                      Buka aplikasi di Laptop, klik tombol <strong>Impor .ZIP</strong> di halaman
                      utama, lalu pilih file tersebut. Seluruh halaman & foto langsung terbuka utuh!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'FAQ' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Pertanyaan yang Sering Diajukan (FAQ)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solusi cepat jika mengalami kendala saat menggunakan aplikasi di HP atau Laptop.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: 'Mengapa kamera atau lokasi GPS tidak bisa dibuka di HP?',
                    a: 'Pastikan Anda membuka aplikasi melalui alamat dengan protokol aman HTTPS (misalnya link GitHub Pages / Vercel) dan bukan file lokal atau HTTP biasa. Selain itu, cek pengaturan izin situs (Site Settings) di pojok kiri alamat browser Chrome/Safari dan pastikan izin Kamera (Camera) serta Lokasi (Location) berstatus "Izinkan / Allow".',
                  },
                  {
                    q: 'Foto yang saya upload sudah ada tulisan waktu/koordinat dari aplikasi kamera HP, bagaimana agar tidak tertimpa watermark dobel?',
                    a: 'Sebelum meng-upload foto, pastikan kotak centang "Pasang Watermark saat Upload" di sebelah kanan tombol Upload dalam keadaan TIDAK DICENTANG. Jika sudah terlanjur ter-upload, Anda juga bisa klik ikon Pin/Lokasi pada foto tersebut lalu matikan saklar "Tampilkan Watermark pada Foto Ini".',
                  },
                  {
                    q: 'Bagaimana jika saat memotret di lapangan sinyal internet mati sehingga nama Desa/Kecamatan tidak muncul otomatis?',
                    a: 'Koordinat GPS (Latitude & Longitude) tetap terekam dari satelit meskipun tanpa internet. Untuk nama jalan/desa/kecamatan, Anda bisa mengetiknya secara manual di menu Edit Watermark dan menekan "Terapkan ke Semua Foto Halaman Ini" agar seluruh foto pada FDT/FAT tersebut langsung memiliki alamat lengkap.',
                  },
                  {
                    q: 'Bagaimana cara menyalin data Region, OLT, dan Cluster ID agar tidak perlu mengetik ulang untuk dokumen berikutnya?',
                    a: 'Pada daftar dokumen di halaman utama, klik tombol ikon Salin (Copy) pada dokumen yang sudah ada untuk menduplikasi kerangka dokumen beserta data Region/OLT/Cluster-nya, atau pilih opsi "Salin dari dokumen sebelumnya" saat membuat dokumen baru.',
                  },
                  {
                    q: 'Apakah data saya akan hilang jika saya membersihkan riwayat browser (Clear Cache / Clear Site Data)?',
                    a: 'Ya, karena seluruh foto disimpan di database lokal browser (IndexedDB), menghapus "Data Situs / Site Data" pada browser akan menghapus proyek yang tersimpan di perangkat tersebut. Biasakan mengunduh PDF atau menyimpan "Backup .ZIP" untuk proyek penting.',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5"
                  >
                    <div className="flex items-start gap-2 font-bold text-xs sm:text-sm text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{item.q}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pl-6">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500">
            FTTH Photo QC v1.0 • Dokumentasi Proyek CW, EL (OPM), & Implementasi
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
