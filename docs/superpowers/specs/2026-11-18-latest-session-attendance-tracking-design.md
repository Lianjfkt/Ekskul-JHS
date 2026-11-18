# Design Spec: Rekap Absensi Sesi Terakhir & Pelaporan Siswa Bermasalah ke BK/Kepsek

**Tanggal**: 2026-11-18  
**Topik**: Rekap Kehadiran Sesi Latihan Mutakhir / Tertentu per Ekstrakurikuler dan Pelaporan Cepat Siswa Alpa/Bermasalah ke Kepala Sekolah & Tim BK.

---

## 1. Latar Belakang & Kebutuhan

Saat ini, halaman Rekapitulasi Admin (`RecapManagement.jsx`) hanya menyajikan rekapitulasi kehadiran siswa secara kumulatif satu semester penuh (total hadir, izin, alpa, persentase). 

Ketika ada sesi ekstrakurikuler yang baru saja selesai (misalnya sesi pertemuan terakhir minggu ini / sesi kemarin), Admin mengalami kesulitan untuk:
1. Mengetahui secara cepat siapa saja siswa yang tidak hadir / alpa pada sesi pertemuan terakhir tersebut.
2. Mengidentifikasi apakah siswa yang alpa di pertemuan terakhir memiliki rekam jejak bermasalah (misalnya alpa beruntun / *streak alpha*, atau terancam sanksi teguran/SP).
3. Melaporkan kondisi absensi ter-update tersebut ke Kepala Sekolah atau Tim BK (Bimbingan Konseling) dengan format yang praktis dan instan.

Fitur ini menghadirkan tab baru khusus **"Absensi per Sesi"** yang fleksibel: otomatis memuat sesi mutakhir dari ekskul terpilih, menampilkan rincian kehadiran dengan prioritas siswa alpa/bermasalah di urutan teratas, serta menyediakan tombol aksi cepat untuk menyalin format laporan WhatsApp siap kirim ke BK/Kepsek dan ekspor dokumen resmi (PDF ber-kop surat & Excel).

---

## 2. Arsitektur & Perubahan UI

### 2.1. Penambahan Tab Baru di `RecapManagement.jsx`
* Menambahkan item pada array `tabs`:
  ```javascript
  { id: 'sessionAttendance', label: '📅 Absensi per Sesi' }
  ```

### 2.2. Kontrol Filter Header
1. **Dropdown Ekskul (`selectedEkskulSession`)**:
   * Menampilkan daftar ekstrakurikuler aktif.
   * Default: Otomatis memilih ekskul pertama jika belum ada yang dipilih.
   * Ketika ekskul berubah, sistem otomatis mengidentifikasi dan memilih **Sesi Terakhir** dari ekskul tersebut.
2. **Dropdown Sesi (`selectedSessionId`)**:
   * Menampilkan seluruh riwayat sesi untuk ekskul yang sedang aktif, diurutkan dari yang terbaru (`session_date` descending).
   * Format label: `[DD MMM YYYY] - Sesi #[No/Materi] (Status: Terisi / Belum Diisi)`.
   * Default: Otomatis memilih sesi terbaru yang sudah diisi absensinya (atau sesi paling mutakhir jika belum ada yang terisi).
3. **Filter Status Siswa (Pill / Button Group)**:
   * `Semua Siswa ({count})`
   * `⚠️ Alpa / Bermasalah ({count})` (highlight merah/oranye)
   * `Izin / Sakit ({count})`
   * `Hadir ({count})`
4. **Pencarian Nama / NIS**:
   * Input teks untuk menyaring nama siswa atau NIS secara instan di dalam sesi terpilih.

### 2.3. Kartu Ringkasan Sesi (Session Summary Card)
Menampilkan metrik dan ringkasan informasi sesi:
* **Detail Pelaksanaan**: Tanggal sesi, Nama Pelatih utama, Materi latihan, dan Catatan sesi.
* **Metrik Kehadiran**:
  * Total Siswa Terdaftar di Sesi
  * Hadir (jumlah & %)
  * Izin / Sakit (jumlah)
  * **Alpa / Tidak Hadir** (jumlah & kartu highlight merah menyala dengan icon `AlertTriangle`)

### 2.4. Aksi Cepat (Header Actions)
* **📋 Salin Laporan WA (BK & Kepsek)**: Menyusun format pesan WhatsApp terstruktur dan menyalinnya ke clipboard.
* **📄 Unduh PDF Sesi**: Menghasilkan dokumen PDF resmi dengan Kop Surat Sekolah (`addKopSuratToPDF`).
* **📊 Unduh Excel Sesi**: Menghasilkan file spreadsheet `.xlsx` untuk sesi tersebut.

---

## 3. Logika Pemrosesan Data

### 3.1. Penentuan Siswa yang Berhak Mengikuti Sesi
Menggunakan helper `isSessionApplicableToStudent(session, student, specialParticipants, attendances)` untuk memastikan siswa yang ditampilkan sesuai dengan ketentuan sesi (sesi reguler target kelas vs latihan khusus/undangan).

### 3.2. Pemetaan Status & Pengayaan Riwayat Siswa
Untuk setiap siswa yang relevan pada sesi tersebut:
1. **Status Sesi Ini**:
   * Diperoleh dari tabel `attendances` yang memiliki `session_id === session.id && student_id === student.id`.
   * Status bernilai: `hadir`, `izin`, atau `alpha`. (Jika sesi sudah disubmit namun siswa tidak tercatat di attendances, diidentifikasi sebagai `alpha`).
