# Design Spec: Pencarian Siswa di Presensi Pelatih

Menambahkan fitur pencarian siswa berdasarkan nama dan kelas saat pelatih melakukan absensi di halaman `CoachAttendances.jsx`.

## Proposed Changes

### Frontend - Coach Attendances

#### [MODIFY] [CoachAttendances.jsx](file:///media/lian/Ubuntu/Ekskul-JHS/src/pages/coach/CoachAttendances.jsx)

- Tambahkan state `searchTerm` untuk memantau kata kunci pencarian.
- Impor icon `Search` dan `X` dari `lucide-react`.
- Terapkan fungsi filter client-side:
  ```javascript
  const filteredStudents = students.filter(student => 
    student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.class?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  ```
- Render search input di atas tabel, di dalam `CardContent` atau di atas tabel.
- Jika hasil pencarian kosong, tampilkan pesan informatif.

## Verification Plan

### Manual Verification
- Pilih salah satu ekskul dan sesi latihan.
- Coba ketik nama siswa pada bar pencarian dan pastikan daftar siswa ter-filter secara real-time.
- Coba ketik kelas siswa (misalnya "7A") dan pastikan hanya siswa di kelas tersebut yang muncul.
- Uji tombol reset/bersihkan pencarian.
- Pastikan absensi yang diinput pada hasil filter tetap tersimpan dengan benar saat disimpan.
