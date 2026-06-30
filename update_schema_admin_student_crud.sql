-- ==========================================
-- FUNGSI SQL TAMBAHAN UNTUK CRUD USER OLEH ADMIN
-- ==========================================

-- 1. Fungsi RPC untuk memperbarui data user (email, password, nama, dan relasi siswa) oleh Admin
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id UUID,
  p_email TEXT,
  p_password TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_student_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Hak akses bypass RLS
AS $$
BEGIN
  -- Validasi pemanggil (harus admin)
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat mengubah pengguna.';
  END IF;

  -- Validasi input email
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email tidak boleh kosong.';
  END IF;

  -- Periksa apakah email sudah digunakan oleh user lain
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email AND id != p_user_id) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar pada pengguna lain.', p_email;
  END IF;

  -- Update auth.users (Supabase Auth)
  UPDATE auth.users
  SET 
    email = p_email,
    encrypted_password = CASE WHEN p_password IS NOT NULL AND p_password != '' THEN crypt(p_password, gen_salt('bf', 10)) ELSE encrypted_password END,
    raw_user_meta_data = CASE WHEN p_full_name IS NOT NULL THEN jsonb_build_object('full_name', p_full_name) ELSE raw_user_meta_data END,
    updated_at = now()
  WHERE id = p_user_id;

  -- Update public.users
  UPDATE public.users
  SET
    email = p_email,
    full_name = COALESCE(p_full_name, full_name),
    student_id = p_student_id
  WHERE id = p_user_id;
END;
$$;

-- 2. Fungsi RPC untuk menghapus user secara bersih (auth.users + public.users) oleh Admin
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Hak akses bypass RLS
AS $$
BEGIN
  -- Validasi pemanggil (harus admin)
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus pengguna.';
  END IF;

  -- Hapus dari auth.users (akan cascade menghapus di public.users)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
