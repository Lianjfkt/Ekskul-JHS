# Design Spec: Pencegahan Sesi Duplikat dan Manajemen Hapus Sesi oleh Admin

**Tanggal**: 2026-11-19  
**Topik**: Pencegahan input sesi ganda oleh pelatih dan pemberian hak hapus sesi langsung untuk Admin pada menu Rekap Absensi.

---

## 1. Latar Belakang & Masalah
Saat ini sering terjadi kasus di mana sesi latihan ekstrakurikuler terinput ganda (*double input*) oleh pelatih. Hal ini menimbulkan masalah:
1. **Absensi Terhitung Ganda**: Kehadiran siswa tercatat dua kali pada hari yang sama, menyebabkan inflasi data jumlah sesi dan persentase kehadiran yang bias pada laporan rekap.
2. **Keterbatasan Admin**: Admin di halaman `RecapManagement.jsx` hanya memiliki akses melihat data (*read-only*). Ketika mendeteksi adanya sesi ganda, Admin harus menghubungi pelatih secara manual via WhatsApp dan menunggu pelatih menghapusnya dari akun mereka.

### Akar Masalah Teknis
1. **Tombol "Simpan Sesi" Tanpa Proteksi Submit**: Pada `CoachSessions.jsx`, tidak ada penanganan *submitting state* / penonaktifan tombol (*disabled*) saat proses *insert* berlangsung. Jika pelatih mengklik ganda (*double click*) atau koneksi internet mengalami latensi, dua sesi identik tersimpan ke database.
2. **Ketiadaan Validasi Tanggal Sesi**: Tidak ada pemeriksaan apakah pada tanggal tersebut ekskul sudah memiliki sesi latihan.
3. **Ketiadaan Unique Constraint di Database**: Tabel `sessions` tidak membatasi keunikan kombinasi `(extracurricular_id, session_date)`.
4. **Ketiadaan Aksi Hapus di Sisi Admin**: Antarmuka Admin belum menyediakan tombol hapus sesi meskipun kebijakan RLS Supabase sudah mengizinkan peran `admin` mengelola tabel `sessions`.

---

## 2. Aturan Bisnis (Business Rule)
* **Aturan Utama**: Dalam satu ekstrakurikuler, **hanya boleh ada maksimal 1 sesi latihan per tanggal** (berlaku untuk semua jenis sesi, baik reguler maupun latihan khusus).
* **Hak Akses Admin**: Admin berhak menghapus sesi yang salah/duplikat secara langsung tanpa harus meminta pelatih menghapusnya.

---

## 3. Rincian Solusi & Perubahan

### A. Sisi Pelatih: Proteksi Form Sesi (`src/pages/coach/CoachSessions.jsx`)
1. **State `isSubmitting`**:
   * Menambahkan state `const [isSubmitting, setIsSubmitting] = useState(false)`.
   * Saat `handleSubmit` dijalankan, `setIsSubmitting(true)`. Tombol "Simpan Sesi" dinonaktifkan (`disabled={isSubmitting}`) dan menampilkan teks `"Menyimpan..."` dengan ikon loading/indikator proses.
   * `setIsSubmitting(false)` dijalankan di blok `finally`.
2. **Pengecekan Duplikasi Sebelum Simpan**:
   * Sebelum memanggil `insert` (atau saat `update` dengan tanggal yang berubah), sistem melakukan pengecekan ke database:
     ```javascript
     let checkQuery = supabase
       .from('sessions')
       .select('id, session_date, topic')
       .eq('extracurricular_id', form.extracurricular_id)
       .eq('session_date', form.session_date);
     
     if (selectedSession?.id) {
       checkQuery = checkQuery.neq('id', selectedSession.id);
     }
     
     const { data: existingSessions, error: checkErr } = await checkQuery;
     ```
   * Jika `existingSessions.length > 0`, sistem membatalkan proses simpan dan menampilkan pesan kesalahan:
     > *"Sesi untuk ekstrakurikuler ini pada tanggal tersebut sudah pernah dibuat. Setiap ekskul hanya dapat memiliki maksimal 1 sesi per hari."*

