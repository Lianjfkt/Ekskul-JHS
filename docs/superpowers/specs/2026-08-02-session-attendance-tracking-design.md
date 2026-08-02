# Design Spec: Sesi dan Absensi Filling Tracking (Pelacakan Pengisian Sesi & Absensi)

**Tanggal**: 2026-08-02  
**Topik**: Pelacakan pengisian sesi pertemuan dan absensi siswa per ekstrakurikuler oleh Pelatih.

---

## Deskripsi Fitur
Fitur ini bertujuan untuk membantu admin dalam memantau keaktifan administrasi para pelatih ekstrakurikuler dalam rentang tanggal tertentu (mingguan/kustom). Admin dapat mengetahui ekskul mana yang belum membuat sesi pertemuan, atau sudah membuat sesi namun belum melakukan absensi siswa. Fitur ini mempermudah admin dalam menyusun laporan mingguan dan mengirimkan pengingat ke WhatsApp Group pelatih.

## Perubahan yang Diusulkan

### 1. Penambahan Tab Baru di `RecapManagement.jsx`
*   Menambahkan tab `'fillTracking'` dengan label `"Tracking Pengisian"`.
*   Menambahkan pilihan rentang tanggal (*Start Date* & *End Date*) khusus untuk tab ini. Secara default, rentang tanggal akan diatur dari hari Senin minggu ini hingga hari Minggu minggu ini (atau hari ini).

### 2. Logika Pemrosesan Data
Setiap ekstrakurikuler aktif (`extracurriculars` dengan status `is_active` = `true`) akan dianalisis status pengisiannya pada rentang tanggal terpilih:
1.  **Dapatkan Sesi Terkait**: Filter data `sessions` yang memiliki `extracurricular_id` sama dan `session_date` berada di antara `startDate` dan `endDate`.
2.  **Periksa Kehadiran**: Untuk setiap sesi di periode tersebut, periksa apakah ada data absensi di tabel `attendances` (dengan mencocokkan `session_id`).
3.  **Tentukan Status Ekskul**:
    *   **Belum Membuat Sesi (Red)**: Jika jumlah sesi di periode tersebut = 0.
    *   **Absensi Belum Diisi (Yellow)**: Jika ada sesi yang dibuat di rentang tanggal tersebut, tetapi ada minimal 1 sesi yang belum memiliki data absensi siswa sama sekali.
    *   **Lengkap (Green)**: Jika ada minimal 1 sesi dan seluruh sesi di rentang tersebut sudah terisi absensinya.

### 3. Ekspor & Broadcast Teks (Salin ke Clipboard)
*   **Tombol "Salin Laporan WA (Semua)"**: Mengompilasi daftar ekskul yang belum membuat sesi atau belum mengisi absensi ke dalam format pesan teks WhatsApp yang siap disalin dan ditempel di grup pelatih.
*   **Tombol "Salin Teks Pengingat (Individu)"**: Pada setiap baris ekskul bermasalah di tabel, admin dapat mengeklik tombol ini untuk menyalin pesan khusus yang ditujukan langsung ke pelatih ekskul tersebut.
*   **Ekspor Excel**: Menambahkan opsi ekspor data status pelacakan pengisian ini ke file Excel (`rekap_tracking_pengisian.xlsx`).

---

## Rencana Verifikasi

### Manual Verification
1.  Buka tab "Tracking Pengisian" di admin dashboard.
2.  Ubah rentang tanggal kustom ke rentang di mana ada ekskul yang belum membuat sesi dan ekskul yang sudah membuat sesi tetapi absensinya kosong.
3.  Pastikan badge status yang ditampilkan sesuai (Merah untuk belum buat sesi, Kuning untuk absensi belum lengkap/diisi, Hijau jika sudah lengkap).
4.  Uji coba klik tombol "Salin Laporan WA (Semua)" dan pastikan format teks tercopy dengan benar ke clipboard.
5.  Uji coba tombol "Ekspor Excel" dan pastikan file `.xlsx` terunduh dengan data yang akurat.
