-- ==========================================
-- FUNGSI SQL UNTUK MEMBUAT USER OLEH ADMIN
-- ==========================================
-- Menjalankan ini di SQL Editor Supabase memungkinkan admin membuat user (pelatih/wali)
-- langsung dari panel admin tanpa mengganggu sesi admin yang sedang login.

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_student_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Berjalan dengan hak akses bypass RLS/admin
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- 1. Validasi pemanggil (harus admin)
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat membuat pengguna baru.';
  END IF;

  -- 2. Validasi input
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email tidak boleh kosong.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password minimal 6 karakter.';
  END IF;
  IF p_role NOT IN ('admin', 'coach', 'student', 'parent') THEN
    RAISE EXCEPTION 'Role tidak valid.';
  END IF;

  -- Check if email already exists in public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar.', p_email;
  END IF;

  -- Enkripsi password menggunakan bcrypt (biasanya pgcrypto sudah aktif di Supabase)
  v_encrypted_password := crypt(p_password, gen_salt('bf', 10));
  v_user_id := gen_random_uuid();

  -- 3. Insert ke tabel auth.users (Supabase Auth)
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

  -- 4. Insert ke tabel public.users (Profil kita)
  INSERT INTO public.users (id, full_name, email, role, student_id)
  VALUES (v_user_id, p_full_name, p_email, p_role, p_student_id);

  RETURN v_user_id;
END;
$$;
