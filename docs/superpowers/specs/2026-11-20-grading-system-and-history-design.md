# Spesifikasi Desain: Standarisasi Sistem Penilaian 0-100 & Riwayat Nilai Multi-Role

**Tanggal:** 2026-11-20  
**Status:** Approved by User  
**Topik:** Penilaian Perkembangan Siswa, Validasi Rentang 0-100, Riwayat Perkembangan Nilai Antar-Semester, dan Log Audit Revisi Nilai untuk Seluruh Role (Pelatih, Siswa, Orang Tua, Admin).

---

## 1. Latar Belakang & Masalah

Pada sistem penilaian ekstrakurikuler saat ini:
1. **Validasi Rentang & Null Handling:**
   - Database dan antarmuka mengizinkan nilai dimasukkan, namun perlu dipastikan nilai berada dalam rentang valid **0 hingga 100**, di mana angka `0` adalah nilai sah (misal: siswa tidak mengikuti ujian/praktik), sedangkan input kosong (`""`) disimpan sebagai `NULL` (belum dinilai).
2. **Penyimpanan Menimpa (Upsert Overwrite):**
   - Nilai tersimpan dengan constraint `UNIQUE (student_id, extracurricular_id, semester, academic_year)`. Setiap perubahan langsung menimpa data lama tanpa meninggalkan jejak revisi.
3. **Ketiadaan Riwayat Nilai Lintas Semester & Lintas Role:**
   - **Pelatih (Coach):** Hanya dapat melihat satu semester terpilih; tidak bisa melihat riwayat semester sebelumnya siswa binaannya secara langsung saat menginput nilai.
   - **Siswa (Student):** Hanya bisa melihat nilai satu semester yang difilter; tidak ada grafik tren perkembangan nilai antar-semester.
   - **Orang Tua (Parent):** Hanya bisa melihat nilai semester tertentu dan cetak PDF satu semester; belum ada rapor riwayat kumulatif seluruh semester serta perlindungan RLS eksplisit bagi orang tua di tabel `grades`.
   - **Admin:** Memiliki tabel rekapitulasi, namun belum memiliki modal riwayat individual siswa dan log audit perubahan nilai untuk akuntabilitas.

---

## 2. Sasaran & Ruang Lingkup

1. **Standarisasi Range Nilai 0 - 100:**
   - Skema database `public.grades` memvalidasi `attitude_score`, `skill_score`, dan `activity_score` berada dalam rentang `0` sampai `100` atau `NULL`.
   - Frontend `CoachGrades.jsx` memvalidasi input integer 0–100 secara realtime dan menyimpan string kosong sebagai `NULL`.
   - `gradeUtils.js` memperlakukan `0` sebagai nilai terhitung dalam kalkulasi rata-rata (`avg`).
2. **Database Audit Trail (`public.grade_audit_logs` & Trigger):**
   - Trigger otomatis PostgreSQL merekam setiap aksi `INSERT`, `UPDATE`, dan `DELETE` pada tabel `grades`.
   - Menyimpan `old_scores`, `new_scores`, user pengubah (`changed_by`), dan timestamp (`changed_at`).
3. **Riwayat Nilai Multi-Role:**
   - **Pelatih:** Modal "Riwayat Siswa" di setiap baris tabel penilaian (menampilkan tren semester lalu dan log revisi nilai siswa tersebut).
   - **Siswa:** Tab "Linimasa & Tren Riwayat Nilai" dengan Line Chart perkembangan nilai rata-rata per semester dan kartu riwayat evaluasi.
   - **Orang Tua:** Tab linimasa riwayat anak terpilih + fitur ekspor "Rapor Riwayat Kumulatif (PDF)" dengan Kop Surat resmi.
   - **Admin:** Modal "Riwayat Siswa" di Laporan Nilai + Sub-tab / Modal "Log Audit Perubahan Nilai" dengan filter dan ekspor Excel.
4. **Penyempurnaan Keamanan RLS:**
   - Kebijakan RLS eksplisit di PostgreSQL agar role `parent` dapat membaca nilai dan audit log anak-anaknya.

---

## 3. Arsitektur Teknis & Skema Database

### 3.1 Skrip Migrasi SQL (`update_schema_grades_history_and_audit.sql`)

