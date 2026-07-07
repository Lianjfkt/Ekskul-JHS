-- ==========================================
-- MIGRATION: Multi-Coach Attendance in Sessions
-- Mendukung pencatatan lebih dari 1 pelatih yang hadir pada 1 sesi latihan
-- ==========================================

-- 1. Buat tabel penghubung kehadiran pelatih di sesi latihan
CREATE TABLE IF NOT EXISTS public.session_coaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    coach_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_session_coach UNIQUE (session_id, coach_id)
);

-- 2. Tambahkan index untuk optimasi performa query
CREATE INDEX IF NOT EXISTS idx_session_coaches_session_id ON public.session_coaches(session_id);
CREATE INDEX IF NOT EXISTS idx_session_coaches_coach_id ON public.session_coaches(coach_id);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.session_coaches ENABLE ROW LEVEL SECURITY;

-- 4. Buat Kebijakan RLS (Policies)
CREATE POLICY "Semua bisa melihat pelatih yang hadir di sesi" 
  ON public.session_coaches FOR SELECT USING (true);

CREATE POLICY "Admin dan Coach bisa mengubah pelatih di sesi" 
  ON public.session_coaches FOR ALL USING (public.get_user_role() IN ('admin', 'coach'));

-- 5. Migrasi data lama dari sessions.handled_by ke tabel baru (jika kolom itu ada dan memiliki data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='sessions' AND column_name='handled_by'
  ) THEN
    INSERT INTO public.session_coaches (session_id, coach_id)
    SELECT id, handled_by 
    FROM public.sessions 
    WHERE handled_by IS NOT NULL
    ON CONFLICT (session_id, coach_id) DO NOTHING;
  END IF;
END $$;
