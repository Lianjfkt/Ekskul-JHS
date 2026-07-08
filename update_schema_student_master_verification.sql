-- ==========================================
-- UPDATE SCHEMA: STUDENT MASTER REFERENCE & VERIFICATION
-- ==========================================

-- 1. Buat Tabel Data Acuan Siswa Sekolah (student_master)
CREATE TABLE IF NOT EXISTS public.student_master (
    nis TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    class TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Laki-laki', 'Perempuan')),
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan Row Level Security (RLS) di tabel student_master
ALTER TABLE public.student_master ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan RLS: Hanya Admin yang dapat mengelola tabel student_master
DROP POLICY IF EXISTS "Admin can all student_master" ON public.student_master;
CREATE POLICY "Admin can all student_master" ON public.student_master 
FOR ALL USING (public.get_user_role() = 'admin');

-- 4. Perbarui RPC Function student_self_register untuk melakukan validasi terhadap data acuan
CREATE OR REPLACE FUNCTION public.student_self_register(
  p_email TEXT,
  p_password TEXT,
  p_nis TEXT,
  p_full_name TEXT,
  p_class TEXT,
  p_gender TEXT,
  p_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Berjalan bypass RLS untuk insert siswa & user baru
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_encrypted_password TEXT;
  
  -- Variabel untuk menampung data master
  v_master_name TEXT;
  v_master_class TEXT;
  v_master_gender TEXT;
  v_master_phone TEXT;
BEGIN
  -- Validasi input dasar
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email tidak boleh kosong.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password minimal 6 karakter.';
  END IF;
  IF p_nis IS NULL OR p_nis = '' THEN
    RAISE EXCEPTION 'NIS tidak boleh kosong.';
  END IF;

  -- 1. Validasi NIS terhadap tabel student_master (Data Acuan Sekolah)
  SELECT full_name, class, gender, phone 
  INTO v_master_name, v_master_class, v_master_gender, v_master_phone
  FROM public.student_master
  WHERE nis = p_nis;

  IF v_master_name IS NULL THEN
    RAISE EXCEPTION 'NIS % tidak terdaftar di database sekolah. Silakan hubungi admin sekolah.', p_nis;
  END IF;

  -- 2. Periksa apakah NIS sudah terdaftar memiliki akun di tabel students
  IF EXISTS (SELECT 1 FROM public.students WHERE nis = p_nis) THEN
    RAISE EXCEPTION 'NIS % sudah terdaftar memiliki akun. Silakan login atau hubungi admin.', p_nis;
  END IF;

  -- 3. Periksa apakah email sudah terdaftar
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email % sudah digunakan oleh akun lain.', p_email;
  END IF;

  -- A. Simpan data ke tabel public.students
  -- Kami menggunakan Nama, Kelas, dan Gender resmi dari data acuan (student_master) demi integritas data
  v_student_id := gen_random_uuid();
  INSERT INTO public.students (id, nis, full_name, class, gender, phone)
  VALUES (
    v_student_id, 
    p_nis, 
    v_master_name, 
    v_master_class, 
    v_master_gender, 
    COALESCE(NULLIF(p_phone, ''), v_master_phone)
  );

  -- Enkripsi password menggunakan bcrypt
  v_encrypted_password := crypt(p_password, gen_salt('bf', 10));
  v_user_id := gen_random_uuid();

  -- B. Simpan data akun ke tabel auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    now(), -- Auto-confirm email
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', v_master_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- C. Hubungkan akun ke tabel profil public.users
  INSERT INTO public.users (id, full_name, email, role, student_id)
  VALUES (v_user_id, v_master_name, p_email, 'student', v_student_id);

  RETURN v_user_id;
END;
$$;
