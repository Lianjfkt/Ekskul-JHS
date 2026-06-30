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

  // Card items config — pixel colors
  const statCards = [
    {
      title: 'Total Siswa',
      value: stats.totalStudents,
      description: 'Siswa terdaftar di database',
      icon: GraduationCap,
      color: 'text-pixel-blue',
      bgColor: 'bg-pixel-blue/15'
    },
    {
      title: 'Total Ekskul',
      value: stats.totalEkskul,
      description: 'Ekstrakurikuler aktif & non-aktif',
      icon: Activity,
      color: 'text-pixel-green',
      bgColor: 'bg-pixel-green/15'
    },
    {
      title: 'Pelatih Aktif',
      value: stats.totalCoaches,
      description: 'Pengajar ekskul terdaftar',
      icon: UserCheck,
      color: 'text-pixel-yellow',
      bgColor: 'bg-pixel-yellow/15'
    },
    {
      title: 'Pendaftaran Aktif',
      value: stats.totalEnrollments,
      description: 'Siswa aktif mengikuti ekskul',
      icon: BookOpen,
      color: 'text-pixel-pink',
      bgColor: 'bg-pixel-pink/15'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header Banner — Pixel Style */}
      <div className="pixel-box bg-pixel-navy p-6 md:p-8 text-pixel-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12 scale-150">
          <Activity className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="font-pixel text-sm md:text-base text-pixel-blue pixel-text-shadow leading-loose">
            ADMIN PORTAL
          </h1>
          <p className="font-retro text-xl text-pixel-peach max-w-xl">
            Gunakan panel ini untuk mengelola siswa, pendidik/pelatih, ekstrakurikuler sekolah, dan laporan absensi.
          </p>
        </div>
      </div>

      {/* Pixel Tabs Selector */}
      <div className="flex border-b-4 border-pixel-gray gap-1">
        {[
          { key: 'dashboard', label: 'DASHBOARD' },
          { key: 'announcements', label: 'PENGUMUMAN' },
          { key: 'logs', label: 'AUDIT LOG' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-pixel text-[8px] uppercase tracking-wider border-3 border-b-0 ${
              activeTab === tab.key
                ? 'bg-pixel-panel text-pixel-blue border-pixel-gray -mb-[4px] pb-4'
                : 'bg-pixel-navy text-pixel-lavender border-transparent hover:text-pixel-peach'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, idx) => {
              const Icon = card.icon
              return (
                <Card key={idx} className="overflow-hidden">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-retro text-lg text-pixel-lavender">{card.title}</p>
                      <h3 className="font-pixel text-xl text-pixel-white pixel-text-shadow">
                        {loading ? <span className="pixel-blink">...</span> : card.value}
                      </h3>
                      <p className="font-retro text-base text-pixel-lavender/60">{card.description}</p>
                    </div>
                    <div className={`p-3 ${card.bgColor} ${card.color} border-2 border-current`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Aksi Cepat</h2>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <Link to="/admin/users" className="flex items-center justify-between p-3 border-2 border-pixel-gray hover:bg-pixel-panel-light hover:border-pixel-blue group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pixel-blue/15 text-pixel-blue border border-pixel-blue">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <span className="font-retro text-lg text-pixel-peach">Kelola & Import Siswa</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-pixel-lavender" />
                  </Link>

                  <Link to="/admin/extracurriculars" className="flex items-center justify-between p-3 border-2 border-pixel-gray hover:bg-pixel-panel-light hover:border-pixel-green group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pixel-green/15 text-pixel-green border border-pixel-green">
                        <Activity className="w-4 h-4" />
                      </div>
                      <span className="font-retro text-lg text-pixel-peach">Kelola Ekstrakurikuler</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-pixel-lavender" />
                  </Link>

                  <Link to="/admin/enrollments" className="flex items-center justify-between p-3 border-2 border-pixel-gray hover:bg-pixel-panel-light hover:border-pixel-pink group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pixel-pink/15 text-pixel-pink border border-pixel-pink">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-retro text-lg text-pixel-peach">Pendaftaran Ekskul Siswa</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-pixel-lavender" />
                  </Link>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Pendaftaran Terbaru</h2>
                <Link to="/admin/enrollments" className="font-pixel text-[7px] text-pixel-blue hover:text-pixel-yellow flex items-center gap-1 uppercase">
                  Lihat Semua <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-6 text-center font-retro text-lg text-pixel-lavender">
                      <span className="pixel-blink">MEMUAT DATA...</span>
                    </div>
                  ) : recentEnrollments.length === 0 ? (
                    <div className="p-6 text-center font-retro text-lg text-pixel-lavender">Belum ada aktivitas pendaftaran.</div>
                  ) : (
                    <div className="divide-y-2 divide-pixel-gray/30">
                      {recentEnrollments.map(rec => (
                        <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-pixel-panel-light">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-pixel-green/15 text-pixel-green border border-pixel-green mt-0.5">
                              <UsersIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-retro text-lg text-pixel-white">{rec.student?.full_name}</p>
                              <p className="font-retro text-base text-pixel-lavender mt-0.5">
                                Mendaftar ke <strong className="text-pixel-peach">{rec.extracurricular?.name}</strong> • Kelas {rec.student?.class}
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <span className={`pixel-badge ${
                              rec.status === 'active' ? 'border-pixel-green text-pixel-green bg-pixel-green/10' : 'border-pixel-gray text-pixel-lavender'
                            }`}>
                              {rec.status === 'active' ? 'AKTIF' : rec.status}
                            </span>
                            <p className="font-retro text-sm text-pixel-lavender/60 flex items-center justify-end gap-1">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Announcement Form */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Buat Pengumuman</h2>
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ann-title" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Judul</Label>
                    <Input
                      id="ann-title"
                      placeholder="Mulai Pendaftaran Semester Baru..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ann-content" className="font-pixel text-[8px] uppercase tracking-widest text-pixel-lavender">Isi</Label>
                    <textarea
                      id="ann-content"
                      placeholder="Tuliskan detail informasi di sini..."
                      rows={5}
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="pixel-input flex min-h-[120px] w-full rounded-none px-3 py-2 font-retro text-lg"
                    ></textarea>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={annLoading}
                  >
                    {annLoading ? <span className="pixel-blink">MENGIRIM...</span> : 'SIARKAN'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Announcements List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Daftar Pengumuman</h2>
            <Card>
              <CardContent className="p-0">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center font-retro text-lg text-pixel-lavender">
                    Belum ada pengumuman aktif.
                  </div>
                ) : (
                  <div className="divide-y-2 divide-pixel-gray/30">
                    {announcements.map((ann) => (
                      <div key={ann.id} className="p-5 flex items-start justify-between gap-4 hover:bg-pixel-panel-light">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-retro text-xl text-pixel-white truncate">{ann.title}</h4>
                            <span className={`pixel-badge ${
                              ann.is_active 
                                ? 'border-pixel-green text-pixel-green bg-pixel-green/10' 
                                : 'border-pixel-gray text-pixel-lavender'
                            }`}>
                              {ann.is_active ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <p className="font-retro text-lg text-pixel-lavender line-clamp-3 whitespace-pre-wrap">{ann.content}</p>
                          <div className="flex items-center gap-3 font-retro text-sm text-pixel-lavender/50 mt-2">
                            <span>Dibuat: {new Date(ann.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                            {ann.users?.full_name && <span>• Pengirim: {ann.users.full_name}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAnnouncement(ann.id, ann.is_active, ann.title)}
                            className="text-pixel-lavender hover:text-pixel-blue"
                            title={ann.is_active ? "Sembunyikan" : "Tampilkan"}
                          >
                            {ann.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                            className="text-pixel-red hover:text-pixel-red hover:bg-pixel-red/10"
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
              <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Log Audit</h2>
              <p className="font-retro text-lg text-pixel-lavender mt-1">Catatan aktivitas penting dalam sistem.</p>
            </div>
            
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pixel-lavender" />
              <Input
                placeholder="Cari email, aksi, detail..."
                value={searchLogQuery}
                onChange={(e) => setSearchLogQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-retro text-lg">
                <thead>
                  <tr className="border-b-3 border-pixel-gray bg-pixel-navy font-pixel text-[7px] text-pixel-lavender uppercase tracking-wider">
                    <th className="p-4">Waktu</th>
                    <th className="p-4">Pengguna</th>
                    <th className="p-4">Aksi</th>
                    <th className="p-4">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-pixel-gray/20 text-pixel-peach">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-pixel-lavender">
                        Tidak ada log aktivitas yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-pixel-panel-light">
                        <td className="p-4 whitespace-nowrap text-base text-pixel-lavender">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 text-pixel-white">
                          {log.user_email}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`pixel-badge ${
                            log.action.includes('DELETE')
                              ? 'border-pixel-red text-pixel-red bg-pixel-red/10'
                              : log.action.includes('CREATE')
                              ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                              : 'border-pixel-blue text-pixel-blue bg-pixel-blue/10'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-base text-pixel-lavender max-w-[300px] truncate" title={log.details}>
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
