# Standarisasi Sistem Penilaian 0-100 & Riwayat Nilai Multi-Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menstandarisasi rentang penilaian menjadi 0–100 (di mana 0 adalah nilai sah dan kosong adalah null), menambahkan PostgreSQL audit log trigger untuk mencatat riwayat perubahan nilai, serta menyediakan antarmuka riwayat nilai (longitudinal & audit trail) untuk seluruh role (Pelatih, Siswa, Orang Tua, dan Admin).

**Architecture:** Menggunakan database migration SQL untuk memperbarui check constraint `grades` dan membuat tabel `grade_audit_logs` dengan trigger otomatis `AFTER INSERT OR UPDATE OR DELETE`. Di frontend, utilitas `gradeUtils.js` disempurnakan dengan unit tests, form pelatih diperbarui untuk validasi 0–100 dan modal riwayat siswa, halaman siswa dan orang tua dilengkapi tab linimasa & grafik tren perkembangan serta ekspor PDF kumulatif, dan halaman admin dilengkapi modal riwayat siswa serta modul log audit nilai dengan ekspor Excel.

**Tech Stack:** React 18, Vite, Tailwind CSS (Pixel Retro Theme), Supabase (PostgreSQL, Triggers, RLS), Recharts, jsPDF, jspdf-autotable, xlsx, Lucide React, Node.js built-in test runner (`node:test`, `node:assert/strict`).

## Global Constraints

- Nilai sah harus berupa bilangan bulat dari 0 hingga 100 inclusive (`0 <= score <= 100`).
- Angka `0` adalah nilai sah dan wajib diikutsertakan dalam kalkulasi rata-rata (`avg`).
- Input string kosong `""` harus disimpan sebagai `NULL` (belum dinilai) dan diabaikan dari pembagi rata-rata.
- Seluruh perubahan nilai dicatat otomatis via database trigger ke tabel `public.grade_audit_logs`.
- Desain antarmuka wajib mematuhi tema Pixel Retro sekolah (`font-pixel`, `font-retro`, `bg-pixel-panel`, `border-pixel-gray/30`, palet warna retro).
- Unit test menggunakan Node.js built-in test runner (`node:test` dan `node:assert/strict`).

---

### Task 1: Skrip Migrasi Skema Database & Trigger Audit Nilai

**Files:**
- Create: `update_schema_grades_history_and_audit.sql`

**Interfaces:**
- Produces: Skrip SQL DDL & DML untuk check constraints 0–100 pada `grades`, tabel `grade_audit_logs`, trigger `trg_grades_audit`, dan RLS policies untuk seluruh role.

- [ ] **Step 1: Buat file migrasi SQL `update_schema_grades_history_and_audit.sql`**

```sql
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
```

- [ ] **Step 2: Validasi isi skrip SQL**

Run: `grep -E "CHECK|grade_audit_logs|trg_grades_audit" update_schema_grades_history_and_audit.sql`  
Expected: Menampilkan baris check constraints 0–100, create table, dan trigger.

- [ ] **Step 3: Commit skrip migrasi SQL**

Run:
```bash
git add update_schema_grades_history_and_audit.sql
git commit -m "feat(db): add migration for 0-100 grade check constraint and grade audit logs trigger"
```

---

### Task 2: Grade Utilities & Range 0-100 Unit Tests

**Files:**
- Modify: `src/utils/gradeUtils.js`
- Create: `tests/gradeUtils.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `calculateAvgScore(attitudeScore, skillScore, activityScore)`, `getPredikat(avg)`, `enrichGradeStats(grade)`
- Produces: `calculateAvgScore` yang secara andal menangani `0` sebagai skor valid dan `null`/`undefined`/`''` sebagai kosong.

- [ ] **Step 1: Tulis tes unit gagal untuk utilitas nilai**

Create file `tests/gradeUtils.test.js`:
```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAvgScore, getPredikat, enrichGradeStats } from '../src/utils/gradeUtils.js'

