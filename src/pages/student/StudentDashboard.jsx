import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useStudentProfile } from '../../hooks/useStudentProfile'
import { supabase } from '../../lib/supabaseClient'
import { Progress } from '@/components/ui/progress'
import AnnouncementBanner from '../../components/shared/AnnouncementBanner'
import { evaluateAttendanceRisk, isSessionApplicableToStudent } from '../../utils/attendanceRiskEngine'
import { enrichGradeStats } from '../../utils/gradeUtils'
import { 
  Waves, CalendarDays, Clock, ChevronRight, 
  TrendingUp, AlertCircle, CheckCircle2, Loader2,
  Award, Star
} from 'lucide-react'
import CoachEvaluationModal from '../../components/student/CoachEvaluationModal'
import { soundManager } from '../../utils/soundEffects'

function SkeletonCard() {
  return (
    <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-pixel-gray/40 animate-pulse">
      <div className="h-4 bg-pixel-panel-light rounded-none border border-pixel-gray/30 w-2/3 mb-3"></div>
      <div className="h-3 bg-pixel-panel-light/70 rounded-none w-1/2 mb-4"></div>
      <div className="h-2 bg-pixel-navy rounded-none border border-pixel-gray/30 w-full mb-2"></div>
      <div className="h-3 bg-pixel-panel-light rounded-none border border-pixel-gray/30 w-1/4"></div>
    </div>
  )
}

function AttendanceBadge({ pct }) {
  if (pct >= 75) return <span className="font-retro text-base text-pixel-green">{pct}%</span>
  if (pct >= 50) return <span className="font-retro text-base text-pixel-orange">{pct}%</span>
  return <span className="font-retro text-base text-pixel-red">{pct}%</span>
}

function progressColor(pct) {
  if (pct >= 75) return 'bg-pixel-green/100'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-pixel-red/100'
}

