-- =========================================================================
-- MIGRATION: STANDARISASI NILAI 0-100 & TABEL AUDIT LOG RIWAYAT NILAI
-- =========================================================================

-- 1. Perbarui Constraint Rentang Nilai (0 - 100 atau NULL) pada public.grades
ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_attitude_score_check,
  ADD CONSTRAINT grades_attitude_score_check 
    CHECK (attitude_score IS NULL OR (attitude_score >= 0 AND attitude_score <= 100));

ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_skill_score_check,
  ADD CONSTRAINT grades_skill_score_check 
    CHECK (skill_score IS NULL OR (skill_score >= 0 AND skill_score <= 100));

ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_activity_score_check,
  ADD CONSTRAINT grades_activity_score_check 
    CHECK (activity_score IS NULL OR (activity_score >= 0 AND activity_score <= 100));

-- 2. Buat Tabel Log Audit Nilai (grade_audit_logs)
CREATE TABLE IF NOT EXISTS public.grade_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    extracurricular_id UUID REFERENCES public.extracurriculars(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    action TEXT CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    old_scores JSONB,
    new_scores JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Performa
CREATE INDEX IF NOT EXISTS idx_grade_audit_student_id ON public.grade_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_ekskul_id ON public.grade_audit_logs(extracurricular_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_changed_at ON public.grade_audit_logs(changed_at DESC);

-- 3. Fungsi Trigger Otomatis Pencatatan Audit Nilai
CREATE OR REPLACE FUNCTION public.trg_log_grade_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.grade_audit_logs (
            grade_id, student_id, extracurricular_id, semester, academic_year,
            action, changed_by, old_scores, new_scores, changed_at
        ) VALUES (
            NEW.id, NEW.student_id, NEW.extracurricular_id, NEW.semester, NEW.academic_year,
            'INSERT', COALESCE(v_user_id, NEW.graded_by),
            NULL,
            jsonb_build_object(
                'attitude_score', NEW.attitude_score,
                'skill_score', NEW.skill_score,
                'activity_score', NEW.activity_score,
                'notes', NEW.notes
            ),
            timezone('utc'::text, now())
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Catat hanya jika terdapat perubahan nilai atau catatan
        IF (OLD.attitude_score IS DISTINCT FROM NEW.attitude_score OR
            OLD.skill_score IS DISTINCT FROM NEW.skill_score OR
            OLD.activity_score IS DISTINCT FROM NEW.activity_score OR
            OLD.notes IS DISTINCT FROM NEW.notes) THEN
            
            INSERT INTO public.grade_audit_logs (
                grade_id, student_id, extracurricular_id, semester, academic_year,
                action, changed_by, old_scores, new_scores, changed_at
            ) VALUES (
                NEW.id, NEW.student_id, NEW.extracurricular_id, NEW.semester, NEW.academic_year,
                'UPDATE', COALESCE(v_user_id, NEW.graded_by),
                jsonb_build_object(
                    'attitude_score', OLD.attitude_score,
                    'skill_score', OLD.skill_score,
                    'activity_score', OLD.activity_score,
                    'notes', OLD.notes
                ),
                jsonb_build_object(
                    'attitude_score', NEW.attitude_score,
                    'skill_score', NEW.skill_score,
                    'activity_score', NEW.activity_score,
                    'notes', NEW.notes
                ),
                timezone('utc'::text, now())
            );
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.grade_audit_logs (
            grade_id, student_id, extracurricular_id, semester, academic_year,
            action, changed_by, old_scores, new_scores, changed_at
        ) VALUES (
            OLD.id, OLD.student_id, OLD.extracurricular_id, OLD.semester, OLD.academic_year,
            'DELETE', v_user_id,
            jsonb_build_object(
                'attitude_score', OLD.attitude_score,
                'skill_score', OLD.skill_score,
                'activity_score', OLD.activity_score,
                'notes', OLD.notes
            ),
            NULL,
            timezone('utc'::text, now())
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_grades_audit ON public.grades;
CREATE TRIGGER trg_grades_audit
AFTER INSERT OR UPDATE OR DELETE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.trg_log_grade_changes();

-- 4. Aktifkan RLS & Kebijakan Hak Akses
ALTER TABLE public.grade_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin kelola grade_audit_logs" ON public.grade_audit_logs;
CREATE POLICY "Admin kelola grade_audit_logs"
ON public.grade_audit_logs FOR ALL
USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Coach baca grade_audit_logs binaannya" ON public.grade_audit_logs;
CREATE POLICY "Coach baca grade_audit_logs binaannya"
ON public.grade_audit_logs FOR SELECT
USING (
    public.get_user_role() = 'coach' AND
    extracurricular_id IN (
        SELECT id FROM public.extracurriculars 
        WHERE coach_id = auth.uid() OR coach_id_2 = auth.uid() OR coach_id_3 = auth.uid()
    )
);

DROP POLICY IF EXISTS "Siswa baca grade_audit_logs sendiri" ON public.grade_audit_logs;
CREATE POLICY "Siswa baca grade_audit_logs sendiri"
ON public.grade_audit_logs FOR SELECT
USING (
    student_id IN (SELECT student_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Parent baca nilai anak" ON public.grades;
CREATE POLICY "Parent baca nilai anak"
ON public.grades FOR SELECT
USING (
    public.get_user_role() = 'parent' AND
    student_id IN (
        SELECT p.student_id FROM public.parents p
        JOIN public.users u ON lower(trim(u.full_name)) = lower(trim(p.full_name))
        WHERE u.id = auth.uid()
        UNION
        SELECT u2.student_id FROM public.users u2 WHERE u2.id = auth.uid() AND u2.student_id IS NOT NULL
    )
);

DROP POLICY IF EXISTS "Parent baca grade_audit_logs anak" ON public.grade_audit_logs;
CREATE POLICY "Parent baca grade_audit_logs anak"
ON public.grade_audit_logs FOR SELECT
USING (
    public.get_user_role() = 'parent' AND
    student_id IN (
        SELECT p.student_id FROM public.parents p
        JOIN public.users u ON lower(trim(u.full_name)) = lower(trim(p.full_name))
        WHERE u.id = auth.uid()
        UNION
        SELECT u2.student_id FROM public.users u2 WHERE u2.id = auth.uid() AND u2.student_id IS NOT NULL
    )
);

-- Reload postgrest schema cache
NOTIFY pgrst, 'reload schema';