2. **Riwayat & Risiko Terkini**:
   * Menggunakan evaluasi dari `attendanceRiskEngine.js` untuk mendapatkan:
     * `consecutiveAlpha` (jumlah alpa berturut-turut hingga sesi ini).
     * `totalAlpha` (akumulasi alpa semester di ekskul ini).
     * `warningLevel` (`TEGURAN`, `PERINGATAN`, atau aman).
     * `actionRecommendation` (tindak lanjut rekomendasi untuk BK).

### 3.3. Pengurutan Data (Prioritas Penanganan Masalah)
Daftar siswa dalam tabel otomatis diurutkan dengan aturan:
1. Siswa **Alpa** di tempatkan di paling atas (diurutkan berdasarkan `consecutiveAlpha` terbesar, lalu `totalAlpha` terbesar).
2. Siswa **Izin / Sakit**.
3. Siswa **Hadir**.

---

## 4. Spesifikasi Output Laporan

### 4.1. Format Pesan WhatsApp (Salin ke Clipboard)
```text
📢 *LAPORAN ABSENSI SESI LATIHAN EKSTRAKURIKULER*
━━━━━━━━━━━━━━━━━━━━━━━━
*Ekskul*   : {ekskul.name}
*Tanggal*  : {hari, DD MMMM YYYY}
*Pelatih*  : {coachName}
*Materi*   : {session.topic || '-'}
*Kehadiran*: Hadir: {hadir} | Izin: {izin} | Alpa: {alpha} ({persentase}%)

⚠️ *DAFTAR SISWA ALPA / PERLU PERHATIAN BK:*
{daftar siswa alpa bernomor}
1. *{Nama Siswa}* ({Kelas} - NIS: {nis})
   └ Alpa Sesi Ini (Alpa Berturut-turut: {consecutiveAlpha}x | Total: {totalAlpha}x)
   └ Status Sanksi: {warningLevel || 'Peringatan Awal'}
   └ Rekomendasi: {actionRecommendation}

━━━━━━━━━━━━━━━━━━━━━━━━
_Catatan Pelatih_: {session.notes || '-'}
_Mohon bantuan Tim BK & Wali Kelas untuk menindaklanjuti ketidakhadiran siswa di atas. Terima kasih._
```
*(Jika tidak ada siswa alpa: `🎉 Seluruh siswa hadir / izin tertib. Tidak ada siswa alpa pada sesi ini.`)*

### 4.2. Format Dokumen PDF Sesi
* Header dokumen menggunakan `addKopSuratToPDF(doc)`.
* Judul: **BERITA ACARA & REKAPITULASI KEHADIRAN SESI LATIHAN**.
* Subheader berisi: Nama Ekstrakurikuler, Tanggal Sesi, Pelatih, Materi, dan Ringkasan Angka Kehadiran.
* Tabel Data:
  * No, NIS, Nama Siswa, Kelas, Status (Hadir/Izin/Alpa), Riwayat Alpa Berturut-turut, Status Risiko, Catatan/Keterangan.
* Footer: Tempat & tanggal dokumen, serta blok tanda tangan Pelatih dan Koordinator / Pembina Ekskul.

### 4.3. Format File Excel Sesi
* Filename: `rekap_sesi_{nama_ekskul}_{session_date}.xlsx`.
* Sheet header: NIS, Nama Siswa, Kelas, Status Kehadiran Sesi, Keterangan Izin/Sakit, Streak Alpa Berturut-turut, Total Alpa Semester, Status Sanksi, Rekomendasi BK.

---

## 5. Penanganan Edge Cases

1. **Ekskul Belum Memiliki Sesi**:
   * Tampilkan pesan *empty state* yang ramah: "Belum ada sesi latihan yang dibuat untuk ekstrakurikuler ini."
   * Tombol aksi ekspor dan salin WA dinonaktifkan (*disabled*).
2. **Sesi Dibuat Tetapi Belum Diisi Absensi**:
   * Tampilkan badge peringatan kuning di header: "Pelatih belum menginput absensi untuk sesi ini."
   * Tampilkan daftar siswa dengan status "Belum Diabsen".
3. **Seluruh Siswa Hadir (Zero Alpha)**:
   * Kartu alpa menampilkan angka 0 dengan warna hijau/netral.
   * Pesan salin WA secara positif mengapresiasi kehadiran 100% siswa.
4. **Sesi Latihan Khusus (`is_special_training = true`)**:
   * Hanya menampilkan siswa yang terdaftar di `special_participants`, tidak menarik seluruh peserta reguler ekskul.

---

## 6. Rencana Verifikasi

1. **Pengujian Tampilan & Pilihan Sesi**:
   * Buka tab `Absensi per Sesi`.
   * Ganti pilihan ekskul $\rightarrow$ pastikan dropdown sesi otomatis memilih sesi paling baru dari ekskul tersebut.
   * Pilih sesi yang lebih lama $\rightarrow$ pastikan data absensi dan kartu ringkasan berganti sesuai sesi terpilih.
2. **Pengujian Filter Siswa**:
   * Klik filter `⚠️ Alpa / Bermasalah` $\rightarrow$ hanya siswa yang berstatus Alpa pada sesi tersebut yang muncul di tabel.
   * Cek kotak pencarian untuk mencari nama siswa.
3. **Pengujian Salin Laporan WA**:
   * Klik tombol "Salin Laporan WA (BK & Kepsek)".
   * Paste ke notepad/teks editor dan pastikan seluruh placeholder terisi data yang valid, tanggal berformat bahasa Indonesia, dan data siswa alpa akurat.
4. **Pengujian Ekspor PDF & Excel**:
   * Klik "Unduh PDF Sesi" $\rightarrow$ verifikasi kop surat, metadata sesi, dan tabel ter-render dengan baik.
   * Klik "Unduh Excel Sesi" $\rightarrow$ buka file spreadsheet dan pastikan baris dan kolom terisi lengkap.
