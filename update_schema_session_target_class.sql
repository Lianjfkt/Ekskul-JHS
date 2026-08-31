-- ==========================================
-- MIGRATION: Session Target Class Support
-- Menambahkan kolom target_class pada tabel sessions
-- agar sesi latihan dapat ditargetkan untuk kelas tertentu (misal: '7', '8', '9')
-- ==========================================

-- Tambah kolom target_class dengan default 'all' (semua kelas)
ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS target_class TEXT DEFAULT 'all';

-- Index untuk optimasi query berdasarkan target_class
CREATE INDEX IF NOT EXISTS idx_sessions_target_class ON public.sessions(target_class);
