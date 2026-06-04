-- ==========================================
-- 9. Tabel announcements (Pengumuman Global)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua user bisa melihat pengumuman" 
ON public.announcements FOR SELECT USING (true);

CREATE POLICY "Hanya Admin yang bisa mengelola pengumuman" 
ON public.announcements FOR ALL USING (public.get_user_role() = 'admin');


-- ==========================================
-- 10. Tabel audit_logs (Log Aktivitas Keamanan)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hanya Admin yang bisa melihat log audit" 
ON public.audit_logs FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY "Semua user terotentikasi bisa memasukkan log audit" 
ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
