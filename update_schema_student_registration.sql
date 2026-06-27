-- ==========================================
-- UPDATE SCHEMA FOR STUDENT SELF-ENROLLMENT & SIGNUP
-- ==========================================

-- 1. Tambah policy untuk siswa mengupdate data diri mereka di tabel students
DROP POLICY IF EXISTS "Student update own data" ON public.students;
CREATE POLICY "Student update own data" ON public.students 
FOR UPDATE 
USING (id IN (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- 2. Tambah policy untuk siswa melakukan pendaftaran mandiri (insert) ke tabel enrollments
DROP POLICY IF EXISTS "Student can insert own enrollment" ON public.enrollments;
CREATE POLICY "Student can insert own enrollment" ON public.enrollments 
FOR INSERT 
WITH CHECK (
  student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
  AND status = 'pending'
);

-- 3. Tambah policy agar siswa dapat menghapus pendaftaran mereka sendiri jika statusnya masih 'pending'
DROP POLICY IF EXISTS "Student can delete own pending enrollment" ON public.enrollments;
CREATE POLICY "Student can delete own pending enrollment" ON public.enrollments 
FOR DELETE 
USING (
  student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
  AND status = 'pending'
);

-- 4. RPC Function untuk pendaftaran akun siswa baru (Signup) beserta data diri awal
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
BEGIN
  -- Validasi input
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email tidak boleh kosong.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password minimal 6 karakter.';
  END IF;
  IF p_nis IS NULL OR p_nis = '' THEN
    RAISE EXCEPTION 'NIS tidak boleh kosong.';
  END IF;
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Nama Lengkap tidak boleh kosong.';
  END IF;
  IF p_class IS NULL OR p_class = '' THEN
    RAISE EXCEPTION 'Kelas tidak boleh kosong.';
  END IF;

  -- Periksa apakah NIS sudah terdaftar
  IF EXISTS (SELECT 1 FROM public.students WHERE nis = p_nis) THEN
    RAISE EXCEPTION 'NIS % sudah terdaftar.', p_nis;
  END IF;

  -- Periksa apakah email sudah terdaftar
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar.', p_email;
  END IF;

  -- A. Simpan data ke tabel public.students
  v_student_id := gen_random_uuid();
  INSERT INTO public.students (id, nis, full_name, class, gender, phone)
  VALUES (v_student_id, p_nis, p_full_name, p_class, p_gender, p_phone);

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
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- C. Hubungkan akun ke tabel profil public.users
  INSERT INTO public.users (id, full_name, email, role, student_id)
  VALUES (v_user_id, p_full_name, p_email, 'student', v_student_id);

  RETURN v_user_id;
END;
$$;
