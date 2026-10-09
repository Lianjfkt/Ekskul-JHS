# Desain Sistem: Penilaian Pelatih Ekskul oleh Siswa & Standarisasi Akun Siswa

**Tanggal**: 2026-10-09  
**Status**: Disetujui (Approved)  
**Tujuan**: Memfasilitasi siswa untuk memberikan penilaian/evaluasi akhir semester 1 kepada pelatih ekskul mereka, sekaligus mengatasi kendala siswa yang lupa email dan password dengan standarisasi kredensial massal dan ekspor akun ke Excel untuk wali kelas.

---

## 1. Latar Belakang & Masalah
- Di akhir semester 1, sekolah membutuhkan data evaluasi dan feedback dari siswa terhadap kinerja pelatih ekstrakurikuler yang mereka ikuti.
- Kendala operasional di lapangan: sebagian besar siswa lupa email login dan password akun mereka di portal ekskul.
- Diperlukan mekanisme cepat dan terkoordinasi bagi Admin untuk men-standarisasi akun siswa ke format mudah, mengunduh file kredensial Excel per kelas untuk dibagikan kepada wali kelas, serta antarmuka pengisian penilaian yang mudah diakses siswa dan anonim bagi pelatih.

---

## 2. Arsitektur & Perubahan Database (SQL)

### 2.1 Tabel `coach_evaluations`
Menampung data penilaian siswa untuk pelatih:
```sql
CREATE TABLE IF NOT EXISTS public.coach_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extracurricular_id UUID NOT NULL REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    semester TEXT NOT NULL DEFAULT 'Ganjil',
    academic_year TEXT NOT NULL DEFAULT '2024/2025',
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_student_coach_eval UNIQUE(student_id, extracurricular_id, semester, academic_year)
);
```

### 2.2 Row Level Security (RLS) & Kebijakan
```sql
ALTER TABLE public.coach_evaluations ENABLE ROW LEVEL SECURITY;

-- 1. Siswa hanya dapat memasukkan penilaian untuk dirinya sendiri
CREATE POLICY "Student insert own evaluation" ON public.coach_evaluations
FOR INSERT WITH CHECK (
    student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
);

-- 2. Siswa dapat membaca riwayat penilaian yang ia kirim
CREATE POLICY "Student view own evaluation" ON public.coach_evaluations
FOR SELECT USING (
    student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
);

-- 3. Pelatih dapat membaca evaluasi untuk dirinya (coach_id = auth.uid())
CREATE POLICY "Coach view assigned evaluations" ON public.coach_evaluations
FOR SELECT USING (
    coach_id = auth.uid() OR public.get_user_role() IN ('admin')
);

-- 4. Admin memiliki hak penuh (SELECT, DELETE, UPDATE)
CREATE POLICY "Admin manage evaluations" ON public.coach_evaluations
FOR ALL USING (
    public.get_user_role() = 'admin'
);
```

### 2.3 RPC SQL: `admin_batch_standardize_student_accounts`
Fungsi `SECURITY DEFINER` untuk admin membuat/memperbarui akun siswa:
- **Format Email**: `[NIS]@siswa.globalmadani.sch.id`
- **Password Default**: `gm123456`
- **Logika**:
  1. Melakukan query seluruh siswa dari `public.students`.
  2. Untuk setiap siswa, cek apakah record di `public.users` dengan role `'student'` dan `student_id = s.id` sudah ada.
  3. Update / buat user di `auth.users` dengan email standar dan enkripsi bcrypt `crypt('gm123456', gen_salt('bf', 10))`.
  4. Sinkronkan ke `public.users`.
  5. Mengembalikan tabel data `(nis, full_name, class, email, default_password)` agar dapat langsung diekspor ke Excel oleh frontend Admin.

---

## 3. Fitur & Antarmuka Pengguna

### 3.1 Sisi Admin (`UsersManagement.jsx` / `RecapManagement.jsx`)
1. **Standarisasi & Reset Akun Siswa**:
   - Tombol **"Standarisasi Akun Siswa (Email & Password)"** dengan dialog konfirmasi.
   - Panggilan ke RPC `admin_batch_standardize_student_accounts`.
