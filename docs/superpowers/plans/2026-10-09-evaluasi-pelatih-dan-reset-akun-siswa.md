# Implementasi Penilaian Pelatih Ekskul & Standarisasi Akun Siswa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Menyediakan fitur penilaian kinerja pelatih ekskul oleh siswa di akhir semester 1, menyelesaikan kendala login siswa dengan standarisasi akun massal (email `[nis]@siswa.globalmadani.sch.id` & password `gm123456`) beserta ekspor Excel per kelas untuk wali kelas, dan menyajikan rekapitulasi evaluasi untuk Admin dan Pelatih (anonim).

**Architecture:** 
- PostgreSQL / Supabase: Tabel `coach_evaluations` dengan RLS & RPC `admin_batch_standardize_student_accounts`.
- Frontend Admin (`UsersManagement.jsx`, `RecapManagement.jsx`): Tombol eksekusi standarisasi akun, ekspor file Excel kredensial kelas, dan rekapitulasi evaluasi.
- Frontend Siswa (`StudentDashboard.jsx` & `CoachEvaluationModal.jsx`): Tampilan evaluasi ekskul, komponen bintang 1-5, dan pengiriman penilaian anonim.
- Frontend Pelatih (`CoachDashboard.jsx`): Tab ringkasan skor dan ulasan siswa tanpa identitas.

**Tech Stack:** React 18, Vite, Supabase JS Client, Tailwind CSS (Pixel Art theme), Lucide React, XLSX & FileSaver.

## Global Constraints
- Tema desain konsisten dengan UI Pixel/Retro SMP Global Madani (`UI_PIXEL.md`, warna `pixel-navy`, `pixel-panel`, `pixel-yellow`, font retro/pixel).
- Format Email Siswa: `[NIS]@siswa.globalmadani.sch.id`
- Password Default Siswa: `gm123456`
- Format Penilaian: Skala 1 - 5 bintang + masukan saran teks bebas.
- Privasi Pelatih: Pelatih tidak boleh melihat nama/NIS siswa yang memberi rating (anonim).

---

### Task 1: Skema Database & Stored Procedure (SQL)

**Files:**
- Create: `update_schema_coach_evaluations_and_account_reset.sql`

**Interfaces:**
- Produces: 
  - Table `public.coach_evaluations`
  - Function `public.admin_batch_standardize_student_accounts()` returning `TABLE(nis text, full_name text, class text, email text, default_password text)`
  - RLS Policies for student, coach, admin

- [x] **Step 1: Buat file SQL migrasi untuk tabel `coach_evaluations` dan RPC standarisasi akun**
  Tulis script DDL lengkap mencakup:
  1. Ekstensi `pgcrypto` dan `uuid-ossp`
  2. Pembuatan tabel `coach_evaluations` dengan constraint foreign key dan `UNIQUE(student_id, extracurricular_id, semester, academic_year)`
  3. Row Level Security (RLS) policies untuk `coach_evaluations` (Insert own for student, select own for student, select assigned for coach, full access for admin)
  4. Fungsi SQL `admin_batch_standardize_student_accounts()` yang melakukan iterasi seluruh data di `public.students`, membuat/mengupdate entri di `auth.users` dan `public.users` dengan email `[nis]@siswa.globalmadani.sch.id` dan password terenkripsi `gm123456`, serta me-return daftar kredensial untuk ekspor Excel.

- [x] **Step 2: Validasi sintaks SQL migrasi**
  Pastikan tidak ada syntax error pada sintaks PL/pgSQL, foreign key, maupun penamaan kolom.

- [x] **Step 3: Commit perubahan SQL**
  ```bash
  git add update_schema_coach_evaluations_and_account_reset.sql
  git commit -m "feat(db): add schema for coach evaluations and account standardization rpc"
  ```

---

### Task 2: Service & Helper Ekspor Excel Kredensial Siswa

**Files:**
- Create: `src/utils/studentAccountExport.js`

**Interfaces:**
- Produces:
  - `exportStudentAccountsToExcel(accountsData, options)`
    - Parameter: `accountsData` (array of `{ nis, full_name, class, email, default_password }`), `options` (opsional: filter kelas tertentu atau grouped per sheet)
    - Return: Mengunduh file `.xlsx` dengan format rapi dan sheet terpisah per kelas (7A, 7B, 8A, dsb.).