describe('gradeUtils', () => {
  it('correctly calculates average when 0 is given as a valid score', () => {
    // 0 is a valid score, not omitted!
    // (0 + 60 + 60) / 3 = 40
    assert.equal(calculateAvgScore(0, 60, 60), 40)
    // 0 alone: 0 / 1 = 0
    assert.equal(calculateAvgScore(0, null, null), 0)
    // (0 + 100) / 2 = 50
    assert.equal(calculateAvgScore(0, 100, null), 50)
  })

  it('omits null, undefined, and empty string from average calculation', () => {
    assert.equal(calculateAvgScore(80, null, 90), 85)
    assert.equal(calculateAvgScore(75, undefined, undefined), 75)
    assert.equal(calculateAvgScore(null, null, null), 0)
    assert.equal(calculateAvgScore('', null, undefined), 0)
  })

  it('correctly maps predikat based on 0-100 range', () => {
    assert.equal(getPredikat(100), 'A')
    assert.equal(getPredikat(90), 'A')
    assert.equal(getPredikat(89), 'B')
    assert.equal(getPredikat(75), 'B')
    assert.equal(getPredikat(74), 'C')
    assert.equal(getPredikat(60), 'C')
    assert.equal(getPredikat(59), 'D')
    assert.equal(getPredikat(0), 'D')
  })

  it('enriches grade stats properly', () => {
    const grade = { attitude_score: 95, skill_score: 85, activity_score: 90 }
    const stats = enrichGradeStats(grade)
    assert.equal(stats.avg, 90)
    assert.equal(stats.predikat, 'A')
  })
})
```

- [ ] **Step 2: Update `package.json` untuk menyertakan script test**

Di `package.json`, tambahkan script `"test"`:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "test": "node --test tests/**/*.test.js"
}
```

- [ ] **Step 3: Jalankan tes dan amati kegagalan/kelulusan awal**

Run: `npm test`  
Expected: Tes `gradeUtils.test.js` mungkin gagal jika `''` atau parsing tipe belum bersih.

- [ ] **Step 4: Update `src/utils/gradeUtils.js`**

```javascript
/**
 * Grade Utilities — Single Source of Truth
 * Kalkulasi rata-rata nilai dan predikat digunakan secara konsisten
 * di seluruh aplikasi: useGrades, ParentDashboard, ParentGrades, dsb.
 */

/**
 * Hitung rata-rata dari score sikap, keterampilan, dan keaktifan.
 * Nilai 0 adalah nilai sah (valid score).
 * Hanya nilai null, undefined, atau string kosong ('') yang diabaikan dari hitungan.
 *
 * @param {number|string|null} attitudeScore
 * @param {number|string|null} skillScore
 * @param {number|string|null} activityScore
 * @returns {number} Rata-rata dibulatkan ke integer
 */
export function calculateAvgScore(attitudeScore, skillScore, activityScore) {
  const scores = [attitudeScore, skillScore, activityScore]
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => Number(v))
    .filter((v) => !isNaN(v))

  if (scores.length === 0) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

/**
 * Tentukan predikat dari nilai rata-rata.
 * Standar: A >= 90, B >= 75, C >= 60, D < 60
 *
 * @param {number} avg
 * @returns {'A'|'B'|'C'|'D'}
 */
export function getPredikat(avg) {
  if (avg >= 90) return 'A'
  if (avg >= 75) return 'B'
  if (avg >= 60) return 'C'
  return 'D'
}

/**
 * Hitung statistik nilai lengkap dari satu record grade.
 *
 * @param {{ attitude_score?: number|null, skill_score?: number|null, activity_score?: number|null }} grade
 * @returns {{ avg: number, predikat: 'A'|'B'|'C'|'D' }}
 */
export function enrichGradeStats(grade) {
  const avg = calculateAvgScore(grade.attitude_score, grade.skill_score, grade.activity_score)
  return { avg, predikat: getPredikat(avg) }
}
```

- [ ] **Step 5: Jalankan `npm test` untuk memverifikasi seluruh tes lulus**

