-- ==========================================
-- UPDATE SCHEMA: Sesi Latihan Khusus (Persiapan Lomba)
-- ==========================================

-- 1. Tambah kolom pada tabel sessions
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS is_special_training BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS event_name TEXT;

-- 2. Buat tabel special_session_participants
CREATE TABLE IF NOT EXISTS public.special_session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, student_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_special_session_participants_session_id ON public.special_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_special_session_participants_student_id ON public.special_session_participants(student_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.special_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua bisa melihat peserta khusus" 
ON public.special_session_participants FOR SELECT 
USING (true);

CREATE POLICY "Admin dan Coach bisa ubah peserta khusus" 
ON public.special_session_participants FOR ALL 
USING (public.get_user_role() IN ('admin', 'coach'));
