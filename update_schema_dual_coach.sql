-- ==========================================
-- MIGRATION: Dual Coach Support
-- Menambahkan kolom coach_id_2 pada tabel extracurriculars
-- agar 1 ekskul bisa di-handle 2 pelatih
-- ==========================================

-- Tambahkan kolom pelatih kedua (opsional)
ALTER TABLE public.extracurriculars 
  ADD COLUMN IF NOT EXISTS coach_id_2 UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index untuk performa query pelatih kedua
CREATE INDEX IF NOT EXISTS idx_extracurriculars_coach_id_2 ON public.extracurriculars(coach_id_2);

-- ==========================================
-- CATATAN:
-- Jalankan script ini di Supabase SQL Editor
-- sebelum menggunakan fitur dual pelatih.
-- ==========================================
