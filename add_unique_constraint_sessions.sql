-- ==========================================
-- Migration: Tambah Unique Constraint pada tabel sessions
-- ==========================================
-- Constraint ini memastikan 1 ekskul hanya memiliki maksimal 1 sesi per tanggal.

-- 1. Deteksi data duplikat yang ada saat ini (jika ada):
-- SELECT extracurricular_id, session_date, COUNT(*)
-- FROM public.sessions
-- GROUP BY extracurricular_id, session_date
-- HAVING COUNT(*) > 1;

-- 2. Bersihkan sesi duplikat secara aman
-- Prioritaskan mempertahankan sesi dengan jumlah kehadiran (attendances) terbanyak,
-- lalu sesi yang dibuat paling awal (created_at tertua).
WITH ranked_sessions AS (
  SELECT 
    s.id,
    ROW_NUMBER() OVER (
      PARTITION BY s.extracurricular_id, s.session_date
      ORDER BY 
        (SELECT COUNT(*) FROM public.attendances a WHERE a.session_id = s.id) DESC,
        s.created_at ASC,
        s.id ASC
    ) as rn
  FROM public.sessions s
)
DELETE FROM public.sessions
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);

-- 3. Tambahkan Unique Constraint
-- Catatan: PostgreSQL secara otomatis membuat unique index untuk constraint ini.
ALTER TABLE public.sessions 
  ADD CONSTRAINT unique_ekskul_session_date UNIQUE (extracurricular_id, session_date);