export default function StudentDashboard() {
  const { studentId } = useAuthStore()
  const { profile, loading: profileLoading } = useStudentProfile()
  const [enrollments, setEnrollments] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [evaluations, setEvaluations] = useState({})
  const [selectedEvalItem, setSelectedEvalItem] = useState(null)
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false)

  useEffect(() => {
    if (studentId) {
      fetchDashboardData()

      const channel = supabase
        .channel(`student-dash-${studentId}`)
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
      setLoading(false)
    }
  }, [studentId, profile])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // 1. Fetch enrollments + extracurricular info
      const { data: enrollData, error: eErr } = await supabase
        .from('enrollments')
        .select(`
          id, semester, academic_year, status,
          extracurriculars(id, name, schedule, description, coach_id, is_mandatory, mandatory_class,
            coach:coach_id(full_name), coach2:coach_id_2(full_name), coach3:coach_id_3(full_name)
          )
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')

      if (eErr) throw eErr

      if (!enrollData || enrollData.length === 0) {
        setEnrollments([])
        setEvaluations({})
        setUpcomingSessions([])
        setLoading(false)
        return
      }

      const student = profile || { id: studentId }
      const ekskulIds = enrollData.map(e => e.extracurriculars?.id).filter(Boolean)

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() + 7)
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      // 2. Fetch all related data in PARALLEL in ONE round trip!
      const [
        sessionsRes,
        attRes,
        spRes,
        gradesRes,
        evalRes,
        upcomingRes
      ] = await Promise.all([
        ekskulIds.length > 0
          ? supabase
              .from('sessions')
              .select('id, session_date, topic, is_special_training, target_class, attendance_submitted, extracurricular_id')
              .in('extracurricular_id', ekskulIds)
              .order('session_date', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('attendances')
          .select('id, session_id, status, notes')
          .eq('student_id', studentId),
        supabase
          .from('special_session_participants')
          .select('session_id, student_id')
          .eq('student_id', studentId),
        ekskulIds.length > 0
          ? supabase
              .from('grades')
              .select('attitude_score, skill_score, activity_score, semester, extracurricular_id, graded_at')
              .eq('student_id', studentId)
              .in('extracurricular_id', ekskulIds)
              .order('graded_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('coach_evaluations')
          .select('*')
          .eq('student_id', studentId)
          .then(res => res)
          .catch(() => ({ data: [] })),
        ekskulIds.length > 0
          ? supabase
              .from('sessions')
              .select('id, session_date, topic, is_special_training, event_name, extracurriculars(name)')
              .in('extracurricular_id', ekskulIds)
              .gte('session_date', todayStr)
              .lte('session_date', weekEndStr)
              .order('session_date', { ascending: true })
          : Promise.resolve({ data: [] })
      ])

      const allSessions = sessionsRes.data || []
      const rawAtts = attRes.data || []
      const specialParts = spRes.data || []
      const allGrades = gradesRes.data || []
      const evalData = evalRes?.data || []
      const upcomingData = upcomingRes.data || []

      // In-memory grouping for evaluations
      const evalMap = {}
      evalData.forEach((ev) => {
        evalMap[ev.extracurricular_id] = ev
      })
      setEvaluations(evalMap)

      // In-memory calculation for enrollments & attendance risk
      const enriched = enrollData.map(enr => {
        const ekskul = enr.extracurriculars
        const ekskulId = ekskul?.id
        if (!ekskulId) return { ...enr, pct: 0, lastGrade: null }

        const ekskulSessions = allSessions.filter(s => s.extracurricular_id === ekskulId)
        let pct = 0

        if (ekskulSessions.length > 0) {
          const ekskulSessionIds = new Set(ekskulSessions.map(s => s.id))
          const applicableSpecialParts = specialParts.filter(sp => ekskulSessionIds.has(sp.session_id))
          const studentAttsForEkskul = rawAtts.filter(a => ekskulSessionIds.has(a.session_id))

          const validSessions = ekskulSessions.filter(s =>
            isSessionApplicableToStudent(s, student, applicableSpecialParts, studentAttsForEkskul)
          )
          const validSessionIds = new Set(validSessions.map(s => s.id))
          const studentAtts = studentAttsForEkskul.filter(a => validSessionIds.has(a.session_id))

          const risk = evaluateAttendanceRisk({
            student,
            ekskul,
            studentAtts,
            validSessions
          })

          pct = risk.percentage
        }

        // Get last grade (allGrades is already sorted by graded_at desc)
        const gradeData = allGrades.find(g => g.extracurricular_id === ekskulId)
        let lastGrade = null
        if (gradeData) {
          const stats = enrichGradeStats(gradeData)
          lastGrade = { ...stats, semester: gradeData.semester }
        }

        return { ...enr, pct, lastGrade }
      })

      setEnrollments(enriched)

      // Filter upcoming sessions
      const invitedSessionIds = new Set(specialParts.map(i => i.session_id))
      const filteredUpcoming = upcomingData.filter(s => {
        if (!s.is_special_training) return true
        return invitedSessionIds.has(s.id)
      }).slice(0, 5)

      setUpcomingSessions(filteredUpcoming)
    } catch (err) {
      console.error('StudentDashboard error:', err)
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

 if (!studentId && !loading) {
 return (
 <div className="space-y-6">
 <AnnouncementBanner />
 <div className="relative overflow-hidden bg-pixel-purple rounded-none p-6 text-pixel-white shadow-pixel ">
 <div className="relative z-10">
 <p className="text-violet-200 font-retro text-lg mb-1">{greeting()} 👋</p>
 <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
 Halo, Siswa!
 </h1>
 </div>
 </div>
 <div className="bg-pixel-panel rounded-none p-12 text-center border border-violet-50 shadow-pixel-sm">
 <Waves className="w-12 h-12 text-violet-200 mx-auto mb-4" />
 <p className="text-pixel-peach font-semibold mb-2">Akun belum terhubung dengan data siswa</p>
 <p className="text-pixel-lavender text-sm">Hubungi admin sekolah untuk menghubungkan akun Anda dengan data siswa.</p>
 </div>
 </div>
 )
 }

 return (
 <div className="space-y-6">
 <AnnouncementBanner />
 {/* Welcome Banner - Compact & Responsive */}
 <div className="relative overflow-hidden bg-pixel-purple rounded-none p-5 sm:p-6 text-pixel-white shadow-pixel border-2 border-pixel-gray">
   <div className="absolute -right-8 -top-8 w-36 h-36 rounded-none bg-pixel-panel/10 blur-xl pointer-events-none"></div>
   <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
     <div>
       <p className="text-pixel-peach font-retro text-lg mb-0.5">{greeting()} 👋</p>
       <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-retro text-pixel-white">
         Halo, <span className="text-pixel-yellow">{profileLoading ? '...' : (profile?.full_name || 'Siswa')}</span>!
       </h1>
       <p className="text-pixel-lavender text-sm font-retro mt-0.5">
         {profile?.class && `Kelas ${profile.class} · `}NIS: {profile?.nis || '—'}
       </p>
     </div>
     <div className="flex items-center gap-3 shrink-0 flex-wrap">
       <div className="bg-pixel-navy/80 border border-pixel-gray/40 rounded-none px-3.5 py-2 font-retro text-base flex items-center gap-2 shadow-pixel-sm">
         <span>🎯</span>
         <span><strong className="text-pixel-green">{enrollments.length}</strong> Ekskul Aktif</span>
       </div>
       <div className="bg-pixel-navy/80 border border-pixel-gray/40 rounded-none px-3.5 py-2 font-retro text-base flex items-center gap-2 shadow-pixel-sm">
         <span>📅</span>
         <span><strong className="text-pixel-blue">{upcomingSessions.length}</strong> Sesi Minggu Ini</span>
       </div>
     </div>
   </div>
 </div>

 {/* Seksi Evaluasi Pelatih Akhir Semester */}
 {enrollments.length > 0 && (
   <div className="bg-pixel-panel border-2 border-pixel-yellow p-5 shadow-pixel-sm space-y-3">
     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
       <div className="flex items-center gap-2.5">
         <div className="p-2 bg-pixel-yellow/20 rounded-none border border-pixel-yellow/40">
           <Award className="w-5 h-5 text-pixel-yellow" />
         </div>
         <div>
           <h2 className="font-pixel text-[11px] text-pixel-white tracking-wide">
             Evaluasi Pelatih Ekskul (Semester 1)
           </h2>
           <p className="text-xs text-pixel-lavender font-retro">
             Beri penilaian dan masukan anonim untuk pelatih kamu di akhir semester ini!
           </p>
         </div>
       </div>
       <div className="text-xs font-retro text-pixel-peach bg-pixel-navy px-2.5 py-1 border border-pixel-gray/40">
         🔒 Penilaian 100% Anonim
       </div>
     </div>

     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
       {enrollments.map((enr) => {
         const ekskul = enr.extracurriculars
         if (!ekskul) return null
         const evalItem = evaluations[ekskul.id]
         const coachName =
           ekskul.coach?.full_name ||
           ekskul.coach2?.full_name ||
           ekskul.coach3?.full_name ||
           'Pelatih Belum Ditentukan'

         return (
           <div
             key={enr.id}
             className="bg-pixel-navy/80 border border-pixel-gray/40 p-3.5 flex flex-col justify-between space-y-3"
           >
             <div>
               <span className="text-[9px] font-pixel text-pixel-peach uppercase tracking-wider block">
                 {ekskul.name}
               </span>
               <span className="text-sm font-retro font-bold text-pixel-white line-clamp-1">
                 Pelatih: {coachName}
               </span>
             </div>

             <div className="pt-2 border-t border-pixel-gray/30 flex items-center justify-between">
               {evalItem ? (
                 <div className="flex items-center gap-1.5 text-xs text-pixel-green font-retro">
                   <CheckCircle2 className="w-4 h-4 text-pixel-green" />
                   <span>Dinilai: </span>
                   <div className="flex items-center text-pixel-yellow">
                     <Star className="w-3.5 h-3.5 fill-pixel-yellow" />
                     <span className="font-bold ml-0.5">{evalItem.rating}/5</span>
                   </div>
                 </div>
               ) : (
                 <span className="text-xs text-amber-400 font-retro">
                   🟡 Belum Dinilai
                 </span>
               )}

               <button
                 type="button"
                 onClick={() => {
                   setSelectedEvalItem({
                     extracurricular: ekskul,
                     coach: ekskul.coach || { id: ekskul.coach_id, full_name: coachName },
                     existingEvaluation: evalItem || null,
                     semester: enr.semester || 'Ganjil',
                     academicYear: enr.academic_year || '2024/2025'
                   })
                   setIsEvalModalOpen(true)
                 }}
                 className={`px-3 py-1 text-xs font-retro cursor-pointer transition-colors ${
                   evalItem
                     ? 'bg-pixel-gray/30 text-pixel-lavender hover:bg-pixel-gray/50 border border-pixel-gray/40'
                     : 'bg-pixel-yellow text-pixel-navy hover:bg-pixel-yellow/90 font-bold shadow-pixel-sm'
                 }`}
               >
                 {evalItem ? 'Lihat Ulasan' : '⭐ Nilai Sekarang'}
               </button>
             </div>
           </div>
         )
       })}
     </div>
   </div>
 )}

 {/* Ekskul Cards */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-base font-bold text-pixel-white">Ekskul Saya</h2>
 {enrollments.length > 3 && (
 <button
 onClick={() => setShowAll(!showAll)}
 className="text-xs text-pixel-purple font-semibold hover:underline flex items-center gap-1"
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
 <div className="bg-pixel-panel rounded-none p-8 text-center border border-violet-50 shadow-pixel-sm">
 <Waves className="w-10 h-10 text-violet-200 mx-auto mb-3" />
 <p className="text-pixel-lavender text-sm">Kamu belum terdaftar di ekskul apapun.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {displayedEnrollments.map(enr => {
 const ekskul = enr.extracurriculars
 const pct = enr.pct
 return (
 <Link
 key={enr.id}
 to={`/student/extracurriculars/${ekskul?.id}`}
 onClick={() => soundManager.playBlip()}
 className="block pixel-box pixel-card-interactive p-5 group"
 >
 <div className="flex items-start justify-between mb-3">
 <div>
 <h3 className="font-bold text-pixel-white group-hover:text-pixel-blue line-clamp-1">
 {ekskul?.name}
 </h3>
 <p className="text-xs text-pixel-lavender flex items-center gap-1 mt-0.5">
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
 <span className="text-xs text-pixel-lavender">Kehadiran Bulan Ini</span>
 <AttendanceBadge pct={pct} />
 </div>
 <div className="h-2 bg-pixel-navy rounded-none overflow-hidden border border-pixel-gray/40">
 <div
 className={`h-full rounded-none duration-500 ${progressColor(pct)}`}
 style={{ width: `${pct}%` }}
 ></div>
 </div>
 </div>

 {/* Last grade */}
 {enr.lastGrade && (
 <div className="mt-3 pt-3 border-t border-pixel-gray/30 flex items-center gap-2">
 <TrendingUp className="w-3.5 h-3.5 text-pixel-purple" />
 <span className="text-xs text-pixel-lavender">
 Nilai {enr.lastGrade.semester}:
 </span>
 <span className={`font-retro text-base ${
 enr.lastGrade.predikat === 'A' ? 'text-pixel-green' :
 enr.lastGrade.predikat === 'B' ? 'text-pixel-blue' :
 enr.lastGrade.predikat === 'C' ? 'text-pixel-orange' : 'text-pixel-red'
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
 <h2 className="text-base font-bold text-pixel-white mb-3 flex items-center gap-2">
 <CalendarDays className="w-4 h-4 text-violet-500" />
 Sesi Terdekat Minggu Ini
 </h2>
 {loading ? (
 <div className="bg-pixel-panel rounded-none p-4 shadow-pixel-sm border border-pixel-gray/40 animate-pulse space-y-3">
 {[1,2].map(i => (
 <div key={i} className="h-12 bg-pixel-panel-light border border-pixel-gray/30 rounded-none"></div>
 ))}
 </div>
 ) : upcomingSessions.length === 0 ? (
 <div className="bg-pixel-panel rounded-none p-6 text-center border border-pixel-gray/40 shadow-pixel-sm">
 <p className="text-pixel-lavender text-sm">Tidak ada sesi latihan minggu ini 🎉</p>
 </div>
 ) : (
 <div className="pixel-box divide-y-2 divide-pixel-gray/40 overflow-hidden">
 {upcomingSessions.map(session => {
 const date = new Date(session.session_date)
 const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' })
 const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
 return (
 <div key={session.id} className="flex items-center gap-4 p-4 hover:bg-pixel-navy/30 transition-colors">
 <div className="w-10 h-10 rounded-none bg-pixel-purple/30 border-2 border-pixel-purple flex flex-col items-center justify-center shrink-0">
 <span className="font-pixel text-[10px] text-pixel-yellow leading-none">{date.getDate()}</span>
 <span className="text-[9px] text-pixel-peach uppercase font-retro">{date.toLocaleDateString('id-ID', { month: 'short' })}</span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-retro text-lg text-pixel-white truncate">
 {session.extracurriculars?.name}
 </p>
 <p className="text-xs text-pixel-lavender truncate">
 {dayName} · {session.topic || 'Materi belum diatur'}
 </p>
 </div>
 </div>
 )
 })}
  </div>
  )}
  </div>

  {/* Modal Penilaian Pelatih */}
  {selectedEvalItem && (
    <CoachEvaluationModal
      isOpen={isEvalModalOpen}
      onClose={() => {
        setIsEvalModalOpen(false)
        setSelectedEvalItem(null)
      }}
      extracurricular={selectedEvalItem.extracurricular}
      coach={selectedEvalItem.coach}
      studentId={studentId}
      semester={selectedEvalItem.semester}
      academicYear={selectedEvalItem.academicYear}
      existingEvaluation={selectedEvalItem.existingEvaluation}
      onSuccess={(savedEval) => {
        setEvaluations((prev) => ({
          ...prev,
          [selectedEvalItem.extracurricular.id]: savedEval
        }))
      }}
    />
  )}
  </div>
  )
}
