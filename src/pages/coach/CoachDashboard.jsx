import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import AnnouncementBanner from '../../components/shared/AnnouncementBanner'
import { 
  Activity, CalendarDays, ClipboardCheck, GraduationCap, 
  ArrowRight, Users, Clock, AlertTriangle, TrendingUp, CheckCircle,
  Award, Star, MessageSquare, ShieldCheck
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts'
import { isSessionApplicableToStudent, evaluateAttendanceRisk } from '../../utils/attendanceRiskEngine'

export default function CoachDashboard() {
 const { user } = useAuthStore()
 const [loading, setLoading] = useState(true)
 const [managedEkskuls, setManagedEkskuls] = useState([])
 const [stats, setStats] = useState({
  totalSessions: 0,
  totalStudents: 0
 })
  
  // Data for charts and warnings
 const [attendanceTrend, setAttendanceTrend] = useState([])
  const [attendanceWarnings, setAttendanceWarnings] = useState([])
  const [selectedEkskulFilter, setSelectedEkskulFilter] = useState('')

  // Data for student coach evaluations (Anonymous)
  const [evaluationsList, setEvaluationsList] = useState([])
  const [evalStats, setEvalStats] = useState({
    avgRating: '0',
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  })

  // Memoize filtered warnings agar tidak dihitung 2x di JSX (count + map)
  const filteredWarnings = useMemo(
    () => attendanceWarnings.filter(w => !selectedEkskulFilter || w.ekskulId === selectedEkskulFilter),
    [attendanceWarnings, selectedEkskulFilter]
  )

 useEffect(() => {
 if (user) {
 fetchCoachData()
 }
 }, [user])

  const fetchCoachData = async () => {
    setLoading(true)
    try {
      // 1. Fetch extracurriculars managed by this coach
      const { data: ekskuls, error: eErr } = await supabase
        .from('extracurriculars')
        .select('*, is_mandatory, mandatory_class')
        .or(`coach_id.eq.${user.id},coach_id_2.eq.${user.id},coach_id_3.eq.${user.id}`)
      if (eErr) throw eErr
      setManagedEkskuls(ekskuls || [])

      if (ekskuls && ekskuls.length > 0) {
        const ekskulIds = ekskuls.map(e => e.id)

        // 1. Paralelisasi query tahap 1 (metadata sesi, siswa aktif, dan list sesi)
        const [
          { count: sessionCount, error: sErr },
          { count: studentCount, error: stErr },
          { data: recentSessions },
          { data: activeStudents },
          { data: allSessions }
        ] = await Promise.all([
          supabase.from('sessions').select('*', { count: 'exact', head: true }).in('extracurricular_id', ekskulIds),
          supabase.from('enrollments').select('*', { count: 'exact', head: true }).in('extracurricular_id', ekskulIds).eq('status', 'active'),
          supabase.from('sessions').select(`id, session_date, topic, extracurricular_id, extracurriculars (name)`).in('extracurricular_id', ekskulIds).order('session_date', { ascending: false }).limit(8),
          supabase.from('enrollments').select('student_id, students(id, full_name, class, nis), extracurricular_id, extracurriculars(id, name, is_mandatory, mandatory_class)').in('extracurricular_id', ekskulIds).eq('status', 'active'),
          supabase.from('sessions').select('id, session_date, extracurricular_id, is_special_training, target_class, attendance_submitted').in('extracurricular_id', ekskulIds)
        ])

        if (sErr) throw sErr
        if (stErr) throw stErr

        setStats({
          totalSessions: sessionCount || 0,
          totalStudents: studentCount || 0
        })

        const recentSessionIds = (recentSessions || []).map(s => s.id)
        const allSessionIds = (allSessions || []).map(s => s.id)

        // 2. Paralelisasi query tahap 2 (absensi grafik, absensi evaluasi risiko, dan peserta khusus)
        const [attsRes, allAttsRes, specialPartsRes] = await Promise.all([
          recentSessionIds.length > 0 
            ? supabase.from('attendances').select('session_id, status').in('session_id', recentSessionIds)
            : Promise.resolve({ data: [] }),
          (allSessionIds.length > 0 && activeStudents && activeStudents.length > 0)
            ? supabase.from('attendances').select('id, student_id, session_id, status').in('session_id', allSessionIds)
            : Promise.resolve({ data: [] }),
          (allSessionIds.length > 0 && activeStudents && activeStudents.length > 0)
            ? supabase.from('special_session_participants').select('session_id, student_id').in('session_id', allSessionIds)
            : Promise.resolve({ data: [] })
        ])

        const atts = attsRes.data || []
        const allAtts = allAttsRes.data || []
        const specialParts = specialPartsRes.data || []

        // 3. Olah data grafik tren kehadiran
        let chartData = []
        if (recentSessions && recentSessions.length > 0) {
          chartData = [...recentSessions].reverse().map(session => {
            const sessionAtts = atts.filter(a => a.session_id === session.id)
            const total = sessionAtts.length
            const present = sessionAtts.filter(a => a.status === 'hadir').length
            const percentage = total > 0 ? Math.round((present / total) * 100) : 0
            return {
              name: new Date(session.session_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
              topic: session.topic,
              ekskul: session.extracurriculars?.name,
              kehadiran: percentage,
              total_siswa: total
            }
          })
        }
        setAttendanceTrend(chartData)

        // 4. Evaluasi siswa bermasalah absensi
        const warnings = []
        if (activeStudents && activeStudents.length > 0 && allSessions && allSessions.length > 0) {
          activeStudents.forEach(enr => {
            const ekskul = ekskuls.find(e => e.id === enr.extracurricular_id) || enr.extracurriculars
            const student = enr.students
            if (!student || !ekskul) return

            const ekskulSessions = allSessions.filter(s => s.extracurricular_id === enr.extracurricular_id)
            const validSessions = ekskulSessions.filter(s => 
              isSessionApplicableToStudent(s, student, specialParts, allAtts)
            )

            const validSessionIds = new Set(validSessions.map(s => s.id))
            const studentAtts = allAtts.filter(a => a.student_id === enr.student_id && validSessionIds.has(a.session_id))
            
            if (validSessions.length === 0 && studentAtts.length === 0) return

            const risk = evaluateAttendanceRisk({
              student,
              ekskul,
              studentAtts,
              validSessions
            })

            if (risk.isAtRisk) {
              warnings.push({
                id: enr.student_id + enr.extracurricular_id,
                ekskulId: enr.extracurricular_id,
                name: student.full_name,
                class: student.class,
                ekskul: ekskul.name,
                percentage: risk.percentage,
                consecutiveAlpha: risk.consecutiveAlpha,
                maxConsecutiveAlpha: risk.maxConsecutiveAlpha,
                alphaCount: risk.alpha,
                isMandatory: risk.isMandatory,
                warningLevel: risk.warningLevel,
                warningLabel: risk.warningLabel,
                warningReasons: risk.warningReasons,
                riskTags: risk.riskTags
              })
            }
          })
        }

        setAttendanceWarnings(warnings.sort((a,b) => {
          if (a.warningLevel !== b.warningLevel) return a.warningLevel === 'TEGURAN' ? -1 : 1
          return a.percentage - b.percentage
        }))
      }

      // Fetch coach evaluations (Anonim - tanpa profil/identitas siswa)
      try {
        const { data: evals } = await supabase
          .from('coach_evaluations')
          .select('id, rating, feedback, semester, academic_year, created_at, extracurricular_id, extracurriculars(name)')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })

        if (evals) {
          const count = evals.length
          let sum = 0
          const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
          evals.forEach((ev) => {
            sum += ev.rating
            if (dist[ev.rating] !== undefined) dist[ev.rating]++
          })
          const avg = count > 0 ? (sum / count).toFixed(1) : '0'
          setEvaluationsList(evals)
          setEvalStats({ avgRating: avg, totalReviews: count, distribution: dist })
        }
      } catch (evErr) {
        console.warn('Tabel coach_evaluations mungkin belum tersedia:', evErr.message)
      }
    } catch (err) {
      console.error('Error fetching coach dashboard data:', err.message)
    } finally {
      setLoading(false)
    }
  }

 return (
 <div className="space-y-8">
 <AnnouncementBanner />
 {/* Welcome Banner */}
 <div className="bg-pixel-navy p-6 md:p-8 rounded-none text-pixel-white shadow-pixel relative overflow-hidden">
 <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12 scale-150">
 <Activity className="w-80 h-80 text-pixel-white" />
 </div>
 <div className="relative z-10 space-y-2">
 <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Selamat Datang Pelatih!</h1>
 <p className="text-pixel-peach max-w-xl text-sm md:text-base">
 Gunakan portal ini untuk mencatat materi latihan (sesi), mengabsen kehadiran siswa, dan menginput nilai perkembangan ekstrakurikuler.
 </p>
 <p className="text-xs text-pixel-lavender font-mono">Email: {user?.email}</p>
 </div>
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel">
 <CardContent className="p-6 flex items-center justify-between">
 <div className="space-y-1">
 <p className="font-retro text-lg text-pixel-lavender">Ekskul Asuhan</p>
 <h3 className="text-3xl font-extrabold text-pixel-white">
 {loading ? '...' : managedEkskuls.length}
 </h3>
 <p className="text-xs text-pixel-lavender">Jumlah ekskul yang Anda latih</p>
 </div>
 <div className="p-4 rounded-none bg-pixel-blue/10 text-pixel-blue">
 <Activity className="w-6 h-6" />
 </div>
 </CardContent>
 </Card>

 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel">
 <CardContent className="p-6 flex items-center justify-between">
 <div className="space-y-1">
 <p className="font-retro text-lg text-pixel-lavender">Total Sesi Latihan</p>
 <h3 className="text-3xl font-extrabold text-pixel-white">
 {loading ? '...' : stats.totalSessions}
 </h3>
 <p className="text-xs text-pixel-lavender">Total pertemuan yang telah diadakan</p>
 </div>
 <div className="p-4 rounded-none bg-pixel-green/10 text-pixel-green">
 <CalendarDays className="w-6 h-6" />
 </div>
 </CardContent>
 </Card>

 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel">
 <CardContent className="p-6 flex items-center justify-between">
 <div className="space-y-1">
 <p className="font-retro text-lg text-pixel-lavender">Siswa Binaan Aktif</p>
 <h3 className="text-3xl font-extrabold text-pixel-white">
 {loading ? '...' : stats.totalStudents}
 </h3>
 <p className="text-xs text-pixel-lavender">Siswa aktif terdaftar di ekskul Anda</p>
 </div>
 <div className="p-4 rounded-none bg-pixel-green/10 text-pixel-green">
 <Users className="w-6 h-6" />
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Main Grid: Ekskul List & Quick Links */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 
 {/* Managed Extracurriculars */}
 <div className="lg:col-span-2 space-y-6">
 <h2 className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white">Ekskul yang Anda Asuh</h2>
 {loading ? (
 <div className="p-8 text-center text-pixel-lavender">Memuat data ekskul...</div>
 ) : managedEkskuls.length === 0 ? (
 <div className="bg-pixel-panel p-8 rounded-none border border-dashed text-center text-pixel-lavender">
 Anda belum ditunjuk untuk mengasuh ekstrakurikuler apa pun oleh Admin.
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {managedEkskuls.map(ekskul => (
 <Card key={ekskul.id} className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel hover:brightness-110 transition-shadow relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
 <CardContent className="p-6 space-y-3">
 <h3 className="font-bold text-pixel-white text-lg">{ekskul.name}</h3>
 <p className="text-pixel-lavender text-sm line-clamp-2">{ekskul.description || 'Tidak ada deskripsi.'}</p>
 <div className="border-t border-pixel-gray/30 pt-3 text-xs text-pixel-lavender flex items-center gap-1">
 <Clock className="w-3.5 h-3.5" />
 Jadwal: <strong className="text-pixel-peach">{ekskul.schedule || 'Belum diatur'}</strong>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

        {/* Attendance Trend Chart */}
        {!loading && attendanceTrend.length > 0 && (
          <div className="mt-8">
            <h2 className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pixel-blue" />
              Tren Kehadiran Sesi Terakhir
            </h2>
            <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel">
              <CardContent className="p-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4f5b72" opacity={0.3} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#b8c0e0" 
                      tick={{ fontFamily: "'VT323', monospace", fontSize: 14 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#b8c0e0" 
                      tick={{ fontFamily: "'VT323', monospace", fontSize: 14 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#1b233a', 
                        border: '2px solid #4f5b72',
                        fontFamily: "'VT323', monospace",
                      }}
                      formatter={(value, name) => [
                        name === 'kehadiran' ? `${value}%` : value, 
                        name === 'kehadiran' ? 'Kehadiran' : 'Siswa'
                      ]}
                      labelStyle={{ color: '#ffb3a7', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontFamily: "'VT323', monospace", paddingTop: '10px' }} />
                    <Bar dataKey="kehadiran" name="Kehadiran" fill="#6488ea" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
 </div>

 {/* Quick Actions */}
 <div className="lg:col-span-1 space-y-6">
 <h2 className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white">Aksi Cepat Pelatih</h2>
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel">
 <CardContent className="p-4 space-y-3">
 <Link to="/coach/sessions" className="flex items-center justify-between p-3 rounded-none border border-pixel-gray/30 hover:bg-pixel-navy group">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-pixel-green/10 text-pixel-green rounded">
 <CalendarDays className="w-4 h-4" />
 </div>
 <span className="font-retro text-lg text-pixel-peach">Jadwal & Topik Sesi</span>
 </div>
 <ArrowRight className="w-4 h-4 text-pixel-lavender group-hover:translate-x-1" />
 </Link>

 <Link to="/coach/attendances" className="flex items-center justify-between p-3 rounded-none border border-pixel-gray/30 hover:bg-pixel-navy group">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-pixel-green/10 text-pixel-green rounded">
 <ClipboardCheck className="w-4 h-4" />
 </div>
 <span className="font-retro text-lg text-pixel-peach">Catat Kehadiran Siswa</span>
 </div>
 <ArrowRight className="w-4 h-4 text-pixel-lavender group-hover:translate-x-1" />
 </Link>

 <Link to="/coach/grades" className="flex items-center justify-between p-3 rounded-none border border-pixel-gray/30 hover:bg-pixel-navy group">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-amber-50 text-pixel-orange rounded">
 <GraduationCap className="w-4 h-4" />
 </div>
 <span className="font-retro text-lg text-pixel-peach">Input Nilai Perkembangan</span>
 </div>
 <ArrowRight className="w-4 h-4 text-pixel-lavender group-hover:translate-x-1" />
 </Link>
 </CardContent>
 </Card>

           {/* Low Attendance Warnings */}
           {!loading && (
             <div className="pt-2">
               <h2 className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white mb-4 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-pixel-red" />
                 Siswa Perlu Perhatian
               </h2>
               <Card className="border-pixel-red/50 shadow-pixel-sm bg-pixel-panel overflow-hidden">
                 <div className="bg-pixel-red/20 text-pixel-red text-xs p-3 font-retro font-semibold border-b border-pixel-red/30 space-y-2">
                   <div className="flex items-center justify-between">
                     <span>Warning Kehadiran</span>
                     <span className="bg-pixel-red text-white px-2 py-0.5 rounded">
                       {filteredWarnings.length} Siswa
                     </span>
                   </div>
                   <div>
                     <select
                       value={selectedEkskulFilter}
                       onChange={e => setSelectedEkskulFilter(e.target.value)}
                       className="w-full text-[11px] bg-pixel-panel border border-pixel-red/30 rounded px-2 py-1 text-pixel-peach focus:outline-none"
                     >
                       <option value="">Semua Ekskul Asuhan</option>
                       {managedEkskuls.map(e => (
                         <option key={e.id} value={e.id}>{e.name}</option>
                       ))}
                     </select>
                   </div>
                 </div>
                 <CardContent className="p-0">
                   <div className="max-h-[360px] overflow-y-auto pixel-scroll divide-y divide-pixel-gray/30">
                      {filteredWarnings.length > 0 ? (
                        filteredWarnings
                          .map(student => (
                         <div key={student.id} className={`p-4 hover:bg-pixel-navy/30 transition-colors border-l-2 ${
                           student.warningLevel === 'TEGURAN' ? 'border-l-pixel-red' : 'border-l-amber-500'
                         }`}>
                           <div className="flex justify-between items-start mb-1">
                             <p className="font-semibold text-pixel-white text-sm">{student.name}</p>
                             <span className={`font-mono font-bold text-sm ${student.percentage < 60 ? 'text-pixel-red' : 'text-amber-400'}`}>
                               {student.percentage}%
                             </span>
                           </div>
                           <div className="flex justify-between items-center text-xs text-pixel-lavender">
                             <span>{student.ekskul}{student.isMandatory ? ' (Wajib)' : ''}</span>
                             <span className="bg-pixel-gray/50 px-1.5 py-0.5 rounded text-[10px]">{student.class}</span>
                           </div>
                           <div className="mt-1 flex flex-wrap gap-1 items-center">
                             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                               student.warningLevel === 'TEGURAN'
                                 ? 'bg-pixel-red/20 text-pixel-red'
                                 : 'bg-amber-900/30 text-amber-400'
                             }`}>
                               {student.warningLevel}
                             </span>
                             {student.warningReasons?.map((reason, ri) => (
                               <span key={ri} className="text-[9px] bg-pixel-navy text-pixel-lavender border border-pixel-gray/30 px-1 py-0.5 rounded">
                                 {reason}
                               </span>
                             ))}
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="p-6 text-center text-pixel-lavender text-xs space-y-2">
                         <CheckCircle className="w-8 h-8 text-pixel-green mx-auto" />
                         <p>Tidak ada siswa bermasalah di ekskul ini. 🎉</p>
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>
             </div>
           )}
 </div>

 </div>

      {/* Seksi Evaluasi Siswa (Anonim) */}
      {!loading && (
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white flex items-center gap-2">
                <Award className="w-5 h-5 text-pixel-yellow" />
                Evaluasi & Ulasan Siswa (Semester 1)
              </h2>
              <p className="text-xs text-pixel-lavender font-retro">
                Ulasan dan tingkat kepuasan siswa terhadap proses latihan. Semua identitas siswa bersifat rahasia/anonim.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-pixel-green/10 border border-pixel-green/30 text-pixel-green text-xs font-retro">
              <ShieldCheck className="w-4 h-4 text-pixel-green" />
              <span>Privasi Terlindungi (Anonim)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card Ringkasan Skor */}
            <Card className="border-pixel-gray/40 shadow-pixel-sm bg-pixel-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-pixel text-pixel-white">Rata-rata Penilaian</CardTitle>
                <CardDescription className="text-xs text-pixel-lavender">Skala skor kepuasan 1 - 5 bintang</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-pixel text-pixel-yellow tracking-tight">
                    {evalStats.avgRating}
                  </div>
                  <div>
                    <div className="flex items-center text-pixel-yellow">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= Math.round(Number(evalStats.avgRating))
                              ? 'fill-pixel-yellow text-pixel-yellow'
                              : 'text-pixel-gray/40'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-pixel-lavender font-retro mt-1">
                      Berdasarkan {evalStats.totalReviews} ulasan siswa
                    </div>
                  </div>
                </div>

                {/* Star Distribution */}
                <div className="space-y-1.5 pt-2 border-t border-pixel-gray/20 font-retro text-xs">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = evalStats.distribution[star] || 0
                    const pct = evalStats.totalReviews > 0 ? Math.round((count / evalStats.totalReviews) * 100) : 0
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="w-12 text-pixel-lavender flex items-center gap-0.5">
                          {star} <Star className="w-3 h-3 fill-pixel-yellow text-pixel-yellow inline" />
                        </span>
                        <div className="flex-1 h-2 bg-pixel-navy rounded-none overflow-hidden">
                          <div
                            className="h-full bg-pixel-yellow transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-pixel-white font-mono text-[11px]">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* List Masukan / Feedback Siswa (Anonim) */}
            <Card className="lg:col-span-2 border-pixel-gray/40 shadow-pixel-sm bg-pixel-panel flex flex-col">
              <CardHeader className="pb-3 border-b border-pixel-gray/20">
                <CardTitle className="text-sm font-pixel text-pixel-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-pixel-peach" />
                    Kesan & Saran dari Siswa
                  </span>
                  <span className="text-[10px] font-retro text-pixel-peach font-normal">
                    {evaluationsList.length} Masukan Diterima
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                <div className="max-h-[380px] overflow-y-auto pixel-scroll divide-y divide-pixel-gray/20 p-4 space-y-3">
                  {evaluationsList.length > 0 ? (
                    evaluationsList.map((ev) => (
                      <div key={ev.id} className="p-3 bg-pixel-navy/60 border border-pixel-gray/30 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="flex text-pixel-yellow">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    s <= ev.rating ? 'fill-pixel-yellow text-pixel-yellow' : 'text-pixel-gray/30'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-pixel-yellow font-bold font-retro">({ev.rating}/5)</span>
                          </div>
                          <span className="text-[10px] text-pixel-lavender font-mono">
                            {ev.created_at ? new Date(ev.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </div>

                        <div className="text-xs text-pixel-peach font-retro">
                          Ekstrakurikuler: <span className="text-pixel-white font-semibold">{ev.extracurriculars?.name || 'Ekskul'}</span>
                        </div>

                        <div className="text-sm text-pixel-white font-retro bg-pixel-panel/80 p-2.5 border border-pixel-gray/20 italic">
                          "{ev.feedback || <span className="text-pixel-lavender not-italic text-xs">Siswa tidak menyertakan saran tertulis.</span>}"
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-pixel-lavender text-xs space-y-2">
                      <Award className="w-10 h-10 text-pixel-gray/40 mx-auto" />
                      <p className="font-retro text-sm">Belum ada penilaian siswa yang masuk untuk semester ini.</p>
                      <p className="text-[11px] text-pixel-lavender/60">
                        Hasil evaluasi dan saran akan muncul di sini secara anonim saat siswa mengisi di portal mereka.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
 </div>
 )
}
