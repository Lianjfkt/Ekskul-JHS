-- ==========================================
-- FIX: Sync students → student_master
-- dan update RPC agar gunakan students sebagai sumber utama
-- ==========================================

-- 1. Sinkronisasi data siswa yang sudah ada ke student_master
--    (ON CONFLICT DO NOTHING = skip jika NIS sudah ada)
INSERT INTO public.student_master (nis, full_name, class, gender, phone)
SELECT 
    s.nis,
    s.full_name,
    s.class,
    s.gender,
    s.phone
FROM public.students s
ON CONFLICT (nis) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    class = EXCLUDED.class,
    gender = EXCLUDED.gender,
    phone = EXCLUDED.phone;

-- 2. Update RPC get_student_tracking_data
--    Gunakan UNION agar menampilkan:
--    - Siswa dari student_master (rencana acuan sekolah)
--    - PLUS siswa dari students yang mungkin belum masuk student_master
CREATE OR REPLACE FUNCTION public.get_student_tracking_data()
RETURNS SETOF public.student_tracking_result
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH all_students AS (
        -- Siswa dari student_master (data acuan resmi sekolah)
        SELECT 
            sm.nis,
            sm.full_name,
            sm.class,
            sm.gender,
            sm.phone
        FROM public.student_master sm

        UNION

        -- Siswa yang sudah punya akun tapi mungkin belum ada di student_master
        SELECT 
            s.nis,
            s.full_name,
            s.class,
            s.gender,
            s.phone
        FROM public.students s
        WHERE s.nis NOT IN (SELECT nis FROM public.student_master)
    )
    SELECT 
        a.nis,
        a.full_name,
        a.class,
        a.gender,
        a.phone,
        (u.id IS NOT NULL) AS has_account,
        u.email AS user_email,
        COALESCE(e.active_enrollments_count, 0)::INTEGER AS active_enrollments_count,
        COALESCE(e.enrolled_ekskuls, '') AS enrolled_ekskuls
    FROM 
        all_students a
    LEFT JOIN 
        public.students s ON s.nis = a.nis
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
    ORDER BY a.class ASC, a.full_name ASC;
END;
$$;

-- 3. Beri akses baca student_master untuk coach juga (opsional tapi berguna)
DROP POLICY IF EXISTS "Coach can read student_master" ON public.student_master;
CREATE POLICY "Coach can read student_master" ON public.student_master 
FOR SELECT USING (public.get_user_role() IN ('admin', 'coach'));
