import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useStudentProfile } from '../../hooks/useStudentProfile'
import { supabase } from '../../lib/supabaseClient'
import { Progress } from '@/components/ui/progress'
import AnnouncementBanner from '../../components/shared/AnnouncementBanner'
import { 
 Waves, CalendarDays, Clock, ChevronRight, 
 TrendingUp, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react'

function SkeletonCard() {
 return (
 <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 animate-pulse">
 <div className="h-4 bg-slate-200 rounded w-2/3 mb-3"></div>
 <div className="h-3 bg-slate-100 rounded w-1/2 mb-4"></div>
 <div className="h-2 bg-slate-100 rounded w-full mb-2"></div>
 <div className="h-3 bg-slate-200 rounded w-1/4"></div>
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

 if (sessionIds.length > 0) {
 const { data: atts } = await supabase
 .from('attendances')
 .select('status')
 .eq('student_id', studentId)
 .in('session_id', sessionIds)

 const hadir = (atts || []).filter(a => a.status === 'hadir').length
 pct = atts?.length > 0 ? Math.round((hadir / atts.length) * 100) : 0
 }

 // Get last grade
 const { data: gradeData } = await supabase
 .from('grades')
 .select('attitude_score, skill_score, knowledge_score, semester')
 .eq('student_id', studentId)
 .eq('extracurricular_id', ekskulId)
 .order('graded_at', { ascending: false })
 .limit(1)
 .maybeSingle()

 let lastGrade = null
 if (gradeData) {
 const avg = Math.round(
 ((gradeData.attitude_score || 0) + (gradeData.skill_score || 0) + (gradeData.knowledge_score || 0)) / 3
 )
 const predikat = avg >= 90 ? 'A' : avg >= 75 ? 'B' : avg >= 60 ? 'C' : 'D'
 lastGrade = { avg, predikat, semester: gradeData.semester }
 }

 return { ...enr, pct, lastGrade }
 }))

 setEnrollments(enriched)

 // Fetch upcoming sessions (this week) from enrolled ekskuls
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
 {/* Welcome Banner */}
 <div className="relative overflow-hidden bg-pixel-purple rounded-none p-6 text-pixel-white shadow-pixel ">
 <div className="absolute -right-8 -top-8 w-40 h-40 rounded-none bg-pixel-panel/10 blur-2xl"></div>
 <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-none bg-pixel-panel/10 blur-2xl"></div>
 <div className="relative z-10">
 <p className="text-violet-200 font-retro text-lg mb-1">{greeting()} 👋</p>
 <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
 Halo, {profileLoading ? '...' : (profile?.full_name?.split(' ')[0] || 'Siswa')}!
 </h1>
 <p className="text-violet-200 text-sm mt-1">
 {profile?.class && `Kelas ${profile.class} · `}NIS: {profile?.nis || '—'}
 </p>
 <div className="flex items-center gap-4 mt-4">
 <div className="bg-pixel-panel/20 rounded-none px-3 py-1.5 font-retro text-base">
 🎯 {enrollments.length} Ekskul Aktif
 </div>
 <div className="bg-pixel-panel/20 rounded-none px-3 py-1.5 font-retro text-base">
 📅 {upcomingSessions.length} Sesi Minggu Ini
 </div>
 </div>
 </div>
 </div>

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
 className="block bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 hover:brightness-110 hover:border-violet-200 group"
 >
 <div className="flex items-start justify-between mb-3">
 <div>
 <h3 className="font-bold text-pixel-white group-hover:text-violet-700 line-clamp-1">
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
 <div className="h-2 bg-slate-100 rounded-none overflow-hidden">
 <div
 className={`h-full rounded-none duration-500 ${progressColor(pct)}`}
 style={{ width: `${pct}%` }}
 ></div>
 </div>
 </div>

 {/* Last grade */}
 {enr.lastGrade && (
 <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
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
 <div className="bg-pixel-panel rounded-none p-4 shadow-pixel-sm border border-violet-50 animate-pulse space-y-3">
 {[1,2].map(i => (
 <div key={i} className="h-12 bg-slate-100 rounded-none"></div>
 ))}
 </div>
 ) : upcomingSessions.length === 0 ? (
 <div className="bg-pixel-panel rounded-none p-6 text-center border border-violet-50 shadow-pixel-sm">
 <p className="text-pixel-lavender text-sm">Tidak ada sesi latihan minggu ini 🎉</p>
 </div>
 ) : (
 <div className="bg-pixel-panel rounded-none shadow-pixel-sm border border-violet-50 divide-y divide-slate-50 overflow-hidden">
 {upcomingSessions.map(session => {
 const date = new Date(session.session_date)
 const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' })
 const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
 return (
 <div key={session.id} className="flex items-center gap-4 p-4">
 <div className="w-10 h-10 rounded-none bg-violet-100 flex flex-col items-center justify-center shrink-0">
 <span className="text-xs text-pixel-purple font-bold leading-none">{date.getDate()}</span>
 <span className="text-[9px] text-pixel-purple">{date.toLocaleDateString('id-ID', { month: 'short' })}</span>
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
 </div>
 )
}
