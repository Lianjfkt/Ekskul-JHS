-- ==========================================
-- Migration: Tambah Unique Constraint pada tabel sessions
-- ==========================================
-- Constraint ini memastikan 1 ekskul hanya memiliki maksimal 1 sesi per tanggal.

-- 1. Deteksi data duplikat yang ada saat ini (jika ada):
-- SELECT extracurricular_id, session_date, COUNT(*)
-- FROM public.sessions
-- GROUP BY extracurricular_id, session_date
-- HAVING COUNT(*) > 1;

-- 2. Bersihkan sesi duplikat (pertahankan sesi yang memiliki data kehadiran terbanyak atau ID tertua)
DELETE FROM public.sessions
WHERE id IN (
  SELECT s.id
  FROM public.sessions s
  JOIN (
    SELECT extracurricular_id, session_date, MIN(id) as keep_id
    FROM public.sessions
    GROUP BY extracurricular_id, session_date
    HAVING COUNT(*) > 1
  ) dup ON s.extracurricular_id = dup.extracurricular_id 
       AND s.session_date = dup.session_date
       AND s.id != dup.keep_id
);

-- 3. Tambahkan Unique Constraint
ALTER TABLE public.sessions 
  ADD CONSTRAINT unique_ekskul_session_date UNIQUE (extracurricular_id, session_date);

-- 4. Indeks pendukung untuk performa query pencarian sesi berdasarkan tanggal & ekskul
CREATE INDEX IF NOT EXISTS idx_sessions_ekskul_date_unique 
  ON public.sessions (extracurricular_id, session_date);
