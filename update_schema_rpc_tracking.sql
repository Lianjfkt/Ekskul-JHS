-- update_schema_rpc_tracking.sql
-- Migrasi arsitektur: Memindahkan logika tracking siswa dan perhitungan statistik ke sisi DB

-- 1. Tipe data kembalian untuk Tracking Siswa
DROP TYPE IF EXISTS public.student_tracking_result CASCADE;
CREATE TYPE public.student_tracking_result AS (
    nis TEXT,
    full_name TEXT,
    class TEXT,
    gender TEXT,
    phone TEXT,
    has_account BOOLEAN,
    user_email TEXT,
    active_enrollments_count INTEGER,
    enrolled_ekskuls TEXT
);

-- 2. Fungsi untuk mendapatkan tracking siswa secara instan
CREATE OR REPLACE FUNCTION public.get_student_tracking_data()
RETURNS SETOF public.student_tracking_result
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.nis,
        m.full_name,
        m.class,
        m.gender,
        m.phone,
        (u.id IS NOT NULL) AS has_account,
        u.email AS user_email,
        COALESCE(e.active_enrollments_count, 0)::INTEGER AS active_enrollments_count,
        COALESCE(e.enrolled_ekskuls, '') AS enrolled_ekskuls
    FROM 
        public.student_master m
    LEFT JOIN 
        public.students s ON s.nis = m.nis
    LEFT JOIN 
        public.users u ON u.student_id = s.id AND u.role = 'student'
    LEFT JOIN (
        SELECT 
            en.student_id, 
            COUNT(en.id) AS active_enrollments_count,
            string_agg(ex.name, ', ') AS enrolled_ekskuls
        FROM public.enrollments en
        JOIN public.extracurriculars ex ON en.extracurricular_id = ex.id
        WHERE en.status = 'active'
        GROUP BY en.student_id
    ) e ON e.student_id = s.id
    ORDER BY m.full_name ASC;
END;
$$;

-- 3. Tipe data kembalian untuk Statistik Ekskul
DROP TYPE IF EXISTS public.ekskul_stats_result CASCADE;
CREATE TYPE public.ekskul_stats_result AS (
    name TEXT,
    jumlah_siswa INTEGER
);

-- 4. Fungsi untuk menghitung statistik ekskul secara instan
CREATE OR REPLACE FUNCTION public.get_ekskul_stats()
RETURNS SETOF public.ekskul_stats_result
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        ex.name,
        COUNT(en.id)::INTEGER AS jumlah_siswa
    FROM 
        public.extracurriculars ex
    LEFT JOIN 
        public.enrollments en ON en.extracurricular_id = ex.id AND en.status = 'active'
    GROUP BY 
        ex.id, ex.name
    ORDER BY 
        jumlah_siswa DESC;
$$;
