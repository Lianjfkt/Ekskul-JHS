-- ==========================================
-- FIX: Tracking Pengisian - Flag Absensi Sudah Diisi
-- ==========================================
-- Bug: Ekskul tanpa siswa terdaftar (enrollment = 0) tidak bisa menyimpan
-- record di tabel attendances, sehingga tracking selalu mendeteksi
-- "Belum Mengisi Absen" meski pelatih sudah membuka dan menyimpan absensi.
--
-- Solusi: Tambah kolom `attendance_submitted` di tabel sessions sebagai
-- flag eksplisit bahwa pelatih sudah melakukan proses absensi.
-- ==========================================

-- 1. Tambah kolom flag pada tabel sessions
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS attendance_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attendance_submitted_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill: Sesi yang sudah punya record di attendances dianggap sudah disubmit
UPDATE public.sessions s
SET 
  attendance_submitted = true,
  attendance_submitted_at = (
    SELECT MAX(a.recorded_at) 
    FROM public.attendances a 
    WHERE a.session_id = s.id
  )
WHERE EXISTS (
  SELECT 1 FROM public.attendances a WHERE a.session_id = s.id
);

-- 3. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_sessions_attendance_submitted 
ON public.sessions(attendance_submitted);

-- Verifikasi
SELECT 
  COUNT(*) FILTER (WHERE attendance_submitted = true) AS sudah_submit,
  COUNT(*) FILTER (WHERE attendance_submitted = false OR attendance_submitted IS NULL) AS belum_submit,
  COUNT(*) AS total
FROM public.sessions;