Run: `npm test`  
Expected: 100% pass (baik `sessionAttendanceHelper` maupun `gradeUtils`).

- [ ] **Step 6: Commit perubahan**

Run:
```bash
git add src/utils/gradeUtils.js tests/gradeUtils.test.js package.json
git commit -m "feat(grades): standardize grade calculations for 0-100 range with unit tests"
```

---

### Task 3: Pelatih (Coach) - Validasi Nilai 0-100 & Modal Riwayat Nilai Siswa

**Files:**
- Create: `src/components/coach/StudentGradeHistoryModal.jsx`
- Modify: `src/pages/coach/CoachGrades.jsx`

**Interfaces:**
- Produces: `StudentGradeHistoryModal` yang menerima props `{ isOpen, onClose, student, extracurricularId, extracurricularName }`.
- Modifies: `CoachGrades.jsx` untuk mengizinkan input angka `0`, memvalidasi batas $0 \le score \le 100$, menyediakan tombol quick assist pengisian keaktifan dari absensi, serta membuka modal riwayat siswa per baris.

- [ ] **Step 1: Buat komponen `src/components/coach/StudentGradeHistoryModal.jsx`**

Komponen ini memiliki tema pixel retro, menampilkan 2 sub-tab:
- **Tab 1: Rekam Jejak Nilai Antar-Semester (Longitudinal):** Query ke `grades` dengan `student_id = student.id` dan `extracurricular_id = extracurricularId`, diurutkan berdasarkan `academic_year` dan `semester`. Menampilkan kartu linimasa dan ringkasan tren.
- **Tab 2: Log Revisi Nilai (Audit Trail):** Query ke `grade_audit_logs` dengan `student_id = student.id` dan `extracurricular_id = extracurricularId`, diurutkan berdasarkan `changed_at DESC`. Menampilkan tanggal revisi, nama pengubah, dan perubahan nilai sebelum vs sesudah.

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { enrichGradeStats } from '../../utils/gradeUtils'
import { X, History, TrendingUp, ShieldAlert, Clock, User, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function StudentGradeHistoryModal({
  isOpen,
  onClose,
  student,
  extracurricularId,
  extracurricularName
}) {
  const [activeTab, setActiveTab] = useState('history') // 'history' | 'audit'
  const [loading, setLoading] = useState(true)
  const [gradesHistory, setGradesHistory] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen && student?.id && extracurricularId) {
      loadHistoryData()
    }
  }, [isOpen, student?.id, extracurricularId])

  const loadHistoryData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. Fetch longitudinal grades history for this student & ekskul
      const { data: gData, error: gErr } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', student.id)
        .eq('extracurricular_id', extracurricularId)
        .order('academic_year', { ascending: false })
        .order('semester', { ascending: false })

      if (gErr) throw gErr

      const enriched = (gData || []).map(g => ({
        ...g,
        ...enrichGradeStats(g)
      }))
      setGradesHistory(enriched)

      // 2. Fetch audit logs
      const { data: aData, error: aErr } = await supabase
        .from('grade_audit_logs')
        .select('*, changed_by_user:changed_by (full_name, role)')
        .eq('student_id', student.id)
        .eq('extracurricular_id', extracurricularId)
        .order('changed_at', { ascending: false })

      if (aErr) {
        console.warn('Audit logs fetch warning:', aErr.message)
      } else {
        setAuditLogs(aData || [])
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Gagal memuat riwayat: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !student) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pixel-navy/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-pixel-panel border-4 border-pixel-gray shadow-pixel-modal flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 border-b-2 border-pixel-gray/40 bg-pixel-navy">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-pixel-peach" />
            <div>
              <h2 className="font-pixel text-xs text-pixel-white pixel-text-shadow">
                Riwayat Nilai: {student.full_name}
              </h2>
              <p className="text-xs text-pixel-lavender font-mono">
                NIS: {student.nis} | Kelas: {student.class} | Ekskul: {extracurricularName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-pixel-red/20 text-pixel-lavender hover:text-pixel-red transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b-2 border-pixel-gray/30 bg-pixel-panel/50 px-4 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold font-retro uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-b-2 border-pixel-peach text-pixel-peach bg-pixel-navy/60'
                : 'text-pixel-lavender hover:text-pixel-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Rekam Jejak Nilai ({gradesHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs font-bold font-retro uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-b-2 border-pixel-peach text-pixel-peach bg-pixel-navy/60'
                : 'text-pixel-lavender hover:text-pixel-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Log Revisi Nilai ({auditLogs.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-pixel-red/10 border-2 border-pixel-red text-pixel-red text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-pixel-lavender font-retro text-sm animate-pixel-blink">
              MEMUAT RIWAYAT NILAI...
            </div>
          ) : activeTab === 'history' ? (
            gradesHistory.length === 0 ? (
              <div className="py-10 text-center text-pixel-lavender">
                <History className="w-10 h-10 text-pixel-gray mx-auto mb-2 opacity-50" />
                <p>Belum ada catatan nilai sebelumnya untuk siswa ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gradesHistory.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 bg-pixel-navy/50 border border-pixel-gray/40 rounded-none space-y-2 hover:border-pixel-peach/40 transition-colors"
                  >
                    <div className="flex justify-between items-center border-b border-pixel-gray/20 pb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-pixel-yellow" />
                        <span className="font-bold text-xs text-pixel-white">
                          {g.semester} ({g.academic_year})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-pixel-lavender">Rata-rata:</span>
                        <span className="font-mono font-bold text-sm text-pixel-peach">{g.avg}</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-none ${
                            g.predikat === 'A'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                              : g.predikat === 'B'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                              : g.predikat === 'C'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                          }`}
                        >
                          Predikat {g.predikat}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono text-xs">
                      <div className="bg-pixel-panel p-2 border border-pixel-gray/20">
                        <span className="text-pixel-lavender block text-[10px] uppercase">Sikap</span>
                        <span className="font-bold text-pixel-white">{g.attitude_score ?? '-'}</span>
                      </div>
                      <div className="bg-pixel-panel p-2 border border-pixel-gray/20">
                        <span className="text-pixel-lavender block text-[10px] uppercase">Keterampilan</span>
                        <span className="font-bold text-pixel-white">{g.skill_score ?? '-'}</span>
                      </div>
                      <div className="bg-pixel-panel p-2 border border-pixel-gray/20">
                        <span className="text-pixel-lavender block text-[10px] uppercase">Aktivitas</span>
                        <span className="font-bold text-pixel-white">{g.activity_score ?? '-'}</span>
                      </div>
                    </div>

                    {g.notes && (
                      <div className="text-xs text-pixel-peach bg-pixel-panel/80 p-2 border-l-2 border-pixel-peach italic">
                        "{g.notes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            auditLogs.length === 0 ? (
              <div className="py-10 text-center text-pixel-lavender">
                <Clock className="w-10 h-10 text-pixel-gray mx-auto mb-2 opacity-50" />
                <p>Belum ada riwayat revisi nilai yang tercatat.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-pixel-navy/50 border border-pixel-gray/30 rounded-none text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center text-pixel-lavender">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-pixel-yellow" />
                        <span>
                          {new Date(log.changed_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          log.action === 'INSERT'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : log.action === 'UPDATE'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-pixel-white">
                      <User className="w-3.5 h-3.5 text-pixel-peach" />
                      <span>Oleh: {log.changed_by_user?.full_name || 'Pelatih / Sistem'}</span>
                    </div>

                    {log.action === 'UPDATE' && log.old_scores && log.new_scores ? (
                      <div className="grid grid-cols-2 gap-2 p-2 bg-pixel-panel border border-pixel-gray/20 font-mono text-[11px]">
                        <div>
                          <span className="text-pixel-red font-bold block mb-1">Sebelum Revisi:</span>
                          <div>Sikap: {log.old_scores.attitude_score ?? '-'}</div>
                          <div>Keterampilan: {log.old_scores.skill_score ?? '-'}</div>
                          <div>Aktivitas: {log.old_scores.activity_score ?? '-'}</div>
                          {log.old_scores.notes && (
                            <div className="text-[10px] italic text-pixel-lavender truncate">"{log.old_scores.notes}"</div>
                          )}
                        </div>
                        <div>
                          <span className="text-pixel-green font-bold block mb-1">Sesudah Revisi:</span>
                          <div>Sikap: {log.new_scores.attitude_score ?? '-'}</div>
                          <div>Keterampilan: {log.new_scores.skill_score ?? '-'}</div>
                          <div>Aktivitas: {log.new_scores.activity_score ?? '-'}</div>
                          {log.new_scores.notes && (
                            <div className="text-[10px] italic text-pixel-peach truncate">"{log.new_scores.notes}"</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-pixel-panel border border-pixel-gray/20 font-mono text-[11px]">
                        <div>Sikap: {log.new_scores?.attitude_score ?? '-'}</div>
                        <div>Keterampilan: {log.new_scores?.skill_score ?? '-'}</div>
                        <div>Aktivitas: {log.new_scores?.activity_score ?? '-'}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-pixel-gray/30 bg-pixel-navy flex justify-end">
          <Button variant="secondary" onClick={onClose} className="text-xs">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modifikasi `src/pages/coach/CoachGrades.jsx`**

1. Import `StudentGradeHistoryModal` dan ikon `History`, `Sparkles`.
2. Update `handleScoreChange` untuk mengizinkan `0`:
   ```javascript
   const handleScoreChange = useCallback((studentId, field, value) => {
     // Validasi skor 0 - 100 atau kosong
     if (value !== '') {
       const num = parseInt(value, 10)
       if (isNaN(num) || num < 0 || num > 100) return
     }
     setGradesSheet(sheet => ({
       ...sheet,
       [studentId]: { ...sheet[studentId], [field]: value }
     }))
   }, [])
   ```
3. Update `handleSaveGrades`:
   ```javascript
   // Parse score strings to integers or set to null. Note: '0' must become 0, NOT null!
   const att = sheet.attitude_score !== '' ? parseInt(sheet.attitude_score, 10) : null
   const sk = sheet.skill_score !== '' ? parseInt(sheet.skill_score, 10) : null
   const act = sheet.activity_score !== '' ? parseInt(sheet.activity_score, 10) : null
   ```
4. Tambahkan tombol Quick Assist pada kolom Aktivitas untuk menyalin persentase kehadiran:
   ```javascript
   const applyAttendanceToActivity = (studentId, attendancePercentage) => {
     handleScoreChange(studentId, 'activity_score', attendancePercentage.toString())
     toast.success('Nilai aktivitas disesuaikan dengan kehadiran (' + attendancePercentage + ')')
   }
   ```
5. Tambahkan kolom "Aksi" pada tabel dan tombol "Riwayat" di setiap baris siswa:
   ```jsx
   <td className="px-4 py-4 text-center">
     <Button
       variant="outline"
       size="sm"
       onClick={() => setSelectedHistoryStudent(student)}
       className="gap-1 text-xs"
       title="Lihat Rekam Jejak & Riwayat Nilai"
     >
       <History className="w-3.5 h-3.5 text-pixel-peach" />
       Riwayat
     </Button>
   </td>
   ```
6. Render `<StudentGradeHistoryModal>` di bagian bawah komponen.

- [ ] **Step 3: Verifikasi build dan test**

Run: `npm test && npm run build`  
Expected: Test lulus dan build Vite berhasil tanpa error syntax/import.

- [ ] **Step 4: Commit perubahan Coach**

Run:
```bash
git add src/components/coach/StudentGradeHistoryModal.jsx src/pages/coach/CoachGrades.jsx
git commit -m "feat(coach): add 0-100 grade validation, attendance quick assist, and student grade history modal"
```

---

### Task 4: Siswa (Student) - Tab Linimasa & Tren Riwayat Nilai

**Files:**
- Modify: `src/pages/student/StudentGrades.jsx`

**Interfaces:**
- Consumes: `allGrades` dari `useGrades(studentId, null)`.
- Produces: Antarmuka tab interaktif untuk siswa: Tab "Semester Ini" (Radar & Cards) vs Tab "Riwayat & Tren" (Line Chart rata-rata nilai lintas semester & Linimasa evaluasi).

- [ ] **Step 1: Modifikasi `src/pages/student/StudentGrades.jsx`**

1. Tambahkan state `activeView`: `'current' | 'history'`.
2. Tambahkan kalkulasi data tren untuk Line Chart Recharts:
   - Mengelompokkan riwayat nilai per kombinasi `academic_year` dan `semester` secara kronologis.
   - Mengambil nilai rata-rata tiap ekskul atau rata-rata umum untuk ditampilkan pada Line Chart.
3. Buat tampilan linimasa riwayat semester dengan kartu retro yang memuat:
   - Semester & Tahun Ajaran
   - Nama Ekskul
   - Badge Predikat ($A/B/C/D$)
   - Rincian Skor: Sikap, Keterampilan, Aktivitas, Rata-rata
   - Catatan Evaluasi Pelatih
   - Tanggal terakhir dinilai

- [ ] **Step 2: Verifikasi build**

Run: `npm run build`  
Expected: Sukses tanpa error.

- [ ] **Step 3: Commit perubahan Student**

Run:
```bash
git add src/pages/student/StudentGrades.jsx
git commit -m "feat(student): add interactive grade history timeline and progress trend view"
```

---

### Task 5: Orang Tua (Parent) - Riwayat Nilai & Cetak Rapor Kumulatif PDF

**Files:**
- Modify: `src/pages/parent/ParentGrades.jsx`

**Interfaces:**
- Consumes: `allGrades` dari `useGrades(studentId, null)` dan data anak dari `useParentChildren()`.
- Produces: Antarmuka tab riwayat untuk orang tua + fungsi `exportCumulativePDF` yang menghasilkan rapor komprehensif seluruh semester.

- [ ] **Step 1: Implementasikan fungsi `exportCumulativePDF` di `src/pages/parent/ParentGrades.jsx`**

```javascript
const exportCumulativePDF = async () => {
  if (!selectedChild || allGrades.length === 0 || exporting) return
  setExporting(true)
  setExportError('')
  try {
    const doc = new jsPDF()
    const startY = await addKopSuratToPDF(doc, 'portrait')

    doc.setFontSize(14)
    doc.text('Laporan Riwayat Perkembangan Ekstrakurikuler Siswa', 14, startY + 6)
    doc.setFontSize(10)
    doc.text(`Nama Siswa   : ${selectedChild.full_name}`, 14, startY + 13)
    doc.text(`NIS          : ${selectedChild.nis || '-'}`, 14, startY + 18)
    doc.text(`Kelas        : ${selectedChild.class || '-'}`, 14, startY + 23)

    // Urutkan riwayat dari terlama ke terbaru atau sebaliknya
    const tableData = allGrades
      .filter(g => g.extracurriculars && g.extracurriculars.name)
      .map(g => [
        `${g.semester}\n(${g.academic_year})`,
        g.extracurriculars.name,
        g.attitude_score !== null ? g.attitude_score : '-',
        g.skill_score !== null ? g.skill_score : '-',
        g.activity_score !== null ? g.activity_score : '-',
        g.avg,
        g.predikat,
        g.notes || '-'
      ])

    autoTable(doc, {
      startY: startY + 28,
      head: [['Periode', 'Ekstrakurikuler', 'Sikap', 'Keterampilan', 'Keaktifan', 'Rata-rata', 'Predikat', 'Catatan Pelatih']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 48, 80] },
      styles: { fontSize: 8, cellPadding: 2 }
    })

    doc.save(`Rapor_Kumulatif_${selectedChild.full_name.split(' ')[0]}.pdf`)
    toast.success('Rapor riwayat kumulatif berhasil diunduh!')
  } catch (err) {
    console.error('Export Cumulative PDF error:', err)
    setExportError('Gagal membuat Rapor Riwayat PDF.')
  } finally {
    setExporting(false)
  }
}
```

- [ ] **Step 2: Tambahkan navigasi tab "Semester Ini" vs "Riwayat Perkembangan Anak"**

Menampilkan kartu riwayat linimasa perkembangan anak yang dipilih beserta tombol unduh rapor kumulatif.

- [ ] **Step 3: Verifikasi build**

Run: `npm run build`  
Expected: Sukses tanpa error.

- [ ] **Step 4: Commit perubahan Parent**

Run:
```bash
git add src/pages/parent/ParentGrades.jsx
git commit -m "feat(parent): add child grade history view and cumulative PDF report export"
```

---

### Task 6: Admin - Riwayat Siswa & Modul Log Audit Perubahan Nilai

**Files:**
- Create: `src/components/admin/GradeAuditLogsModal.jsx`
- Create: `src/components/admin/StudentFullGradeHistoryModal.jsx`
- Modify: `src/pages/admin/RecapManagement.jsx`

**Interfaces:**
- Produces:
  1. `StudentFullGradeHistoryModal` untuk menampilkan seluruh nilai seorang siswa lintas ekskul dan semester.
  2. `GradeAuditLogsModal` untuk mengaudit seluruh perubahan nilai di sekolah, dilengkapi filter dan ekspor Excel via `xlsx`.
- Modifies: `RecapManagement.jsx` untuk menambahkan tombol "Riwayat" per baris siswa dan tombol "Log Audit Nilai" pada tab Laporan Nilai.

- [ ] **Step 1: Buat komponen `src/components/admin/StudentFullGradeHistoryModal.jsx`**

Menampilkan modal rekam jejak nilai seluruh ekskul yang pernah diikuti oleh siswa terpilih, grafik nilai rata-rata, dan riwayat catatan pelatih.

- [ ] **Step 2: Buat komponen `src/components/admin/GradeAuditLogsModal.jsx`**

Menampilkan tabel audit trail dari `public.grade_audit_logs`:
- Kolom: Waktu Perubahan, Nama Siswa, Ekskul, Periode (Semester & TA), Aksi, Diubah Oleh, Nilai Sebelum vs Sesudah.
- Input pencarian (nama siswa/ekskul/pelatih).
- Tombol "Ekspor Log ke Excel" menggunakan library `xlsx`.

- [ ] **Step 3: Hubungkan modal ke `src/pages/admin/RecapManagement.jsx`**

Di tab `grades` ("Laporan Nilai Siswa"):
1. Tambahkan tombol "Log Audit Perubahan Nilai" di panel aksi atas.
2. Tambahkan tombol "Riwayat Siswa" di kolom aksi tabel rekap nilai.
3. Pasang state untuk membuka masing-masing modal.

- [ ] **Step 4: Jalankan verifikasi menyeluruh (`npm test && npm run build`)**

Run: `npm test && npm run build`  
Expected: Seluruh unit test lulus dan aplikasi berhasil di-build tanpa warning kritis.

- [ ] **Step 5: Commit perubahan Admin**

Run:
```bash
git add src/components/admin/GradeAuditLogsModal.jsx src/components/admin/StudentFullGradeHistoryModal.jsx src/pages/admin/RecapManagement.jsx
git commit -m "feat(admin): add student grade history modal and full grade audit logs with excel export"
```

---

## Self-Review Checklist
- [x] Semua requirement dari spec tercakup (range 0–100, trigger database, history untuk Coach, Student, Parent, Admin).
- [x] Tidak ada placeholder ("TBD", "TODO").
- [x] Tipe dan signature konsisten di seluruh task (`calculateAvgScore`, `grade_audit_logs` columns, dsb).
- [x] Menggunakan testing bawaan Node.js yang sudah terbukti bekerja di codebase ini.
