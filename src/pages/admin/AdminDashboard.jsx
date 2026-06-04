import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  GraduationCap, Activity, UserCheck, BookOpen, 
  ArrowRight, Plus, Upload, Users as UsersIcon, Clock
} from 'lucide-react'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalEkskul: 0,
    totalCoaches: 0,
    totalEnrollments: 0
  })
  const [recentEnrollments, setRecentEnrollments] = useState([])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // 1. Get total students
      const { count: studentCount, error: sErr } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
      if (sErr) throw sErr

      // 2. Get total extracurriculars
      const { count: ekskulCount, error: eErr } = await supabase
        .from('extracurriculars')
        .select('*', { count: 'exact', head: true })
      if (eErr) throw eErr

      // 3. Get total coaches
      const { count: coachCount, error: cErr } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'coach')
      if (cErr) throw cErr

      // 4. Get total active enrollments
      const { count: enrollmentCount, error: enErr } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
      if (enErr) throw enErr

      setStats({
        totalStudents: studentCount || 0,
        totalEkskul: ekskulCount || 0,
        totalCoaches: coachCount || 0,
        totalEnrollments: enrollmentCount || 0
      })

      // 5. Get recent enrollments (limit 5)
      const { data: recData, error: recErr } = await supabase
        .from('enrollments')
        .select(`
          id,
          enrolled_at,
          status,
          student:student_id (full_name, class),
          extracurricular:extracurricular_id (name)
        `)
        .order('enrolled_at', { ascending: false })
        .limit(5)
      if (recErr) throw recErr
      setRecentEnrollments(recData || [])

    } catch (err) {
      console.error('Error fetching dashboard stats:', err.message)
    } finally {
      setLoading(false)
    }
  }

  // Card items config
  const statCards = [
    {
      title: 'Total Siswa',
      value: stats.totalStudents,
      description: 'Siswa terdaftar di database',
      icon: GraduationCap,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Total Ekskul',
      value: stats.totalEkskul,
      description: 'Ekstrakurikuler aktif & non-aktif',
      icon: Activity,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50'
    },
    {
      title: 'Pelatih Aktif',
      value: stats.totalCoaches,
      description: 'Pengajar ekskul terdaftar',
      icon: UserCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'Pendaftaran Aktif',
      value: stats.totalEnrollments,
      description: 'Siswa aktif mengikuti ekskul',
      icon: BookOpen,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-2xl text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12 scale-150">
          <Activity className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Selamat Datang di Portal Admin</h1>
          <p className="text-slate-300 max-w-xl text-sm md:text-base">
            Gunakan panel ini untuk mengelola siswa, pendidik/pelatih, ekstrakurikuler sekolah, dan laporan absensi secara real-time.
          </p>
        </div>
      </div>

      {/* Grid Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <Card key={idx} className="border-slate-100 hover:shadow-md transition-shadow shadow-sm overflow-hidden bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-500">{card.title}</p>
                  <h3 className="text-3xl font-extrabold text-slate-900">
                    {loading ? '...' : card.value}
                  </h3>
                  <p className="text-xs text-slate-400">{card.description}</p>
                </div>
                <div className={`p-4 rounded-xl ${card.bgColor} ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Grid: Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Links / Actions */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-slate-800">Aksi Cepat</h2>
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardContent className="p-4 space-y-3">
              <Link to="/admin/users" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Kelola & Import Siswa</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link to="/admin/extracurriculars" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 text-sky-600 rounded">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Kelola Ekstrakurikuler</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link to="/admin/enrollments" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Pendaftaran Ekskul Siswa</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Enrollments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Pendaftaran Terbaru</h2>
            <Link to="/admin/enrollments" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <Card className="border-slate-100 shadow-sm bg-white">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-slate-400 text-sm">Memuat aktivitas...</div>
              ) : recentEnrollments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">Belum ada aktivitas pendaftaran siswa baru.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentEnrollments.map(rec => (
                    <div key={rec.id} className="p-4 flex items-center justify-between text-sm hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full mt-0.5">
                          <UsersIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{rec.student?.full_name}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            Mendaftar ke ekskul <strong className="text-slate-700">{rec.extracurricular?.name}</strong> • Kelas {rec.student?.class}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-2xs font-semibold uppercase ${
                          rec.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rec.status === 'active' ? 'Aktif' : rec.status}
                        </span>
                        <p className="text-2xs text-slate-400 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(rec.enrolled_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
