-- ==========================================
-- MIGRATION: Triple Coach Support
-- Menambahkan kolom coach_id_3 pada tabel extracurriculars
-- agar 1 ekskul bisa di-handle 3 pelatih
-- ==========================================

-- Tambahkan kolom pelatih ketiga (opsional)
ALTER TABLE public.extracurriculars 
  ADD COLUMN IF NOT EXISTS coach_id_3 UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index untuk performa query pelatih ketiga
CREATE INDEX IF NOT EXISTS idx_extracurriculars_coach_id_3 ON public.extracurriculars(coach_id_3);

-- ==========================================
-- CATATAN:
-- Jalankan script ini di Supabase SQL Editor
-- sebelum menggunakan fitur triple pelatih.
-- ==========================================
