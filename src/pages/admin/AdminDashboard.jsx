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
  Megaphone, ShieldAlert, Trash2, Eye, EyeOff, Search,
  AlertCircle, CheckCircle2, XCircle, RefreshCw, UserX, BarChart as BarChartIcon
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

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

  // Student Tracking state
  const [trackingStudents, setTrackingStudents] = useState([])
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingFilter, setTrackingFilter] = useState('all') // 'all', 'no_account', 'no_ekskul', 'both_missing'
  const [searchTrackingQuery, setSearchTrackingQuery] = useState('')
  const [trackingError, setTrackingError] = useState('')

  // Laporan & Statistik State
  const [extracurricularStats, setExtracurricularStats] = useState([])
  const [mandatoryViolations, setMandatoryViolations] = useState([])

  useEffect(() => {
    fetchStats()
    loadAnnouncements()
    loadAuditLogs()
    fetchTrackingData()
  }, [])

  const fetchTrackingData = async () => {
    setTrackingLoading(true)
    setTrackingError('')
    try {
      // 1. Fetch student_master (Data acuan resmi sekolah)
      const { data: masterData, error: mErr } = await supabase
        .from('student_master')
        .select('nis, full_name, class, gender, phone')
      if (mErr) throw mErr

      // 2. Fetch students (Data profil pendaftaran - TANPA relasi)
      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('id, nis, full_name, class, gender, phone')
      if (sErr) throw sErr

      // 3. Fetch users (Data akun login - TERPISAH)
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select('id, email, student_id, role')
        .eq('role', 'student')
      if (uErr) throw uErr

      // 4. Fetch enrollments (Data pendaftaran ekskul)
      const { data: enrollmentsData, error: enErr } = await supabase
        .from('enrollments')
        .select(`
          id, 
          student_id, 
          status,
          extracurricular:extracurricular_id (name)
        `)
      if (enErr) throw enErr

      // 5. Fetch all extracurriculars for complete stats (even if 0 enrollments)
      const { data: allEkskulData, error: allEksErr } = await supabase
        .from('extracurriculars')
        .select('id, name')
      if (allEksErr) throw allEksErr

      // Buat lookup maps untuk performa
      const usersByStudentId = {}
      for (const u of (usersData || [])) {
        if (u.student_id) {
          if (!usersByStudentId[u.student_id]) usersByStudentId[u.student_id] = []
          usersByStudentId[u.student_id].push(u)
        }
      }

      const enrollmentsByStudentId = {}
      for (const e of (enrollmentsData || [])) {
        if (e.student_id) {
          if (!enrollmentsByStudentId[e.student_id]) enrollmentsByStudentId[e.student_id] = []
          enrollmentsByStudentId[e.student_id].push(e)
        }
      }

      const merged = []

      }

      // Gabungkan data dari masterData (Hanya memproses total siswa yang ada di master siswa)
      const violations = []

      for (const m of (masterData || [])) {
        const s = (studentsData || []).find(x => x.nis === m.nis)
        
        const studentUsers = s ? (usersByStudentId[s.id] || []) : []
        const hasAccount = studentUsers.length > 0
        const studentEnrollments = s ? (enrollmentsByStudentId[s.id] || []) : []
        const activeEnrollments = studentEnrollments.filter(e => e.status === 'active')
        const activeEnrollmentsCount = activeEnrollments.length
        const hasEkskul = activeEnrollmentsCount > 0

        const enrolledNames = activeEnrollments.map(e => e.extracurricular?.name?.toLowerCase())

        // Cek pelanggaran ekskul wajib
        let violationType = null
        if (m.class === '7') {
          if (!enrolledNames.some(name => name?.includes('pramuka'))) {
            violationType = 'Wajib Pramuka'
          }
        } else if (m.class === '8') {
          if (!enrolledNames.some(name => name?.includes('karate') || name?.includes('taekwondo'))) {
            violationType = 'Wajib Karate / Taekwondo'
          }
        }

        if (violationType) {
          violations.push({
            nis: m.nis,
            full_name: m.full_name,
            class: m.class,
            violationType,
            enrolled: activeEnrollments.map(e => e.extracurricular?.name).join(', ') || '-'
          })
        }

        merged.push({
          id: s?.id || null,
          nis: m.nis,
          full_name: m.full_name,
          class: m.class,
          gender: m.gender,
          phone: m.phone,
          hasAccount,
          hasEkskul,
          activeEnrollmentsCount,
          users: studentUsers,
          enrollments: studentEnrollments
        })
      }

      // Hitung statistik ekskul
      const statsMap = {}
      allEkskulData?.forEach(ekskul => {
        statsMap[ekskul.name] = 0
      })
      
      enrollmentsData?.forEach(e => {
        if (e.status === 'active' && e.extracurricular?.name) {
          const name = e.extracurricular.name
          if (statsMap[name] !== undefined) {
            statsMap[name] += 1
          } else {
            statsMap[name] = 1
          }
        }
      })

      const statsArray = Object.keys(statsMap).map(name => ({
        name,
        jumlahSiswa: statsMap[name]
      })).sort((a, b) => b.jumlahSiswa - a.jumlahSiswa)

      setExtracurricularStats(statsArray)

      // Urutkan violations berdasarkan kelas lalu nama
      violations.sort((a, b) => {
        if (a.class === b.class) return a.full_name.localeCompare(b.full_name)
        return a.class.localeCompare(b.class)
      })
      setMandatoryViolations(violations)

      // Urutkan berdasarkan nama
      merged.sort((a, b) => a.full_name.localeCompare(b.full_name))
      setTrackingStudents(merged)
    } catch (err) {
      console.error('Error fetching tracking data:', err.message)
      setTrackingError(err.message)
    } finally {
      setTrackingLoading(false)
    }
  }

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

  // Filter tracking students based on search query and status filter
  const filteredTrackingStudents = trackingStudents.filter(st => {
    const query = searchTrackingQuery.toLowerCase().trim()
    const matchesSearch = !query || 
      st.full_name?.toLowerCase().includes(query) ||
      st.nis?.includes(query) ||
      st.class?.toLowerCase().includes(query)

    if (!matchesSearch) return false

    const hasAccount = st.hasAccount
    const hasEkskul = st.hasEkskul

    if (trackingFilter === 'no_account') {
      return !hasAccount
    }
    if (trackingFilter === 'no_ekskul') {
      return hasAccount && !hasEkskul
    }
    return true
  })

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
      <div className="flex border-b-4 border-pixel-gray gap-1 flex-wrap sm:flex-nowrap">
        {[
          { key: 'dashboard', label: 'DASHBOARD' },
          { key: 'tracking', label: 'TRACKING SISWA' },
          { key: 'laporan', label: 'LAPORAN & STATISTIK' },
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

      {/* Tab: Tracking Siswa */}
      {activeTab === 'tracking' && (
        <div className="space-y-6">
          {/* Header & Refresh */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Tracking Siswa</h2>
              <p className="font-retro text-lg text-pixel-lavender mt-1">Pantau siswa yang belum punya akun login atau belum daftar ekskul.</p>
            </div>
            <Button variant="outline" onClick={fetchTrackingData} className="gap-2" disabled={trackingLoading}>
              <RefreshCw className={`w-4 h-4 ${trackingLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {trackingError && (
            <div className="p-4 border-2 border-pixel-red bg-pixel-red/10 text-pixel-red font-retro text-lg">
              Gagal memuat data tracking: {trackingError}
            </div>
          )}
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Total Siswa (Master)',
                value: trackingStudents.length,
                icon: UsersIcon,
                color: 'text-pixel-blue',
                bg: 'bg-pixel-blue/15',
                border: 'border-pixel-blue',
                filter: 'all'
              },
              {
                label: 'Belum Punya Akun',
                value: trackingStudents.filter(s => !s.hasAccount).length,
                icon: UserX,
                color: 'text-pixel-red',
                bg: 'bg-pixel-red/15',
                border: 'border-pixel-red',
                filter: 'no_account'
              },
              {
                label: 'Belum Daftar Ekskul',
                value: trackingStudents.filter(s => s.hasAccount && !s.hasEkskul).length,
                icon: AlertCircle,
                color: 'text-pixel-orange',
                bg: 'bg-pixel-orange/15',
                border: 'border-pixel-orange',
                filter: 'no_ekskul'
              }
            ].map((card) => {
              const Icon = card.icon
              const isActive = trackingFilter === card.filter
              return (
                <button
                  key={card.filter}
                  onClick={() => setTrackingFilter(card.filter)}
                  className={`p-4 border-3 text-left transition-all ${
                    isActive
                      ? `${card.bg} ${card.border} ${card.color}`
                      : 'border-pixel-gray bg-pixel-panel text-pixel-lavender hover:border-pixel-gray/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 ${isActive ? card.color : 'text-pixel-lavender'}`} />
                    {isActive && <span className="font-pixel text-[7px]">AKTIF</span>}
                  </div>
                  <div className={`font-pixel text-xl pixel-text-shadow ${isActive ? card.color : 'text-pixel-white'}`}>
                    {trackingLoading ? '...' : card.value}
                  </div>
                  <div className="font-retro text-base mt-1">{card.label}</div>
                </button>
              )
            })}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pixel-lavender" />
            <Input
              placeholder="Cari nama, NIS, atau kelas..."
              value={searchTrackingQuery}
              onChange={(e) => setSearchTrackingQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              {trackingLoading ? (
                <div className="p-8 text-center font-retro text-lg text-pixel-lavender">
                  <span className="pixel-blink">MEMUAT DATA SISWA...</span>
                </div>
              ) : filteredTrackingStudents.length === 0 ? (
                <div className="p-8 text-center font-retro text-lg text-pixel-lavender">
                  <CheckCircle2 className="w-10 h-10 text-pixel-green mx-auto mb-2" />
                  Tidak ada siswa yang sesuai kriteria filter ini. Semua siswa sudah memiliki akun dan ekskul!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-retro text-lg">
                    <thead>
                      <tr className="border-b-3 border-pixel-gray bg-pixel-navy font-pixel text-[7px] text-pixel-lavender uppercase tracking-wider">
                        <th className="p-4">NIS</th>
                        <th className="p-4">Nama Lengkap</th>
                        <th className="p-4">Kelas</th>
                        <th className="p-4">Status Akun Login</th>
                        <th className="p-4">Status Ekskul</th>
                        <th className="p-4">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-pixel-gray/20">
                      {filteredTrackingStudents.map((student) => {
                        const hasAccount = student.hasAccount
                        const hasEkskul = student.hasEkskul
                        const activeEnrollmentsCount = student.activeEnrollmentsCount

                        return (
                          <tr key={student.nis} className="hover:bg-pixel-panel-light">
                            <td className="p-4 font-mono text-pixel-lavender text-base">{student.nis}</td>
                            <td className="p-4 text-pixel-white font-semibold">{student.full_name}</td>
                            <td className="p-4 text-pixel-peach">{student.class}</td>
                            <td className="p-4">
                              {hasAccount ? (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-pixel-green" />
                                  <span className="font-retro text-base text-pixel-green">Sudah</span>
                                  <span className="font-retro text-sm text-pixel-lavender/60 truncate max-w-[120px]" title={student.users[0]?.email}>
                                    ({student.users[0]?.email})
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <XCircle className="w-4 h-4 text-pixel-red" />
                                  <span className="font-retro text-base text-pixel-red">Belum Punya Akun</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {hasEkskul ? (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-pixel-green" />
                                  <span className="font-retro text-base text-pixel-green">{activeEnrollmentsCount} Ekskul</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <AlertCircle className="w-4 h-4 text-pixel-orange" />
                                  <span className="font-retro text-base text-pixel-orange">Belum Daftar</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2 flex-wrap">
                                {!hasAccount && (
                                  <Link
                                    to="/admin/users"
                                    className="font-pixel text-[7px] px-2 py-1 border-2 border-pixel-blue text-pixel-blue hover:bg-pixel-blue/10 whitespace-nowrap"
                                  >
                                    + Buat Akun
                                  </Link>
                                )}
                                {!hasEkskul && (
                                  <Link
                                    to="/admin/enrollments"
                                    className="font-pixel text-[7px] px-2 py-1 border-2 border-pixel-orange text-pixel-orange hover:bg-pixel-orange/10 whitespace-nowrap"
                                  >
                                    + Daftarkan Ekskul
                                  </Link>
                                )}
                                {hasAccount && hasEkskul && (
                                  <span className="font-pixel text-[7px] text-pixel-green">✓ Lengkap</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t-2 border-pixel-gray/30 bg-pixel-navy/30 text-right font-retro text-base text-pixel-lavender">
                    Menampilkan {filteredTrackingStudents.length} dari {trackingStudents.length} siswa
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Laporan & Statistik */}
      {activeTab === 'laporan' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-pixel text-[10px] text-pixel-yellow pixel-text-shadow uppercase">Laporan & Statistik</h2>
              <p className="font-retro text-lg text-pixel-lavender mt-1">Statistik pendaftaran dan pelanggaran ekskul wajib.</p>
            </div>
            <Button variant="outline" onClick={fetchTrackingData} className="gap-2" disabled={trackingLoading}>
              <RefreshCw className={`w-4 h-4 ${trackingLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Column */}
            <Card className="flex flex-col">
              <CardHeader className="border-b-2 border-pixel-gray/30 bg-pixel-navy/20 pb-4">
                <CardTitle className="font-pixel text-[10px] text-pixel-peach uppercase flex items-center gap-2">
                  <BarChartIcon className="w-5 h-5 text-pixel-blue" />
                  Statistik Pendaftaran Ekskul
                </CardTitle>
                <CardDescription className="font-retro text-base text-pixel-lavender">
                  Jumlah siswa aktif per ekstrakurikuler
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-1 min-h-[400px]">
                {trackingLoading ? (
                  <div className="h-full flex items-center justify-center font-retro text-lg text-pixel-lavender">
                    <span className="pixel-blink">MEMUAT GRAFIK...</span>
                  </div>
                ) : extracurricularStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center font-retro text-lg text-pixel-lavender">
                    Belum ada data pendaftaran ekskul.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={extracurricularStats}
                      margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#4f5b72" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#b8c0e0" 
                        tick={{ fontFamily: "'VT323', monospace", fontSize: 16 }}
                        angle={-45}
                        textAnchor="end"
                      />
                      <YAxis 
                        stroke="#b8c0e0" 
                        tick={{ fontFamily: "'VT323', monospace", fontSize: 16 }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1b233a', 
                          border: '2px solid #4f5b72',
                          fontFamily: "'VT323', monospace",
                          fontSize: '18px'
                        }}
                        itemStyle={{ color: '#ffb3a7' }}
                      />
                      <Bar 
                        dataKey="jumlahSiswa" 
                        name="Jumlah Siswa" 
                        fill="#6488ea" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Mandatory Violations Column */}
            <Card className="flex flex-col">
              <CardHeader className="border-b-2 border-pixel-gray/30 bg-pixel-navy/20 pb-4">
                <CardTitle className="font-pixel text-[10px] text-pixel-peach uppercase flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-pixel-red" />
                  Siswa Belum Mengambil Ekskul Wajib
                </CardTitle>
                <CardDescription className="font-retro text-base text-pixel-lavender">
                  Kelas 7 wajib Pramuka. Kelas 8 wajib Karate/Taekwondo.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                {trackingLoading ? (
                  <div className="p-8 text-center font-retro text-lg text-pixel-lavender">
                    <span className="pixel-blink">MEMERIKSA KEPATUHAN...</span>
                  </div>
                ) : mandatoryViolations.length === 0 ? (
                  <div className="p-8 text-center font-retro text-lg text-pixel-lavender">
                    <CheckCircle2 className="w-12 h-12 text-pixel-green mx-auto mb-3" />
                    Bagus! Semua siswa kelas 7 & 8 telah mendaftar ekskul wajib mereka.
                  </div>
                ) : (
                  <div className="overflow-x-auto h-[400px] overflow-y-auto pixel-scroll">
                    <table className="w-full text-left border-collapse font-retro text-lg relative">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b-3 border-pixel-gray bg-pixel-navy font-pixel text-[7px] text-pixel-lavender uppercase tracking-wider">
                          <th className="p-4">Siswa</th>
                          <th className="p-4">Pelanggaran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-pixel-gray/20">
                        {mandatoryViolations.map((v, i) => (
                          <tr key={v.nis || i} className="hover:bg-pixel-panel-light">
                            <td className="p-4">
                              <p className="font-semibold text-pixel-white">{v.full_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-base text-pixel-lavender">{v.nis}</span>
                                <span className="text-pixel-peach text-sm px-1.5 py-0.5 border border-pixel-peach bg-pixel-peach/10">Kelas {v.class}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 font-retro text-base text-pixel-red border border-pixel-red bg-pixel-red/10 px-2 py-1 mb-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {v.violationType}
                              </span>
                              <p className="text-sm text-pixel-lavender/70">
                                Ekskul Saat Ini: {v.enrolled}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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
