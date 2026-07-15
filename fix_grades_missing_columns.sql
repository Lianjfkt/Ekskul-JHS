-- ==========================================
-- FIX: Tambahkan kolom yang hilang di tabel grades
-- Error: "Could not find the 'activity_score' column of 'grades' in the schema cache"
-- ==========================================

-- 1. Tambahkan kolom activity_score jika belum ada
ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS activity_score INTEGER 
CHECK (activity_score >= 0 AND activity_score <= 100);

-- 2. Pastikan kolom lain yang diperlukan CoachGrades.jsx juga ada
ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS attitude_score INTEGER 
CHECK (attitude_score >= 0 AND attitude_score <= 100);

ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS skill_score INTEGER 
CHECK (skill_score >= 0 AND skill_score <= 100);

ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 3. Reload schema cache Supabase (PostgREST)
-- Jalankan ini SETELAH ALTER TABLE di atas
NOTIFY pgrst, 'reload schema';