```sql
-- 1. Perbarui Constraint Rentang Nilai (0 - 100 atau NULL) pada public.grades
ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_attitude_score_check,
  ADD CONSTRAINT grades_attitude_score_check 
    CHECK (attitude_score IS NULL OR (attitude_score >= 0 AND attitude_score <= 100));

ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_skill_score_check,
  ADD CONSTRAINT grades_skill_score_check 
    CHECK (skill_score IS NULL OR (skill_score >= 0 AND skill_score <= 100));

ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_activity_score_check,
  ADD CONSTRAINT grades_activity_score_check 
    CHECK (activity_score IS NULL OR (activity_score >= 0 AND activity_score <= 100));

-- 2. Buat Tabel Log Audit Nilai (grade_audit_logs)
CREATE TABLE IF NOT EXISTS public.grade_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    extracurricular_id UUID REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    action TEXT CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    old_scores JSONB,
    new_scores JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Performa
CREATE INDEX IF NOT EXISTS idx_grade_audit_student_id ON public.grade_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_ekskul_id ON public.grade_audit_logs(extracurricular_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_changed_at ON public.grade_audit_logs(changed_at DESC);

-- 3. Fungsi & Trigger Otomatis Audit Nilai
CREATE OR REPLACE FUNCTION public.trg_log_grade_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.grade_audit_logs (
            grade_id, student_id, extracurricular_id, semester, academic_year,
            action, changed_by, old_scores, new_scores, changed_at
        ) VALUES (
            NEW.id, NEW.student_id, NEW.extracurricular_id, NEW.semester, NEW.academic_year,
            'INSERT', COALESCE(v_user_id, NEW.graded_by),
            NULL,
            jsonb_build_object(
                'attitude_score', NEW.attitude_score,
                'skill_score', NEW.skill_score,
                'activity_score', NEW.activity_score,
                'notes', NEW.notes
            ),
            timezone('utc'::text, now())
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Catat hanya jika ada perbedaan pada skor atau catatan
        IF (OLD.attitude_score IS DISTINCT FROM NEW.attitude_score OR
            OLD.skill_score IS DISTINCT FROM NEW.skill_score OR
            OLD.activity_score IS DISTINCT FROM NEW.activity_score OR
            OLD.notes IS DISTINCT FROM NEW.notes) THEN
            
            INSERT INTO public.grade_audit_logs (
                grade_id, student_id, extracurricular_id, semester, academic_year,
                action, changed_by, old_scores, new_scores, changed_at
            ) VALUES (
                NEW.id, NEW.student_id, NEW.extracurricular_id, NEW.semester, NEW.academic_year,
                'UPDATE', COALESCE(v_user_id, NEW.graded_by),
                jsonb_build_object(
                    'attitude_score', OLD.attitude_score,
                    'skill_score', OLD.skill_score,
                    'activity_score', OLD.activity_score,
                    'notes', OLD.notes
                ),
                jsonb_build_object(
                    'attitude_score', NEW.attitude_score,
                    'skill_score', NEW.skill_score,
                    'activity_score', NEW.activity_score,
                    'notes', NEW.notes
                ),
                timezone('utc'::text, now())
            );
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.grade_audit_logs (
            grade_id, student_id, extracurricular_id, semester, academic_year,
            action, changed_by, old_scores, new_scores, changed_at
        ) VALUES (
            OLD.id, OLD.student_id, OLD.extracurricular_id, OLD.semester, OLD.academic_year,
            'DELETE', v_user_id,
            jsonb_build_object(
                'attitude_score', OLD.attitude_score,
                'skill_score', OLD.skill_score,
                'activity_score', OLD.activity_score,
                'notes', OLD.notes
            ),
            NULL,
            timezone('utc'::text, now())
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_grades_audit ON public.grades;
CREATE TRIGGER trg_grades_audit
AFTER INSERT OR UPDATE OR DELETE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.trg_log_grade_changes();

-- 4. Aktifkan RLS & Kebijakan Hak Akses
ALTER TABLE public.grade_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin full access
CREATE POLICY "Admin kelola grade_audit_logs"
ON public.grade_audit_logs FOR ALL
USING (public.get_user_role() = 'admin');

-- Policy: Coach baca log ekskul yang diampu
CREATE POLICY "Coach baca grade_audit_logs binaannya"
ON public.grade_audit_logs FOR SELECT
USING (
    public.get_user_role() = 'coach' AND
    extracurricular_id IN (
        SELECT id FROM public.extracurriculars 
        WHERE coach_id = auth.uid() OR coach_id_2 = auth.uid() OR coach_id_3 = auth.uid()
    )
);

-- Policy: Siswa baca log nilainya sendiri
CREATE POLICY "Siswa baca grade_audit_logs sendiri"
ON public.grade_audit_logs FOR SELECT
USING (
    student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
);

-- Policy: Orang tua baca nilai & audit log anak
CREATE POLICY "Parent baca nilai anak"
ON public.grades FOR SELECT
USING (
    public.get_user_role() = 'parent' AND
    student_id IN (
        SELECT p.student_id FROM public.parents p
        JOIN public.users u ON lower(trim(u.full_name)) = lower(trim(p.full_name))
        WHERE u.id = auth.uid()
        UNION
        SELECT u2.student_id FROM public.users u2 WHERE u2.id = auth.uid() AND u2.student_id IS NOT NULL
    )
);

CREATE POLICY "Parent baca grade_audit_logs anak"
ON public.grade_audit_logs FOR SELECT
USING (
    public.get_user_role() = 'parent' AND
    student_id IN (
        SELECT p.student_id FROM public.parents p
        JOIN public.users u ON lower(trim(u.full_name)) = lower(trim(p.full_name))
        WHERE u.id = auth.uid()
        UNION
        SELECT u2.student_id FROM public.users u2 WHERE u2.id = auth.uid() AND u2.student_id IS NOT NULL
    )
);
```

