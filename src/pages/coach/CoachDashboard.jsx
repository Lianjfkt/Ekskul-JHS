import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import AnnouncementBanner from '../../components/shared/AnnouncementBanner'
import { 
  Activity, CalendarDays, ClipboardCheck, GraduationCap, 
  ArrowRight, Users, PlayCircle, Clock, AlertTriangle, TrendingUp
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts'

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
 .select('*')
 .or(`coach_id.eq.${user.id},coach_id_2.eq.${user.id},coach_id_3.eq.${user.id}`)
 if (eErr) throw eErr
 setManagedEkskuls(ekskuls || [])

 if (ekskuls && ekskuls.length > 0) {
 const ekskulIds = ekskuls.map(e => e.id)

 // 2. Fetch total sessions held in these extracurriculars
 const { count: sessionCount, error: sErr } = await supabase
 .from('sessions')
 .select('*', { count: 'exact', head: true })
 .in('extracurricular_id', ekskulIds)
 if (sErr) throw sErr

 // 3. Fetch total students enrolled in these extracurriculars
 const { count: studentCount, error: stErr } = await supabase
 .from('enrollments')
 .select('*', { count: 'exact', head: true })
 .in('extracurricular_id', ekskulIds)
 .eq('status', 'active')
 if (stErr) throw stErr

      setStats({
        totalSessions: sessionCount || 0,
        totalStudents: studentCount || 0
      })
      
      // 4. Fetch recent sessions for chart
      const { data: recentSessions } = await supabase
        .from('sessions')
        .select(`id, date, topic, extracurricular_id, extracurriculars (name)`)
        .in('extracurricular_id', ekskulIds)
        .order('date', { ascending: false })
        .limit(8)
        
      let chartData = []
      if (recentSessions && recentSessions.length > 0) {
        const sessionIds = recentSessions.map(s => s.id)
        const { data: atts } = await supabase
          .from('attendances')
          .select('session_id, status')
          .in('session_id', sessionIds)
          
        chartData = [...recentSessions].reverse().map(session => {
          const sessionAtts = atts?.filter(a => a.session_id === session.id) || []
          const total = sessionAtts.length
          const present = sessionAtts.filter(a => a.status === 'hadir').length
          const percentage = total > 0 ? Math.round((present / total) * 100) : 0
          return {
            name: new Date(session.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            topic: session.topic,
            ekskul: session.extracurriculars?.name,
            kehadiran: percentage,
            total_siswa: total
          }
        })
      }
      setAttendanceTrend(chartData)
      
      // 5. Identify students with < 75% attendance
      const { data: activeStudents } = await supabase
        .from('enrollments')
        .select('student_id, students(full_name, class), extracurricular_id, extracurriculars(name)')
        .in('extracurricular_id', ekskulIds)
        .eq('status', 'active')
        
      let warnings = []
      if (activeStudents && activeStudents.length > 0) {
        const { data: allSessions } = await supabase.from('sessions').select('id, extracurricular_id').in('extracurricular_id', ekskulIds)
        if (allSessions && allSessions.length > 0) {
           const allSessionIds = allSessions.map(s => s.id)
           const { data: allAtts } = await supabase.from('attendances').select('student_id, session_id, status').in('session_id', allSessionIds)
           
           if (allAtts) {
              activeStudents.forEach(enr => {
                 const ekskulSessions = allSessions.filter(s => s.extracurricular_id === enr.extracurricular_id)
                 const ekskulSessionIds = ekskulSessions.map(s => s.id)
                 const studentAtts = allAtts.filter(a => a.student_id === enr.student_id && ekskulSessionIds.includes(a.session_id))
                 
                 // Warn only if there are at least 3 sessions
                 if (studentAtts.length >= 3) { 
                    const total = studentAtts.length
                    const present = studentAtts.filter(a => a.status === 'hadir').length
                    const percentage = Math.round((present / total) * 100)
                    if (percentage < 75) {
                       warnings.push({
                          id: enr.student_id + enr.extracurricular_id, // unique key
                          name: enr.students?.full_name,
                          class: enr.students?.class,
                          ekskul: enr.extracurriculars?.name,
                          percentage
                       })
                    }
                 }
              })
           }
        }
      }
      setAttendanceWarnings(warnings.sort((a,b) => a.percentage - b.percentage))

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
          {!loading && attendanceWarnings.length > 0 && (
            <div className="pt-2">
              <h2 className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-pixel-red" />
                Perlu Perhatian Khusus
              </h2>
              <Card className="border-pixel-red/50 shadow-pixel-sm bg-pixel-panel overflow-hidden">
                <div className="bg-pixel-red/20 text-pixel-red text-xs p-3 font-retro font-semibold border-b border-pixel-red/30 flex items-center justify-between">
                  <span>Kehadiran &lt; 75%</span>
                  <span className="bg-pixel-red text-white px-2 py-0.5 rounded">{attendanceWarnings.length} Siswa</span>
                </div>
                <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-y-auto pixel-scroll divide-y divide-pixel-gray/30">
                    {attendanceWarnings.map(student => (
                      <div key={student.id} className="p-4 hover:bg-pixel-navy/30 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-semibold text-pixel-white text-sm">{student.name}</p>
                          <span className={`font-mono font-bold text-sm ${student.percentage < 50 ? 'text-pixel-red' : 'text-pixel-yellow'}`}>
                            {student.percentage}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-pixel-lavender">
                          <span>{student.ekskul}</span>
                          <span className="bg-pixel-gray/50 px-1.5 py-0.5 rounded text-[10px]">{student.class}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
 </div>

 </div>
 </div>
 )
}
