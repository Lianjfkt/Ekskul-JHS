-- ==========================================
-- Migration: Tambah kolom ekskul wajib
-- ==========================================
-- Menambahkan kolom is_mandatory dan mandatory_class
-- ke tabel extracurriculars untuk membedakan
-- ekskul wajib (Pramuka kelas 7, Karate/Taekwondo kelas 8)
-- dengan ekskul pilihan

ALTER TABLE public.extracurriculars 
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mandatory_class TEXT DEFAULT NULL;

-- Contoh update untuk ekskul wajib yang sudah ada
-- (sesuaikan dengan nama ekskul yang ada di database Anda)
-- UPDATE public.extracurriculars SET is_mandatory = true, mandatory_class = '7' WHERE name ILIKE '%pramuka%';
-- UPDATE public.extracurriculars SET is_mandatory = true, mandatory_class = '8' WHERE name ILIKE '%karate%' AND name NOT ILIKE '%7%' AND name NOT ILIKE '%8,9%';
-- UPDATE public.extracurriculars SET is_mandatory = true, mandatory_class = '8' WHERE name ILIKE '%taekwondo%' AND name NOT ILIKE '%7%' AND name NOT ILIKE '%8,9%';

COMMENT ON COLUMN public.extracurriculars.is_mandatory IS 'True jika ekskul ini wajib diikuti oleh kelas tertentu';
COMMENT ON COLUMN public.extracurriculars.mandatory_class IS 'Kelas yang diwajibkan mengikuti ekskul ini (contoh: 7, 8, 9, atau all)';
