import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { enrichGradeStats } from '../../utils/gradeUtils'
import { X, History, TrendingUp, ShieldAlert, Clock, User, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SEMESTER_ORDER = {
  'Pertengahan Semester Ganjil': 1,
  'Akhir Semester Ganjil': 2,
  'Pertengahan Semester Genap': 3,
  'Akhir Semester Genap': 4,
}

function sortGradesChronologically(grades) {
  return [...grades].sort((a, b) => {
    if (a.academic_year !== b.academic_year) return a.academic_year.localeCompare(b.academic_year)
    return (SEMESTER_ORDER[a.semester] || 0) - (SEMESTER_ORDER[b.semester] || 0)
  })
}

export default function StudentFullGradeHistoryModal({
  isOpen,
  onClose,
  student
}) {
  const [activeTab, setActiveTab] = useState('history') // 'history' | 'audit'
  const [loading, setLoading] = useState(true)
  const [gradesHistory, setGradesHistory] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [ekskulFilter, setEkskulFilter] = useState('')

  useEffect(() => {
    if (isOpen && student?.id) {
      loadStudentData()
    }
  }, [isOpen, student?.id])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const loadStudentData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. Fetch all longitudinal grades for this student across all ekskuls
      const { data: gData, error: gErr } = await supabase
        .from('grades')
        .select('*, extracurricular:extracurricular_id (id, name)')
        .eq('student_id', student.id)
        .order('academic_year', { ascending: false })
        .order('semester', { ascending: false })

      if (gErr) throw gErr

      const enriched = (gData || []).map((g) => ({
        ...g,
        ...enrichGradeStats(g)
      }))
      setGradesHistory(enriched)

      // 2. Fetch audit logs for this student
      const { data: aData, error: aErr } = await supabase
        .from('grade_audit_logs')
        .select('*, extracurricular:extracurricular_id (id, name), changed_by_user:changed_by (full_name, role)')
        .eq('student_id', student.id)
        .order('changed_at', { ascending: false })

      if (aErr) {
        console.warn('Audit logs fetch warning:', aErr.message)
      } else {
        setAuditLogs(aData || [])
      }
    } catch (err) {
      console.error('Error fetching student full grade history:', err)
      setErrorMsg('Gagal memuat riwayat nilai: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Unique list of ekskuls for filter
  const ekskulList = useMemo(() => {
    const map = new Map()
    gradesHistory.forEach((g) => {
      if (g.extracurricular?.id) {
        map.set(g.extracurricular.id, g.extracurricular.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [gradesHistory])

  // Filtered grades (newest first for timeline)
  const filteredGrades = useMemo(() => {
    const filtered = ekskulFilter
      ? gradesHistory.filter((g) => g.extracurricular?.id === ekskulFilter)
      : gradesHistory
    return sortGradesChronologically(filtered).reverse()
  }, [gradesHistory, ekskulFilter])

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    if (!ekskulFilter) return auditLogs
    return auditLogs.filter((l) => l.extracurricular_id === ekskulFilter)
  }, [auditLogs, ekskulFilter])

  if (!isOpen || !student) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pixel-navy/80 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-3xl bg-pixel-panel border-4 border-pixel-gray shadow-pixel-modal flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 border-b-2 border-pixel-gray/40 bg-pixel-navy">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-pixel-peach" />
            <div>
              <h2 className="font-pixel text-xs text-pixel-white pixel-text-shadow">
                Riwayat Nilai Siswa: {student.full_name}
              </h2>
              <p className="text-xs text-pixel-lavender font-mono">
                NIS: {student.nis || '-'} &bull; Kelas: {student.class || '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-pixel-red/20 text-pixel-lavender hover:text-pixel-red transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header Filter & Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b-2 border-pixel-gray/30 bg-pixel-panel/50 px-4 pt-2 gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-xs font-bold font-retro uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-b-2 border-pixel-peach text-pixel-peach bg-pixel-navy/60 -mb-[2px]'
                  : 'text-pixel-lavender hover:text-pixel-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Rekam Nilai ({gradesHistory.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 text-xs font-bold font-retro uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-b-2 border-pixel-peach text-pixel-peach bg-pixel-navy/60 -mb-[2px]'
                  : 'text-pixel-lavender hover:text-pixel-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Log Audit ({auditLogs.length})
            </button>
          </div>

          {/* Ekskul Filter (if student has more than 1 ekskul) */}
          {ekskulList.length > 1 && (
            <div className="flex items-center gap-2 pb-2 sm:pb-0">
              <Filter className="w-3.5 h-3.5 text-pixel-lavender" />
              <select
                value={ekskulFilter}
                onChange={(e) => setEkskulFilter(e.target.value)}
                className="text-xs border border-pixel-gray rounded-none px-2 py-1 text-pixel-peach bg-pixel-navy focus:outline-none focus:ring-1 focus:ring-violet-300"
              >
                <option value="">Semua Ekskul</option>
                {ekskulList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              MEMUAT RIWAYAT NILAI SISWA...
            </div>
          ) : activeTab === 'history' ? (
            filteredGrades.length === 0 ? (
              <div className="py-10 text-center text-pixel-lavender">
                <History className="w-10 h-10 text-pixel-gray mx-auto mb-2 opacity-50" />
                <p>Belum ada catatan nilai yang tercatat untuk siswa ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGrades.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 bg-pixel-navy/50 border border-pixel-gray/40 rounded-none space-y-2 hover:border-pixel-peach/40 transition-colors"
                  >
                    <div className="flex justify-between items-start border-b border-pixel-gray/20 pb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-pixel-yellow" />
                          <span className="font-bold text-xs text-pixel-white">
                            {g.semester} &bull; {g.academic_year}
                          </span>
                        </div>
                        <span className="font-bold text-sm text-pixel-peach">
                          {g.extracurricular?.name || 'Ekstrakurikuler'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2.5 py-0.5 text-xs font-black rounded-none ${
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
                        <span className="font-mono text-xs text-pixel-lavender">
                          Rata-rata: <span className="font-bold text-pixel-white">{g.avg}</span>
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
                        &ldquo;{g.notes}&rdquo;
                      </div>
                    )}

                    {g.graded_at && (
                      <div className="text-[10px] text-pixel-lavender/60 text-right">
                        Dinilai: {new Date(g.graded_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredAuditLogs.length === 0 ? (
              <div className="py-10 text-center text-pixel-lavender">
                <Clock className="w-10 h-10 text-pixel-gray mx-auto mb-2 opacity-50" />
                <p>Belum ada riwayat revisi nilai yang tercatat untuk siswa ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAuditLogs.map((log) => (
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
                        <span className="text-pixel-peach font-semibold">
                          &bull; {log.extracurricular?.name || 'Ekskul'}
                        </span>
                        {log.semester && (
                          <span className="text-pixel-lavender/60">
                            ({log.semester} - {log.academic_year})
                          </span>
                        )}
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
                      <span>
                        Oleh: {log.changed_by_user?.full_name || 'Pelatih / Sistem'} ({log.changed_by_user?.role || '-'})
                      </span>
                    </div>

                    {log.action === 'UPDATE' && log.old_scores && log.new_scores ? (
                      <div className="grid grid-cols-2 gap-2 p-2 bg-pixel-panel border border-pixel-gray/20 font-mono text-[11px]">
                        <div>
                          <span className="text-pixel-red font-bold block mb-1">Sebelum Revisi:</span>
                          <div>Sikap: {log.old_scores.attitude_score ?? '-'}</div>
                          <div>Keterampilan: {log.old_scores.skill_score ?? '-'}</div>
                          <div>Aktivitas: {log.old_scores.activity_score ?? '-'}</div>
                          {log.old_scores.notes && (
                            <div className="text-[10px] italic text-pixel-lavender truncate">
                              &ldquo;{log.old_scores.notes}&rdquo;
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-pixel-green font-bold block mb-1">Sesudah Revisi:</span>
                          <div>Sikap: {log.new_scores.attitude_score ?? '-'}</div>
                          <div>Keterampilan: {log.new_scores.skill_score ?? '-'}</div>
                          <div>Aktivitas: {log.new_scores.activity_score ?? '-'}</div>
                          {log.new_scores.notes && (
                            <div className="text-[10px] italic text-pixel-peach truncate">
                              &ldquo;{log.new_scores.notes}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    ) : log.action === 'DELETE' && log.old_scores ? (
                      <div className="p-2 bg-pixel-panel border border-pixel-gray/20 font-mono text-[11px]">
                        <span className="text-pixel-red font-bold block mb-1">Nilai Dihapus:</span>
                        <div>Sikap: {log.old_scores?.attitude_score ?? '-'}</div>
                        <div>Keterampilan: {log.old_scores?.skill_score ?? '-'}</div>
                        <div>Aktivitas: {log.old_scores?.activity_score ?? '-'}</div>
                        {log.old_scores?.notes && (
                          <div className="text-[10px] italic text-pixel-lavender truncate">
                            &ldquo;{log.old_scores.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 bg-pixel-panel border border-pixel-gray/20 font-mono text-[11px]">
                        <div>Sikap: {log.new_scores?.attitude_score ?? '-'}</div>
                        <div>Keterampilan: {log.new_scores?.skill_score ?? '-'}</div>
                        <div>Aktivitas: {log.new_scores?.activity_score ?? '-'}</div>
                        {log.new_scores?.notes && (
                          <div className="text-[10px] italic text-pixel-peach truncate">
                            &ldquo;{log.new_scores.notes}&rdquo;
                          </div>
                        )}
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
