-- ==========================================
-- MIGRATION: Database Fixes & Improvements
-- ==========================================

-- 1. Tambahkan kolom handled_by ke tabel sessions untuk melacak pelatih yang memimpin latihan secara spesifik
ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS handled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_handled_by ON public.sessions(handled_by);


-- 2. Perbaiki fungsi get_attendance_percentage agar pembagi didasarkan pada sesi yang diikuti siswa (lebih adil)
CREATE OR REPLACE FUNCTION public.get_attendance_percentage(p_student_id UUID, p_extracurricular_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_sessions INTEGER;
    attended_sessions INTEGER;
    percentage NUMERIC;
BEGIN
    -- Menghitung total sesi yang datanya telah direkam untuk siswa tersebut
    SELECT COUNT(*) INTO total_sessions
    FROM public.attendances a
    JOIN public.sessions s ON a.session_id = s.id
    WHERE a.student_id = p_student_id
      AND s.extracurricular_id = p_extracurricular_id;

    -- Jika belum ada sesi yang direkam, kembalikan 0
    IF total_sessions = 0 THEN
        RETURN 0;
    END IF;

    -- Menghitung total kehadiran siswa (hanya yang statusnya 'hadir')
    SELECT COUNT(*) INTO attended_sessions
    FROM public.attendances a
    JOIN public.sessions s ON a.session_id = s.id
    WHERE a.student_id = p_student_id
      AND s.extracurricular_id = p_extracurricular_id
      AND a.status = 'hadir';

    -- Menghitung persentase
    percentage := (attended_sessions::NUMERIC / total_sessions::NUMERIC) * 100;
    
    -- Membulatkan ke 2 angka di belakang koma
    RETURN ROUND(percentage, 2);
END;
$$;


-- 3. Perbaiki fungsi admin_delete_user agar juga membersihkan entri di public.parents agar tidak ada data sampah (orphan)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Hak akses bypass RLS
AS $$
DECLARE
  v_student_id UUID;
  v_full_name TEXT;
  v_role TEXT;
BEGIN
  -- Validasi pemanggil (harus admin)
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus pengguna.';
  END IF;

  -- Dapatkan info user sebelum dihapus untuk pembersihan public.parents
  SELECT student_id, full_name, role INTO v_student_id, v_full_name, v_role
  FROM public.users
  WHERE id = p_user_id;

  -- Jika role-nya parent, bersihkan data di tabel public.parents
  IF v_role = 'parent' AND v_student_id IS NOT NULL THEN
    DELETE FROM public.parents 
    WHERE student_id = v_student_id AND full_name = v_full_name;
  END IF;

  -- Hapus dari auth.users (akan cascade menghapus di public.users)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