- [x] **Step 1: Implementasi fungsi utilitas pembantu ekspor Excel menggunakan `xlsx` dan `file-saver`**
  Membuat generator workbook dengan:
  - Pengelompokan data siswa per kelas.
  - Setiap kelas dijadikan Sheet tersendiri (misal: "Kelas 7A", "Kelas 7B", dst.) dan satu sheet gabungan "Semua Siswa".
  - Header kolom: No, NIS, Nama Lengkap, Kelas, Email Login, Password Default, Catatan/Panduan.
  - Styling kolom lebar yang pas agar rapi saat dicetak/dibuka wali kelas di Microsoft Excel atau Google Sheets.

- [x] **Step 2: Verifikasi pembuatan file Excel dengan test/script dummy**
  Uji ekspor dengan data dummy untuk memastikan struktur sheet dan file terbentuk tanpa error.

- [x] **Step 3: Commit helper ekspor akun**
  ```bash
  git add src/utils/studentAccountExport.js
  git commit -m "feat(utils): add student account excel exporter grouped by class"
  ```

---

### Task 3: Modul Admin — Standarisasi Akun Siswa & Ekspor ke Wali Kelas

**Files:**
- Modify: `src/pages/admin/UsersManagement.jsx`

**Interfaces:**
- Consumes:
  - Supabase RPC: `supabase.rpc('admin_batch_standardize_student_accounts')`
  - Helper: `exportStudentAccountsToExcel` dari `src/utils/studentAccountExport.js`

- [x] **Step 1: Tambahkan tombol aksi di `UsersManagement.jsx`**
  Tambahkan tombol *"Standarisasi & Ekspor Akun Siswa"* di bagian toolbar atas tab Siswa.

- [x] **Step 2: Buat Modal Dialog Konfirmasi & Ekspor Akun Siswa**
  - Menampilkan ringkasan: Email akan diseragamkan ke `[NIS]@siswa.globalmadani.sch.id` dan password `gm123456`.
  - Tombol *"Proses & Unduh Excel"*.
  - Indikator loading / progress bar retro saat RPC sedang memproses akun.
  - Pilihan unduh: "Semua Kelas (Sheet per Kelas)" atau filter "Pilih Satu Kelas Saja".

- [x] **Step 3: Uji fungsi standarisasi dan unduh Excel dari antarmuka**
  Verifikasi interaksi klik, handling sukses, pesan notifikasi toast/alert, dan unduhan file excel.

- [x] **Step 4: Commit perubahan `UsersManagement.jsx`**
  ```bash
  git add src/pages/admin/UsersManagement.jsx
  git commit -m "feat(admin): add batch account standardization and excel distribution for homeroom teachers"
  ```

---

### Task 4: Komponen & Form Penilaian Pelatih di Sisi Siswa

**Files:**
- Create: `src/components/student/CoachEvaluationModal.jsx`
- Modify: `src/pages/student/StudentDashboard.jsx`

**Interfaces:**
- Produces:
  - Component `CoachEvaluationModal({ isOpen, onClose, extracurricular, coach, studentId, semester, academicYear, onSuccess })`
- Consumes:
  - Table `coach_evaluations` (insert & query)

- [x] **Step 1: Buat komponen `CoachEvaluationModal.jsx`**
  - Header: Nama Ekskul & Nama Pelatih yang dinilai.
  - Rating Bintang (1 - 5) yang interaktif dengan hover effect pixel dan label keterangan (1: Kurang Sekali, 2: Kurang, 3: Cukup, 4: Baik, 5: Sangat Baik).
  - Textarea masukan saran/pesan untuk pelatih.
  - Banner informasi anonim: *"Penilaian dan masukan Anda bersifat anonim untuk pelatih."*
  - Tombol submit dengan validasi minimal 1 bintang terisi.
  - Logika insert ke `public.coach_evaluations`.

- [x] **Step 2: Integrasikan Seksi/Banner Penilaian di `StudentDashboard.jsx`**
  - Mengambil data ekskul aktif yang diikuti siswa semester ini beserta status apakah sudah pernah dinilai di `coach_evaluations`.
  - Tampilkan kartu retro: *"Evaluasi Pelatih Semester 1"*.
  - Jika belum dinilai: Tombol *"Beri Penilaian"* (membuka modal).
  - Jika sudah dinilai: Badge hijau *"Sudah Dinilai"* dan bintang rating yang telah diberikan.

