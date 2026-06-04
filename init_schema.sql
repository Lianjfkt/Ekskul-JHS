-- Aktifkan ekstensi untuk UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Tabel students
-- ==========================================
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nis TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    class TEXT NOT NULL,
    gender TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. Tabel users
-- ==========================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Terhubung dengan Supabase Auth
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'coach', 'student', 'parent')) NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. Tabel extracurriculars
-- ==========================================
CREATE TABLE public.extracurriculars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    schedule TEXT,
    coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 4. Tabel enrollments
-- ==========================================
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    extracurricular_id UUID REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. Tabel sessions
-- ==========================================
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extracurricular_id UUID REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    topic TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 6. Tabel attendances
-- ==========================================
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('hadir', 'izin', 'alpha')) NOT NULL,
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 7. Tabel grades
-- ==========================================
CREATE TABLE public.grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    extracurricular_id UUID REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    attitude_score INTEGER CHECK (attitude_score >= 0 AND attitude_score <= 100),
    skill_score INTEGER CHECK (skill_score >= 0 AND skill_score <= 100),
    activity_score INTEGER CHECK (activity_score >= 0 AND activity_score <= 100),
    notes TEXT,
    graded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 8. Tabel parents
-- ==========================================
CREATE TABLE public.parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    relationship TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_users_student_id ON public.users(student_id);
CREATE INDEX idx_extracurriculars_coach_id ON public.extracurriculars(coach_id);
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_extracurricular_id ON public.enrollments(extracurricular_id);
CREATE INDEX idx_sessions_extracurricular_id ON public.sessions(extracurricular_id);
CREATE INDEX idx_attendances_session_id ON public.attendances(session_id);
CREATE INDEX idx_attendances_student_id ON public.attendances(student_id);
CREATE INDEX idx_grades_student_id ON public.grades(student_id);
CREATE INDEX idx_grades_extracurricular_id ON public.grades(extracurricular_id);
CREATE INDEX idx_parents_student_id ON public.parents(student_id);


-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Fungsi bantuan untuk mengecek role user saat ini
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Aktifkan RLS di semua tabel
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracurriculars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;


-- POLICIES: students
CREATE POLICY "Admin and Coach can read students" ON public.students FOR SELECT USING (public.get_user_role() IN ('admin', 'coach'));
CREATE POLICY "Admin can all students" ON public.students FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "Student read own data" ON public.students FOR SELECT USING (id IN (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- POLICIES: users
CREATE POLICY "Semua user bisa melihat user lain (opsional, disesuaikan)" ON public.users FOR SELECT USING (true);
CREATE POLICY "Hanya Admin yang bisa ubah user" ON public.users FOR ALL USING (public.get_user_role() = 'admin');

-- POLICIES: extracurriculars
CREATE POLICY "Semua bisa melihat ekskul" ON public.extracurriculars FOR SELECT USING (true);
CREATE POLICY "Admin bisa ubah ekskul" ON public.extracurriculars FOR ALL USING (public.get_user_role() = 'admin');

-- POLICIES: enrollments
CREATE POLICY "Semua bisa melihat enrollment" ON public.enrollments FOR SELECT USING (true);
CREATE POLICY "Admin dan Coach bisa ubah enrollment" ON public.enrollments FOR ALL USING (public.get_user_role() IN ('admin', 'coach'));

-- POLICIES: sessions
CREATE POLICY "Semua bisa melihat session" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Admin dan Coach bisa ubah session" ON public.sessions FOR ALL USING (public.get_user_role() IN ('admin', 'coach'));

-- POLICIES: attendances
CREATE POLICY "Admin, Coach baca absensi" ON public.attendances FOR SELECT USING (public.get_user_role() IN ('admin', 'coach'));
CREATE POLICY "Admin, Coach ubah absensi" ON public.attendances FOR ALL USING (public.get_user_role() IN ('admin', 'coach'));
CREATE POLICY "Siswa baca absensi sendiri" ON public.attendances FOR SELECT USING (student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- POLICIES: grades
CREATE POLICY "Admin, Coach baca nilai" ON public.grades FOR SELECT USING (public.get_user_role() IN ('admin', 'coach'));
CREATE POLICY "Admin, Coach ubah nilai" ON public.grades FOR ALL USING (public.get_user_role() IN ('admin', 'coach'));
CREATE POLICY "Siswa baca nilai sendiri" ON public.grades FOR SELECT USING (student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid()));

-- POLICIES: parents
CREATE POLICY "Admin baca ortu" ON public.parents FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin ubah ortu" ON public.parents FOR ALL USING (public.get_user_role() = 'admin');


-- ==========================================
-- DATABASE FUNCTION: get_attendance_percentage
-- ==========================================
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
    -- Menghitung total sesi dari ekskul tersebut
    SELECT COUNT(*) INTO total_sessions
    FROM public.sessions s
    WHERE s.extracurricular_id = p_extracurricular_id;

    -- Jika belum ada sesi sama sekali, kembalikan 0
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

-- ==========================================
-- INSERT FIRST ADMIN USER
-- ==========================================
-- Menggunakan UID yang baru dibuat dari Supabase Auth
INSERT INTO public.users (id, full_name, email, role)
VALUES (
  '91ba6d20-4bef-4c61-b0bb-5b1125abf1d5',
  'Administrator Utama',
  'admin@sekolah.com', -- Pastikan email ini sama dengan email yang didaftarkan di Supabase Auth
  'admin'
);
