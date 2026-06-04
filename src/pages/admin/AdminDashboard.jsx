import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { announcementService } from '../../utils/announcementService'
import { auditLogService } from '../../utils/auditLogService'
import { 
  GraduationCap, Activity, UserCheck, BookOpen, 
  ArrowRight, Plus, Upload, Users as UsersIcon, Clock,
  Megaphone, ShieldAlert, Trash2, Eye, EyeOff, Search
} from 'lucide-react'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalEkskul: 0,
    totalCoaches: 0,
    totalEnrollments: 0
  })
  const [recentEnrollments, setRecentEnrollments] = useState([])
  
  // Announcements state
  const [announcements, setAnnouncements] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [annLoading, setAnnLoading] = useState(false)

  // Audit Logs state
  const [logs, setLogs] = useState([])
  const [searchLogQuery, setSearchLogQuery] = useState('')

  useEffect(() => {
    fetchStats()
    loadAnnouncements()
    loadAuditLogs()
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

  const loadAnnouncements = async () => {
    try {
      const data = await announcementService.getAllAnnouncements()
      setAnnouncements(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadAuditLogs = async () => {
    try {
      const data = await auditLogService.getLogs()
      setLogs(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return
    setAnnLoading(true)
    try {
      await announcementService.createAnnouncement(newTitle, newContent, user?.id)
      await auditLogService.logEvent(user?.id, user?.email, 'CREATE_ANNOUNCEMENT', `Membuat pengumuman: ${newTitle}`)
      setNewTitle('')
      setNewContent('')
      await loadAnnouncements()
      await loadAuditLogs()
    } catch (err) {
      console.error(err)
    } finally {
      setAnnLoading(false)
    }
  }

  const handleToggleAnnouncement = async (id, currentStatus, title) => {
    try {
      await announcementService.toggleAnnouncementStatus(id, !currentStatus)
      await auditLogService.logEvent(
        user?.id, 
        user?.email, 
        'TOGGLE_ANNOUNCEMENT', 
        `Mengubah status pengumuman "${title}" menjadi ${!currentStatus ? 'Aktif' : 'Nonaktif'}`
      )
      await loadAnnouncements()
      await loadAuditLogs()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteAnnouncement = async (id, title) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) return
    try {
      await announcementService.deleteAnnouncement(id)
      await auditLogService.logEvent(user?.id, user?.email, 'DELETE_ANNOUNCEMENT', `Menghapus pengumuman: ${title}`)
      await loadAnnouncements()
      await loadAuditLogs()
    } catch (err) {
      console.error(err)
    }
  }

  // Filter logs based on query
  const filteredLogs = logs.filter(log => 
    log.user_email?.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchLogQuery.toLowerCase())
  )

  // Card items config
  const statCards = [
    {
      title: 'Total Siswa',
      value: stats.totalStudents,
      description: 'Siswa terdaftar di database',
      icon: GraduationCap,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40'
    },
    {
      title: 'Total Ekskul',
      value: stats.totalEkskul,
      description: 'Ekstrakurikuler aktif & non-aktif',
      icon: Activity,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-50 dark:bg-sky-950/40'
    },
    {
      title: 'Pelatih Aktif',
      value: stats.totalCoaches,
      description: 'Pengajar ekskul terdaftar',
      icon: UserCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40'
    },
    {
      title: 'Pendaftaran Aktif',
      value: stats.totalEnrollments,
      description: 'Siswa aktif mengikuti ekskul',
      icon: BookOpen,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 rounded-2xl text-white shadow-lg border border-slate-800 dark:border-slate-700 relative overflow-hidden">
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

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'dashboard'
              ? 'text-primary dark:text-indigo-400 border-b-2 border-primary dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Ringkasan Dashboard
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'announcements'
              ? 'text-primary dark:text-indigo-400 border-b-2 border-primary dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Kelola Pengumuman
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'logs'
              ? 'text-primary dark:text-indigo-400 border-b-2 border-primary dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Log Audit & Keamanan
        </button>
      </div>

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((card, idx) => {
              const Icon = card.icon
              return (
                <Card key={idx} className="border-slate-100 dark:border-slate-800 hover:shadow-md transition-all shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{card.title}</p>
                      <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {loading ? '...' : card.value}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{card.description}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${card.bgColor} ${card.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Aksi Cepat</h2>
              <Card className="border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <CardContent className="p-4 space-y-3">
                  <Link to="/admin/users" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kelola & Import Siswa</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <Link to="/admin/extracurriculars" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded">
                        <Activity className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kelola Ekstrakurikuler</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <Link to="/admin/enrollments" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pendaftaran Ekskul Siswa</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pendaftaran Terbaru</h2>
                <Link to="/admin/enrollments" className="text-xs font-semibold text-primary dark:text-indigo-400 hover:underline flex items-center gap-1">
                  Lihat Semua <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <Card className="border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-6 text-center text-slate-400 text-sm">Memuat aktivitas...</div>
                  ) : recentEnrollments.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">Belum ada aktivitas pendaftaran siswa baru.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {recentEnrollments.map(rec => (
                        <div key={rec.id} className="p-4 flex items-center justify-between text-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full mt-0.5">
                              <UsersIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{rec.student?.full_name}</p>
                              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                                Mendaftar ke ekskul <strong className="text-slate-700 dark:text-slate-300">{rec.extracurricular?.name}</strong> • Kelas {rec.student?.class}
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-2xs font-semibold uppercase ${
                              rec.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {rec.status === 'active' ? 'Aktif' : rec.status}
                            </span>
                            <p className="text-2xs text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1">
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
      )}

      {/* Tab: Announcements */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Announcement Form */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Buat Pengumuman Baru</h2>
            <Card className="border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardContent className="p-6">
                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ann-title" className="text-xs font-bold uppercase tracking-wider text-slate-400">Judul Pengumuman</Label>
                    <Input
                      id="ann-title"
                      placeholder="Mulai Pendaftaran Semester Baru..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ann-content" className="text-xs font-bold uppercase tracking-wider text-slate-400">Isi Pengumuman</Label>
                    <textarea
                      id="ann-content"
                      placeholder="Tuliskan detail informasi di sini..."
                      rows={5}
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="flex min-h-[120px] w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    ></textarea>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
                    disabled={annLoading}
                  >
                    {annLoading ? 'Mengirim...' : 'Siarkan Pengumuman'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Announcements List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Daftar Pengumuman</h2>
            <Card className="border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                    Belum ada pengumuman aktif.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {announcements.map((ann) => (
                      <div key={ann.id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{ann.title}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ann.is_active 
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                            }`}>
                              {ann.is_active ? 'Aktif' : 'Non-aktif'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-wrap">{ann.content}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                            <span>Dibuat: {new Date(ann.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                            {ann.users?.full_name && <span>• Pengirim: {ann.users.full_name}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAnnouncement(ann.id, ann.is_active, ann.title)}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg"
                            title={ann.is_active ? "Sembunyikan" : "Tampilkan"}
                          >
                            {ann.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Log Audit Keamanan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Catatan aktivitas penting dalam sistem untuk transparansi data.</p>
            </div>
            
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cari email, aksi, detail..."
                value={searchLogQuery}
                onChange={(e) => setSearchLogQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <Card className="border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Waktu</th>
                    <th className="p-4">Pengguna</th>
                    <th className="p-4">Aksi</th>
                    <th className="p-4">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                        Tidak ada log aktivitas yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                          {log.user_email}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase ${
                            log.action.includes('DELETE')
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                              : log.action.includes('CREATE')
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-400 max-w-[300px] truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