### B. Sisi Database: Migrasi Constraint Keunikan (`add_unique_constraint_sessions.sql`)
1. Menyediakan skrip SQL migrasi untuk mencegah data ganda masuk secara permanen:
   * Query pendeteksian duplikat lama untuk melihat data yang bermasalah sebelum constraint diterapkan.
   * Query penghapusan data duplikat lama (mempertahankan 1 sesi tertua/terlengkap).
   * Menambahkan constraint unik pada tabel `sessions`:
     ```sql
     ALTER TABLE public.sessions
     ADD CONSTRAINT unique_ekskul_session_date UNIQUE (extracurricular_id, session_date);
     ```

### C. Sisi Admin: Hak Hapus Sesi di Rekap (`src/pages/admin/RecapManagement.jsx`)
1. **Aksi Hapus di Tab "Absensi per Sesi" (`sessionAttendance`)**:
   * Menambahkan tombol merah **"Hapus Sesi"** (dengan ikon `Trash2`) di sebelah informasi sesi terpilih.
   * Ketika diklik, memunculkan modal/dialog konfirmasi bahaya:
     > *"Apakah Anda yakin ingin menghapus sesi tanggal [Tanggal] ([Topik])? Seluruh data kehadiran siswa pada sesi ini juga akan dihapus secara permanen."*
   * Menjalankan penghapusan ke Supabase: `supabase.from('sessions').delete().eq('id', selectedSessionId)`.
   * Mengingat relasi tabel anak (`attendances`, `session_coaches`, `special_session_participants`) memiliki konfigurasi `ON DELETE CASCADE`, seluruh data anak akan terhapus bersih.
   * Menampilkan toast pemberitahuan sukses dan me-refresh data daftar sesi serta rekap.
2. **Aksi Hapus di Modal "Detail Sesi Latihan" (`selectedSessionGroup`)**:
   * Pada setiap kartu sesi di daftar riwayat sesi pelatih, menambahkan tombol ikon hapus (`Trash2`) kecil.
   * Menampilkan dialog konfirmasi serupa.
   * Jika dihapus dari modal, sesi tersebut langsung dihilangkan dari daftar modal dan data rekap otomatis di-*refresh*.
3. **Penanda Visual Sesi Ganda (Visual Indicator)**:
   * Di dropdown pilihan sesi dan di riwayat sesi, jika terdapat lebih dari satu sesi pada tanggal yang sama (untuk data historis sebelum migrasi atau anomali), tambahkan badge peringatan kuning/oranye: `"⚠️ Sesi Ganda"`.

---

## 4. Rencana Verifikasi

### Manual Verification
1. **Uji Coba Form Pelatih (`CoachSessions.jsx`)**:
   * Coba buat sesi untuk ekskul A pada tanggal hari ini.
   * Coba buat sesi baru lagi untuk ekskul A pada tanggal yang sama.
   * Pastikan sistem menolak dengan pesan error yang jelas dan tidak memasukkan data baru ke database.
   * Coba lakukan klik cepat berulang kali pada tombol "Simpan Sesi" dan pastikan tombol berstatus *disabled* tanpa terjadinya *duplicate insert*.
2. **Uji Coba Aksi Hapus Admin (`RecapManagement.jsx`)**:
   * Buka tab **"Absensi per Sesi"**, pilih ekskul dan sesi terkait.
   * Klik tombol **"Hapus Sesi"**, periksa apakah dialog konfirmasi muncul dengan benar.
   * Konfirmasi penghapusan, pastikan sesi terhapus dari daftar dan data kehadiran terkait bersih dari database.
   * Buka tab **"Sesi Latihan per Pelatih"** -> klik **"Lihat Detail"**, pastikan tombol hapus pada kartu sesi berfungsi sebagaimana mestinya.
