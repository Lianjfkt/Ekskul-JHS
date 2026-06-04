import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import AnnouncementBanner from '../../components/shared/AnnouncementBanner'
import { 
  Activity, CalendarDays, ClipboardCheck, GraduationCap, 
  ArrowRight, Users, PlayCircle, Clock
} from 'lucide-react'

export default function CoachDashboard() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [managedEkskuls, setManagedEkskuls] = useState([])
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalStudents: 0
  })

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
        .eq('coach_id', user.id)
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
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12 scale-150">
          <Activity className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Selamat Datang Pelatih!</h1>
          <p className="text-slate-300 max-w-xl text-sm md:text-base">
            Gunakan portal ini untuk mencatat materi latihan (sesi), mengabsen kehadiran siswa, dan menginput nilai perkembangan ekstrakurikuler.
          </p>
          <p className="text-xs text-slate-400 font-mono">Email: {user?.email}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-500">Ekskul Asuhan</p>
              <h3 className="text-3xl font-extrabold text-slate-900">
                {loading ? '...' : managedEkskuls.length}
              </h3>
              <p className="text-xs text-slate-400">Jumlah ekskul yang Anda latih</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600">
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-500">Total Sesi Latihan</p>
              <h3 className="text-3xl font-extrabold text-slate-900">
                {loading ? '...' : stats.totalSessions}
              </h3>
              <p className="text-xs text-slate-400">Total pertemuan yang telah diadakan</p>
            </div>
            <div className="p-4 rounded-xl bg-sky-50 text-sky-600">
              <CalendarDays className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-500">Siswa Binaan Aktif</p>
              <h3 className="text-3xl font-extrabold text-slate-900">
                {loading ? '...' : stats.totalStudents}
              </h3>
              <p className="text-xs text-slate-400">Siswa aktif terdaftar di ekskul Anda</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Ekskul List & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Managed Extracurriculars */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-slate-800">Ekskul yang Anda Asuh</h2>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Memuat data ekskul...</div>
          ) : managedEkskuls.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-dashed text-center text-slate-400">
              Anda belum ditunjuk untuk mengasuh ekstrakurikuler apa pun oleh Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {managedEkskuls.map(ekskul => (
                <Card key={ekskul.id} className="border-slate-100 shadow-sm bg-white hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
                  <CardContent className="p-6 space-y-3">
                    <h3 className="font-bold text-slate-900 text-lg">{ekskul.name}</h3>
                    <p className="text-slate-500 text-sm line-clamp-2">{ekskul.description || 'Tidak ada deskripsi.'}</p>
                    <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Jadwal: <strong className="text-slate-700">{ekskul.schedule || 'Belum diatur'}</strong>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-slate-800">Aksi Cepat Pelatih</h2>
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardContent className="p-4 space-y-3">
              <Link to="/coach/sessions" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 text-sky-600 rounded">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Jadwal & Topik Sesi</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link to="/coach/attendances" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Catat Kehadiran Siswa</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link to="/coach/grades" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Input Nilai Perkembangan</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
