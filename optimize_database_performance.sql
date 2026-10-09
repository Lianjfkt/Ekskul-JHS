-- =========================================================================
-- OPTIMASI PERFORMA DATABASE SUPABASE & ROW LEVEL SECURITY (RLS)
-- Jalankan script SQL ini di Supabase SQL Editor untuk mempercepat query 
-- dan mengatasi loading data lama di semua role (Admin, Pelatih, Siswa, Ortu).
-- =========================================================================

-- 1. Optimasi Fungsi get_user_role()
-- Jadikan STABLE agar PostgreSQL meng-cache hasil role user per transaksi/query,
-- BUKAN mengeksekusi subquery ulang untuk setiap baris data (row scan).
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 2. Composite Index untuk Absensi & Sesi
-- Sangat krusial karena tabel attendances bertambah setiap pertemuan
CREATE INDEX IF NOT EXISTS idx_attendances_session_student ON public.attendances(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student_status ON public.attendances(student_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_ekskul_date ON public.sessions(extracurricular_id, session_date DESC);

-- 3. Composite Index untuk Pendaftaran Ekskul (Enrollments)
CREATE INDEX IF NOT EXISTS idx_enrollments_ekskul_status ON public.enrollments(extracurricular_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status ON public.enrollments(student_id, status);

-- 4. Indeks Siswa & Pengguna
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_students_nis ON public.students(nis);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class);

-- 5. Indeks Notifikasi
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- Selesai! Query dashboard & evaluasi RLS kini jauh lebih ringan dan instan.
