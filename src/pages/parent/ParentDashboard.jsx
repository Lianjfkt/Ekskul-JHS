import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useParentChildren } from '../../hooks/useParentChildren'
import { supabase } from '../../lib/supabaseClient'
import AnnouncementBanner from '../../components/shared/AnnouncementBanner'
import { 
  Waves, CalendarDays, Clock, ChevronRight, 
  TrendingUp, AlertCircle, CheckCircle2, Loader2, AlertTriangle
} from 'lucide-react'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-50 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-2/3 mb-3"></div>
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4"></div>
      <div className="h-2 bg-slate-100 rounded w-full mb-2"></div>
      <div className="h-3 bg-slate-200 rounded w-1/4"></div>
    </div>
  )
}

function AttendanceBadge({ pct }) {
  if (pct >= 75) return <span className="text-xs font-bold text-emerald-600">{pct}%</span>
  if (pct >= 50) return <span className="text-xs font-bold text-amber-600">{pct}%</span>
  return <span className="text-xs font-bold text-rose-600">{pct}%</span>
}

function progressColor(pct) {
  if (pct >= 75) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

export default function ParentDashboard() {
  const { user } = useAuthStore()
  const { selectedChild, children, loading: childrenLoading, fetchChildren } = useParentChildren()
  const studentId = selectedChild?.id

  const [enrollments, setEnrollments] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // Trigger fetchChildren from dashboard if not yet loaded
  useEffect(() => {
    if (user && !selectedChild && !childrenLoading && children.length === 0) {
      const loadChildren = async () => {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        if (data) {
          fetchChildren(user.id, data.full_name, data.student_id)
        }
      }
      loadChildren()
    }
  }, [user, selectedChild, childrenLoading, children.length, fetchChildren])

  useEffect(() => {
    if (studentId) {
      fetchDashboardData()

      const channel = supabase
        .channel(`parent-dash-${studentId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'attendances',
          filter: `student_id=eq.${studentId}`
        }, () => fetchDashboardData())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'grades',
          filter: `student_id=eq.${studentId}`
        }, () => fetchDashboardData())
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } else {
      setEnrollments([])
      setUpcomingSessions([])
      setWarnings([])
    }
  }, [studentId])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch enrollments + extracurricular info
      const { data: enrollData, error: eErr } = await supabase
        .from('enrollments')
        .select(`
          id, semester, academic_year, status,
          extracurriculars(id, name, schedule, description, coach_id,
            users(full_name)
          )
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')

      if (eErr) throw eErr

      const currentWarnings = []

      // For each enrollment, fetch attendance %
      const enriched = await Promise.all((enrollData || []).map(async enr => {
        const ekskulId = enr.extracurriculars?.id
        if (!ekskulId) return { ...enr, pct: 0, lastGrade: null }

        // Get sessions
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('extracurricular_id', ekskulId)

        const sessionIds = (sessions || []).map(s => s.id)
        let pct = 0
        let alphaCount = 0

        if (sessionIds.length > 0) {
          const { data: atts } = await supabase
            .from('attendances')
            .select('status')
            .eq('student_id', studentId)
            .in('session_id', sessionIds)

          const hadir = (atts || []).filter(a => a.status === 'hadir').length
          alphaCount = (atts || []).filter(a => a.status === 'alpha').length
          pct = atts?.length > 0 ? Math.round((hadir / atts.length) * 100) : 0
        }

        if (pct > 0 && pct < 75) {
          currentWarnings.push({ type: 'attendance_low', ekskulName: enr.extracurriculars.name, pct })
        }
        if (alphaCount >= 3) {
          currentWarnings.push({ type: 'alpha_high', ekskulName: enr.extracurriculars.name, count: alphaCount })
        }

        // Get last grade
        const { data: gradeData } = await supabase
          .from('grades')
          .select('attitude_score, skill_score, activity_score, semester')
          .eq('student_id', studentId)
          .eq('extracurricular_id', ekskulId)
          .order('graded_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let lastGrade = null
        if (gradeData) {
          const avg = Math.round(
            ((gradeData.attitude_score || 0) + (gradeData.skill_score || 0) + (gradeData.activity_score || 0)) / 3
          )
          const predikat = avg >= 90 ? 'A' : avg >= 75 ? 'B' : avg >= 60 ? 'C' : 'D'
          lastGrade = { avg, predikat, semester: gradeData.semester }
        }

        return { ...enr, pct, lastGrade }
      }))

      setEnrollments(enriched)
      setWarnings(currentWarnings)

      // Fetch upcoming sessions (this week)
      const ekskulIds = (enrollData || []).map(e => e.extracurriculars?.id).filter(Boolean)
      if (ekskulIds.length > 0) {
        const today = new Date()
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() + 7)

        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, session_date, topic, extracurriculars(name)')
          .in('extracurricular_id', ekskulIds)
          .gte('session_date', today.toISOString().split('T')[0])
          .lte('session_date', weekEnd.toISOString().split('T')[0])
          .order('session_date', { ascending: true })
          .limit(5)

        setUpcomingSessions(sessions || [])
      }
    } catch (err) {
      console.error('ParentDashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  const displayedEnrollments = showAll ? enrollments : enrollments.slice(0, 3)

  if (!selectedChild) {
    if (childrenLoading) {
      return (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <AnnouncementBanner />
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-violet-200">
          <div className="relative z-10">
            <p className="text-violet-200 text-sm font-medium mb-1">{greeting()} 👋</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Portal Orang Tua
            </h1>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-12 text-center border border-violet-50 shadow-sm">
          <Waves className="w-12 h-12 text-violet-200 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold mb-2">Data anak belum terhubung</p>
          <p className="text-slate-400 text-sm">Hubungi admin sekolah untuk menghubungkan akun Anda dengan data siswa.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnnouncementBanner />
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-violet-200">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
        <div className="relative z-10">
          <p className="text-violet-200 text-sm font-medium mb-1">{greeting()} 👋</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Pemantauan Data: {selectedChild?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-violet-200 text-sm mt-1">
            {selectedChild?.class && `Kelas ${selectedChild.class} · `}NIS: {selectedChild?.nis || '—'}
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div className="bg-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              🎯 {enrollments.length} Ekskul Aktif
            </div>
            <div className="bg-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              📅 {upcomingSessions.length} Sesi Terdekat
            </div>
          </div>
        </div>
      </div>

      {/* Perlu Perhatian Section */}
      {warnings.length > 0 && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-rose-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Perlu Perhatian
          </h2>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/60 p-3 rounded-xl">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="text-xs text-rose-700 font-medium">
                  {w.type === 'attendance_low' && (
                    <span>Kehadiran di <b className="font-bold">{w.ekskulName}</b> sangat rendah ({w.pct}%).</span>
                  )}
                  {w.type === 'alpha_high' && (
                    <span>Terdapat <b className="font-bold">{w.count}x Alpha (Tanpa Keterangan)</b> di {w.ekskulName}.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ekskul Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">Ekskul Anak</h2>
          {enrollments.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1"
            >
              {showAll ? 'Lebih Sedikit' : 'Lihat Semua'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-violet-50 shadow-sm">
            <Waves className="w-10 h-10 text-violet-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Anak Anda belum terdaftar di ekskul apapun.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedEnrollments.map(enr => {
              const ekskul = enr.extracurriculars
              const pct = enr.pct
              return (
                <Link
                  key={enr.id}
                  to={`/parent/extracurriculars/${ekskul?.id}`}
                  className="block bg-white rounded-2xl p-5 shadow-sm border border-violet-50 hover:shadow-md hover:border-violet-200 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 group-hover:text-violet-700 transition-colors line-clamp-1">
                        {ekskul?.name}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {ekskul?.schedule || 'Jadwal belum diatur'}
                      </p>
                    </div>
                    <span className="shrink-0 ml-2">
                      {pct >= 75 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      )}
                    </span>
                  </div>

                  {/* Attendance bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Kehadiran Keseluruhan</span>
                      <AttendanceBadge pct={pct} />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Last grade */}
                  {enr.lastGrade && (
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs text-slate-500">
                        Nilai {enr.lastGrade.semester}:
                      </span>
                      <span className={`text-xs font-bold ${
                        enr.lastGrade.predikat === 'A' ? 'text-emerald-600' :
                        enr.lastGrade.predikat === 'B' ? 'text-blue-600' :
                        enr.lastGrade.predikat === 'C' ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {enr.lastGrade.avg} ({enr.lastGrade.predikat})
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming Sessions */}
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          Sesi Terdekat
        </h2>
        {loading ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-violet-50 animate-pulse space-y-3">
            {[1,2].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
        ) : upcomingSessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-violet-50 shadow-sm">
            <p className="text-slate-400 text-sm">Tidak ada sesi latihan minggu ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-violet-50 divide-y divide-slate-50 overflow-hidden">
            {upcomingSessions.map(session => {
              const date = new Date(session.session_date)
              const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' })
              return (
                <div key={session.id} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs text-violet-600 font-bold leading-none">{date.getDate()}</span>
                    <span className="text-[9px] text-violet-400">{date.toLocaleDateString('id-ID', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {session.extracurriculars?.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {dayName} · {session.topic || 'Materi belum diatur'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
