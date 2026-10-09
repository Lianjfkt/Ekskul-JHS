-- =========================================================================
-- MIGRATION: COACH EVALUATIONS & BATCH STUDENT ACCOUNT STANDARDIZATION
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABEL PENILAIAN PELATIH OLEH SISWA (coach_evaluations)
CREATE TABLE IF NOT EXISTS public.coach_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extracurricular_id UUID NOT NULL REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    semester TEXT NOT NULL DEFAULT 'Ganjil',
    academic_year TEXT NOT NULL DEFAULT '2024/2025',
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_student_coach_eval UNIQUE(student_id, extracurricular_id, semester, academic_year)
);

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_coach_eval_coach_id ON public.coach_evaluations(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_eval_ekskul_id ON public.coach_evaluations(extracurricular_id);
CREATE INDEX IF NOT EXISTS idx_coach_eval_student_id ON public.coach_evaluations(student_id);

-- Aktifkan RLS
ALTER TABLE public.coach_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy RLS
DROP POLICY IF EXISTS "Student insert own evaluation" ON public.coach_evaluations;
CREATE POLICY "Student insert own evaluation" ON public.coach_evaluations
FOR INSERT WITH CHECK (
    student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Student view own evaluation" ON public.coach_evaluations;
CREATE POLICY "Student view own evaluation" ON public.coach_evaluations
FOR SELECT USING (
    student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Coach view assigned evaluations" ON public.coach_evaluations;
CREATE POLICY "Coach view assigned evaluations" ON public.coach_evaluations
FOR SELECT USING (
    coach_id = auth.uid() OR public.get_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admin manage all evaluations" ON public.coach_evaluations;
CREATE POLICY "Admin manage all evaluations" ON public.coach_evaluations
FOR ALL USING (
    public.get_user_role() = 'admin'
);


-- =========================================================================
-- 2. RPC STANDARISASI & RESET MASSAL AKUN SISWA UNTUK WALI KELAS
-- =========================================================================
-- Format Email: [NIS]@siswa.globalmadani.sch.id
-- Password Default: gm123456
-- Kembalian: Table berisi data akun untuk diekspor Excel ke wali kelas

CREATE OR REPLACE FUNCTION public.admin_batch_standardize_student_accounts()
RETURNS TABLE (
    nis TEXT,
    full_name TEXT,
    class TEXT,
    email TEXT,
    default_password TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role TEXT;
    v_student RECORD;
    v_target_email TEXT;
    v_default_pwd TEXT := 'gm123456';
    v_enc_pwd TEXT;
    v_existing_user_id UUID;
    v_new_user_id UUID;
BEGIN
    -- Validasi hanya admin yang boleh mengeksekusi
    SELECT role INTO v_admin_role FROM public.users WHERE id = auth.uid();
    IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menjalankan standarisasi akun.';
    END IF;

    -- Enkripsi password gm123456 sekali menggunakan pgcrypto
    v_enc_pwd := crypt(v_default_pwd, gen_salt('bf', 10));

    FOR v_student IN 
        SELECT s.id, s.nis, s.full_name, s.class 
        FROM public.students s 
        WHERE s.nis IS NOT NULL AND trim(s.nis) != ''
        ORDER BY s.class ASC, s.full_name ASC
    LOOP
        v_target_email := lower(trim(v_student.nis)) || '@siswa.globalmadani.sch.id';
        v_existing_user_id := NULL;

        -- 1. Cek apakah student ini sudah terhubung ke public.users
        SELECT u.id INTO v_existing_user_id 
        FROM public.users u 
        WHERE u.student_id = v_student.id 
        LIMIT 1;

        -- Jika belum ada di student_id, cek apakah ada user dengan email target
        IF v_existing_user_id IS NULL THEN
            SELECT u.id INTO v_existing_user_id 
            FROM public.users u 
            WHERE lower(u.email) = v_target_email 
            LIMIT 1;
        END IF;

        IF v_existing_user_id IS NOT NULL THEN
            -- UPDATE akun yang sudah ada
            UPDATE auth.users
            SET 
                email = v_target_email,
                encrypted_password = v_enc_pwd,
                email_confirmed_at = COALESCE(email_confirmed_at, now()),
                updated_at = now()
            WHERE id = v_existing_user_id;

            UPDATE public.users
            SET 
                email = v_target_email,
                full_name = v_student.full_name,
                role = 'student',
                student_id = v_student.id
            WHERE id = v_existing_user_id;

            nis := v_student.nis;
            full_name := v_student.full_name;
            class := v_student.class;
            email := v_target_email;
            default_password := v_default_pwd;
            status := 'Diperbarui';
            RETURN NEXT;
        ELSE
            -- BUAT akun baru
            v_new_user_id := gen_random_uuid();

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
                v_new_user_id,
                'authenticated',
                'authenticated',
                v_target_email,
                v_enc_pwd,
                now(),
                '{"provider": "email", "providers": ["email"]}'::jsonb,
                jsonb_build_object('full_name', v_student.full_name),
                now(),
                now(),
                '', '', '', ''
            );

            INSERT INTO public.users (id, full_name, email, role, student_id)
            VALUES (v_new_user_id, v_student.full_name, v_target_email, 'student', v_student.id);

            nis := v_student.nis;
            full_name := v_student.full_name;
            class := v_student.class;
            email := v_target_email;
            default_password := v_default_pwd;
            status := 'Dibuat Baru';
            RETURN NEXT;
        END IF;
    END LOOP;

    RETURN;
END;
$$;