---

## 4. Rincian Implementasi per Komponen Frontend

### 4.1 Modul Utilitas Nilai (`src/utils/gradeUtils.js`)
- Memastikan `calculateAvgScore` memproses `0` dengan benar:
  ```js
  export function calculateAvgScore(attitudeScore, skillScore, activityScore) {
    const scores = [attitudeScore, skillScore, activityScore].filter(
      (v) => v !== null && v !== undefined && v !== ''
    ).map(v => Number(v))
    if (scores.length === 0) return 0
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }
  ```
- Predikat tetap konsisten: A (>=90), B (>=75), C (>=60), D (<60).

### 4.2 Halaman Pelatih (`src/pages/coach/CoachGrades.jsx`)
1. **Validasi Input 0-100:**
   - Menghandle nilai `'0'` sebagai angka `0` sah.
   - String kosong `''` disimpan sebagai `null`.
   - Mengubah placeholder menjadi `"0-100"`.
   - Pengecekan real-time: `if (value !== '') { const num = parseInt(value); if (isNaN(num) || num < 0 || num > 100) return; }`.
2. **Komponen Modal `StudentGradeHistoryModal`:**
   - Ditrigger dari tombol aksi bertema pixel retro pada baris siswa: `<History className="w-4 h-4" />`.
   - **Tab 1 (Riwayat Semester):** Menampilkan pergerakan nilai siswa di ekskul tersebut, visualisasi mini chart tren, dan catatan semester lalu.
   - **Tab 2 (Log Revisi):** Mengambil data dari `grade_audit_logs` untuk siswa dan ekskul terpilih.
3. **Quick Assist Nilai Keaktifan:**
   - Tombol klik cepat untuk menyalin persentase kehadiran ke kolom aktivitas (`activity_score`).

### 4.3 Halaman Siswa (`src/pages/student/StudentGrades.jsx`)
1. **Navigasi Tab Retro:**
   - **Tab "Semester Ini":** Radar Chart perbandingan ekskul & kartu rincian nilai.
   - **Tab "Riwayat & Tren":**
     - Dropdown filter ekskul.
     - Line Chart perkembangan nilai rata-rata per semester.
     - Linimasa vertikal berisi riwayat nilai, predikat, tanggal dinilai, dan catatan pelatih.
2. **Hook `useGradesHistory`:**
   - Hook terpisah atau ekstensi dari `useGrades` yang mengambil seluruh nilai historis siswa beserta detail audit ringkas.

### 4.4 Halaman Orang Tua (`src/pages/parent/ParentGrades.jsx`)
1. **Navigasi Tab:** Identik dengan siswa untuk anak yang dipilih.
2. **Cetak PDF Rapor Kumulatif (`exportCumulativePDF`):**
   - Menggunakan `jspdf` dan `jspdf-autotable`.
   - Dilengkapi Kop Surat resmi via `addKopSuratToPDF`.
   - Merangkum tabel riwayat nilai lengkap dari awal terdaftar hingga semester aktif.

### 4.5 Halaman Admin (`src/pages/admin/RecapManagement.jsx`)
1. **Aksi "Riwayat Siswa" pada Tab Laporan Nilai:**
   - Membuka modal rekam jejak nilai seluruh ekskul yang pernah diikuti siswa tersebut.
2. **Modul / Sub-tab "Log Audit Nilai":**
   - Menampilkan tabel data dari `grade_audit_logs`.
   - Fitur pencarian nama siswa, filter ekskul, filter pengubah.
   - Tombol "Ekspor Log ke Excel" via library `xlsx`.

---

## 5. Rencana Pengujian & Verifikasi

1. **Uji Nilai Batas (Boundary Tests):**
   - Input nilai `0`: tersimpan sebagai integer `0`, rata-rata terhitung benar.
   - Input nilai `100`: tersimpan sebagai `100`.
   - Input nilai negatif (`-1`) atau `101`: ditolak oleh validasi UI dan constraint DB.
   - Input kosong `""`: tersimpan sebagai `NULL`.
2. **Uji Trigger Audit Log:**
   - Simpan nilai pertama kali $\rightarrow$ terekam baris `INSERT` di `grade_audit_logs`.
   - Edit nilai yang sudah ada $\rightarrow$ terekam baris `UPDATE` dengan nilai lama vs nilai baru.
   - Simpan tanpa mengubah nilai $\rightarrow$ trigger tidak membuat log ganda (karena pengecekan `IS DISTINCT FROM`).
3. **Uji Akses Role (RLS):**
   - Siswa & Orang Tua hanya bisa melihat nilai & log milik sendiri/anaknya.
   - Pelatih hanya melihat log ekskul binaannya.
   - Admin memiliki akses penuh ke seluruh rekap dan log audit.
4. **Uji UI/UX Responsif:**
   - Tampilan modal dan tab bekerja optimal di layar desktop dan mobile.