2. **Ekspor Akun ke Excel untuk Wali Kelas**:
   - Tombol **"Ekspor Akun Siswa (Excel)"**:
     - Format workbook Excel (`.xlsx`) via pustaka `xlsx`:
       - Opsi "Semua Kelas" (masing-masing kelas dalam sheet tersendiri, misal: Tab `7A`, Tab `7B`, Tab `8A`, dst.) atau file per kelas terpilih.
     - Kolom tabel Excel:
       - `No`, `NIS`, `Nama Siswa`, `Kelas`, `Email Login`, `Password Default`, `Catatan Panduan`.
3. **Rekapitulasi Penilaian Pelatih (`RecapManagement.jsx` / Menu Evaluasi)**:
   - Filter Semester & Tahun Ajaran.
   - Kartu statistik: Rata-rata bintang pelatih dan persentase partisipasi siswa.
   - Tabel respons evaluasi: nama pelatih, ekskul, nilai rating (bintang), saran siswa, nama siswa (khusus dilihat admin untuk keperluan validasi), serta tombol unduh rekap Excel.

### 3.2 Sisi Siswa (`StudentDashboard.jsx`)
1. **Banner/Card Evaluasi Akhir Semester**:
   - Menampilkan daftar ekskul aktif yang diikuti siswa pada semester berjalan.
   - Status badge per ekskul:
     - 🟡 **Belum Dinilai**: Tombol *"Beri Penilaian"*.
     - 🟢 **Sudah Dinilai**: Tanda centang hijau & keterangan *"Terima Kasih, Penilaian Tersimpan"*.
2. **Modal Dialog Penilaian**:
   - Nama Ekskul dan Nama Pelatih yang bersangkutan.
   - **Komponen Rating Bintang (1 - 5)**:
     - 1 = Kurang Sekali
     - 2 = Kurang
     - 3 = Cukup
     - 4 = Baik
     - 5 = Sangat Baik
   - **Textarea Catatan/Saran**: masukan terbuka untuk pelatih.
   - Penjelasan jaminan anonimitas: *"Penilaian dan saran ini akan disampaikan ke pelatih tanpa menampilkan nama Anda."*
   - Validasi: Memastikan rating minimal 1 bintang telah dipilih sebelum tombol submit aktif.

### 3.3 Sisi Pelatih (`CoachDashboard.jsx`)
1. **Seksi "Evaluasi Siswa (Semester 1)"**:
   - Menampilkan rata-rata bintang keseluruhan (misal: 4.8 / 5.0 ⭐) dan jumlah ulasan yang diterima.
   - Daftar ulasan saran/pesan dari siswa:
     - Disajikan secara **anonim** (nama dan NIS siswa disembunyikan/dihapus dari query/tampilan).
     - Menampilkan rating bintang, kutipan saran, dan tanggal ulasan.

---

## 4. Keamanan & Penanganan Error (Error Handling)
- **Anti Double-Submit**: Menggunakan PostgreSQL Unique Constraint `(student_id, extracurricular_id, semester, academic_year)` serta proteksi tombol disable di antarmuka frontend setelah form dikirim.
- **Validasi Nilai Rating**: Constraint SQL `CHECK (rating >= 1 AND rating <= 5)` mencegah input rating di luar batas.
- **Anonimitas Pelatih**: Pelatih hanya mendapatkan atribut rating, feedback, semester, dan created_at; kolom profil siswa tidak diexpose ke UI pelatih.

---

## 5. Rencana Pengujian (Testing Plan)
1. **Pengujian Database & RPC**:
   - Eksekusi script SQL di Supabase/Local.
   - Jalankan fungsi `admin_batch_standardize_student_accounts` dan pastikan kredensial `auth.users` dan `public.users` terbarui dengan benar.
2. **Pengujian Ekspor Excel**:
   - Unduh file Excel dari panel admin dan periksa sheet per kelas, verifikasi nama kolom dan kerapihan format.
3. **Pengujian Login Siswa**:
   - Coba login dengan salah satu akun hasil standarisasi: `[NIS]@siswa.globalmadani.sch.id` dan password `gm123456`.
4. **Pengujian Pengisian Evaluasi oleh Siswa**:
   - Masuk ke dashboard siswa, buka modal penilaian, isi skor bintang dan pesan saran, lalu simpan.
   - Pastikan status berubah menjadi "Sudah Dinilai" dan tidak bisa dinilai ulang.
5. **Pengujian Tampilan Pelatih & Admin**:
   - Login sebagai pelatih ekskul terkait, pastikan ulasan muncul tanpa identitas siswa.
   - Login sebagai admin, pastikan rekapitulasi lengkap muncul dan bisa diekspor.