- [x] **Step 3: Verifikasi flow siswa**
  Pastikan siswa bisa membuka modal, memilih bintang, menulis saran, menyimpan data, dan status langsung ter-update menjadi sudah dinilai tanpa reload.

- [x] **Step 4: Commit fitur evaluasi siswa**
  ```bash
  git add src/components/student/CoachEvaluationModal.jsx src/pages/student/StudentDashboard.jsx
  git commit -m "feat(student): add coach evaluation form and dashboard section"
  ```

---

### Task 5: Antarmuka Rekap Evaluasi di Dashboard Pelatih (Anonim)

**Files:**
- Modify: `src/pages/coach/CoachDashboard.jsx`

**Interfaces:**
- Consumes:
  - Query ke `coach_evaluations` where `coach_id = currentCoachId`

- [x] **Step 1: Ambil data evaluasi untuk pelatih yang sedang login**
  Ambil list evaluasi dan hitung metrik:
  - Rata-rata rating bintang.
  - Jumlah total respon/ulasan.
  - Distribusi bintang (skor 5, 4, 3, 2, 1).
  - Daftar feedback teks (pastikan tidak ada field nama/NIS siswa yang ditampilkan).

- [x] **Step 2: Tambahkan Seksi/Tab "Evaluasi Siswa" di `CoachDashboard.jsx`**
  - Desain kartu skor bintang besar, kartu distribusi kepuasan siswa, dan kartu testimoni/saran siswa dengan gaya pixel art yang elegan.

- [x] **Step 3: Verifikasi tampilan pelatih**
  Pastikan tampilan bersih, rating terhitung akurat, masukan siswa tampil lengkap, dan identitas siswa benar-benar tidak tampak sama sekali.

- [x] **Step 4: Commit perubahan `CoachDashboard.jsx`**
  ```bash
  git add src/pages/coach/CoachDashboard.jsx
  git commit -m "feat(coach): add anonymous student evaluation and rating review section"
  ```

---

### Task 6: Panel Rekapitulasi Evaluasi Pelatih di Sisi Admin & Ekspor Laporan

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx`

**Interfaces:**
- Consumes:
  - Query ke `coach_evaluations` join `extracurriculars`, `coaches`, dan `students`

- [x] **Step 1: Tambahkan Tab / Tampilan "Evaluasi Pelatih" di `RecapManagement.jsx`**
  - Filter: Semester, Tahun Ajaran, Pilihan Ekskul / Pelatih.
  - Tabel rekapitulasi performa pelatih:
    - Nama Ekskul, Pelatih, Rata-rata Skor Bintang, Jumlah Ulasan, Persentase Partisipasi Siswa.
  - Modal / Seksi Detail Respon per Pelatih: menampilkan detail rating tiap siswa, masukan saran, dan nama siswa (khusus admin).

- [x] **Step 2: Tambahkan Tombol Ekspor Rekap Evaluasi ke Excel**
  - Menghasilkan file Excel laporan rekap evaluasi pelatih per ekskul untuk arsip sekolah.

- [x] **Step 3: Verifikasi tampilan dan ekspor admin**
  Pastikan query berjalan lancar, filter berfungsi, dan ekspor file Excel laporan evaluasi terunduh sempurna.

- [x] **Step 4: Commit modul rekap admin**
  ```bash
  git add src/pages/admin/RecapManagement.jsx
  git commit -m "feat(admin): add coach evaluation recap and excel export report"
  ```

---

### Task 7: Pengujian Akhir & Verifikasi Sistem (End-to-End)

**Files:**
- Review: Semua file yang dimodifikasi

- [x] **Step 1: Uji Build Frontend**
  Jalankan `npm run build` untuk memastikan tidak ada kesalahan import, sintaks, atau typescript/jsx linter error.

- [x] **Step 2: Panduan Eksekusi SQL untuk Pengguna**
  Siapkan instruksi jelas mengenai cara menjalankan script migrasi SQL `update_schema_coach_evaluations_and_account_reset.sql` di Supabase SQL Editor.

- [x] **Step 3: Commit akhir**
  ```bash
  git commit --allow-empty -m "chore: complete end-to-end coach evaluation and student account reset features"
  ```
