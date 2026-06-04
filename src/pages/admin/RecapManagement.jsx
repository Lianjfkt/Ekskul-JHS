import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ClipboardCheck, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Loader2, 
  TrendingUp, 
  Activity, 
  GraduationCap, 
  Users, 
  Download,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend
} from 'recharts'

export default function RecapManagement() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [errorMsg, setErrorMsg] = useState('')

  // Raw data from DB
  const [extracurriculars, setExtracurriculars] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [grades, setGrades] = useState([])
  const [sessions, setSessions] = useState([])
  const [attendances, setAttendances] = useState([])

  // Filters state
  const [selectedEkskul, setSelectedEkskul] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      // Fetch all tables concurrently to construct real-time reports
      const [
        { data: ekskulData, error: eErr },
        { data: enrollmentsData, error: enErr },
        { data: gradesData, error: gErr },
        { data: sessionsData, error: sErr },
        { data: attendancesData, error: aErr }
      ] = await Promise.all([
        supabase.from('extracurriculars').select('*, coach:coach_id (id, full_name, email)').order('name', { ascending: true }),
        supabase.from('enrollments').select('*, student:student_id (id, nis, full_name, class)').eq('status', 'active'),
        supabase.from('grades').select('*, student:student_id (id, nis, full_name, class), extracurricular:extracurricular_id (id, name)'),
        supabase.from('sessions').select('*, extracurricular:extracurricular_id (id, name)').order('session_date', { ascending: false }),
        supabase.from('attendances').select('*, student:student_id (id, nis, full_name, class)')
      ])

      if (eErr) throw eErr
      if (enErr) throw enErr
      if (gErr) throw gErr
      if (sErr) throw sErr
      if (aErr) throw aErr

      setExtracurriculars(ekskulData || [])
      setEnrollments(enrollmentsData || [])
      setGrades(gradesData || [])
      setSessions(sessionsData || [])
      setAttendances(attendancesData || [])
    } catch (err) {
      console.error('Error fetching recap data:', err.message)
      setErrorMsg('Gagal memuat data laporan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper to extract unique academic years & semesters for filter
  const academicYears = useMemo(() => {
    const years = new Set([
      ...enrollments.map(e => e.academic_year),
      ...grades.map(g => g.academic_year)
    ])
    return Array.from(years).filter(Boolean).sort()
  }, [enrollments, grades])

  const semesters = useMemo(() => {
    const sem = new Set([
      ...enrollments.map(e => e.semester),
      ...grades.map(g => g.semester)
    ])
    return Array.from(sem).filter(Boolean).sort()
  }, [enrollments, grades])

  // --- CORE COMPUTED METRICS ---
  const computedStats = useMemo(() => {
    // 1. Total Enrolled
    const totalEnrolled = enrollments.length

    // 2. Average Grade Overall
    let totalGradeScore = 0
    let gradeCount = 0
    grades.forEach(g => {
      const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.knowledge_score || 0)) / 3)
      totalGradeScore += avg
      gradeCount++
    })
    const avgGrade = gradeCount > 0 ? Math.round(totalGradeScore / gradeCount) : 0

    // 3. Average Attendance Overall
    const totalAtts = attendances.length
    const presentAtts = attendances.filter(a => a.status === 'hadir').length
    const attendanceRate = totalAtts > 0 ? Math.round((presentAtts / totalAtts) * 100) : 0

    // 4. Extracurricular summaries
    const sessionMapByEkskul = {}
    sessions.forEach(s => {
      if (!sessionMapByEkskul[s.extracurricular_id]) {
        sessionMapByEkskul[s.extracurricular_id] = []
      }
      sessionMapByEkskul[s.extracurricular_id].push(s.id)
    })

    const attendanceStatsByEkskul = {}
    attendances.forEach(a => {
      // Find session to see extracurricular_id
      const session = sessions.find(s => s.id === a.session_id)
      if (session) {
        const eksId = session.extracurricular_id
        if (!attendanceStatsByEkskul[eksId]) {
          attendanceStatsByEkskul[eksId] = { total: 0, present: 0 }
        }
        attendanceStatsByEkskul[eksId].total++
        if (a.status === 'hadir') {
          attendanceStatsByEkskul[eksId].present++
        }
      }
    })

    const gradeStatsByEkskul = {}
    grades.forEach(g => {
      const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.knowledge_score || 0)) / 3)
      if (!gradeStatsByEkskul[g.extracurricular_id]) {
        gradeStatsByEkskul[g.extracurricular_id] = { totalScore: 0, count: 0 }
      }
      gradeStatsByEkskul[g.extracurricular_id].totalScore += avg
      gradeStatsByEkskul[g.extracurricular_id].count++
    })

    const ekskulSummaries = extracurriculars.map(e => {
      const activeSiswa = enrollments.filter(en => en.extracurricular_id === e.id).length
      const sessionsCount = sessions.filter(s => s.extracurricular_id === e.id).length
      
      const attInfo = attendanceStatsByEkskul[e.id]
      const attendanceRate = attInfo && attInfo.total > 0 ? Math.round((attInfo.present / attInfo.total) * 100) : 0

      const grInfo = gradeStatsByEkskul[e.id]
      const avgGr = grInfo && grInfo.count > 0 ? Math.round(grInfo.totalScore / grInfo.count) : 0

      return {
        id: e.id,
        name: e.name,
        coachName: e.coach?.full_name || 'Belum ditunjuk',
        schedule: e.schedule || '-',
        isActive: e.is_active,
        activeSiswa,
        sessionsCount,
        attendanceRate,
        avgGrade: avgGr
      }
    })

    return {
      totalEnrolled,
      avgGrade,
      attendanceRate,
      ekskulSummaries
    }
  }, [extracurriculars, enrollments, grades, sessions, attendances])

  // --- TAB 1: EKSKUL SUMMARY (FILTERED) ---
  const filteredEkskulSummaries = useMemo(() => {
    return computedStats.ekskulSummaries.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.coachName.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [computedStats.ekskulSummaries, searchQuery])

  // --- TAB 2: ATTENDANCE REPORT (FILTERED & AGGREGATED) ---
  const attendanceReportRows = useMemo(() => {
    // We want to calculate attendance metrics per student per extracurricular
    // Format: studentId + '_' + extracurricularId
    const keyMap = {}

    // First map all active enrollments to initiate rows
    enrollments.forEach(en => {
      const student = en.student
      const ekskul = extracurriculars.find(e => e.id === en.extracurricular_id)
      if (student && ekskul) {
        const key = `${student.id}_${ekskul.id}`
        keyMap[key] = {
          studentId: student.id,
          nis: student.nis,
          studentName: student.full_name,
          class: student.class,
          ekskulId: ekskul.id,
          ekskulName: ekskul.name,
          semester: en.semester,
          academicYear: en.academic_year,
          hadir: 0,
          izin: 0,
          alpha: 0,
          total: 0
        }
      }
    })

    // Loop through attendances to sum status
    attendances.forEach(a => {
      const student = a.student
      const session = sessions.find(s => s.id === a.session_id)
      if (student && session) {
        const key = `${student.id}_${session.extracurricular_id}`
        // If row doesn't exist, create it dynamically (e.g. historical data)
        if (!keyMap[key]) {
          const studentInfo = student
          const ekskul = extracurriculars.find(e => e.id === session.extracurricular_id)
          keyMap[key] = {
            studentId: studentInfo.id,
            nis: studentInfo.nis,
            studentName: studentInfo.full_name,
            class: studentInfo.class,
            ekskulId: session.extracurricular_id,
            ekskulName: ekskul?.name || 'Ekskul Lama',
            semester: '-',
            academicYear: '-',
            hadir: 0,
            izin: 0,
            alpha: 0,
            total: 0
          }
        }

        const row = keyMap[key]
        row.total++
        if (a.status === 'hadir') row.hadir++
        else if (a.status === 'izin') row.izin++
        else if (a.status === 'alpha') row.alpha++
      }
    })

    // Compute percentages & return list
    return Object.values(keyMap).map(row => {
      const percentage = row.total > 0 ? Math.round((row.hadir / row.total) * 100) : 0
      return { ...row, percentage }
    }).filter(row => {
      // Apply filters
      const matchEkskul = selectedEkskul ? row.ekskulId === selectedEkskul : true
      const matchSemester = selectedSemester ? row.semester === selectedSemester : true
      const matchYear = selectedAcademicYear ? row.academicYear === selectedAcademicYear : true
      const matchSearch = searchQuery 
        ? row.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || row.nis.includes(searchQuery)
        : true

      return matchEkskul && matchSemester && matchYear && matchSearch
    })
  }, [enrollments, extracurriculars, attendances, sessions, selectedEkskul, selectedSemester, selectedAcademicYear, searchQuery])

  // --- TAB 3: GRADE REPORT (FILTERED) ---
  const gradeReportRows = useMemo(() => {
    return grades.map(g => {
      const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.knowledge_score || 0)) / 3)
      let predikat = 'D'
      if (avg >= 90) predikat = 'A'
      else if (avg >= 75) predikat = 'B'
      else if (avg >= 60) predikat = 'C'

      return {
        id: g.id,
        nis: g.student?.nis || '-',
        studentName: g.student?.full_name || 'Unknown student',
        class: g.student?.class || '-',
        ekskulId: g.extracurricular_id,
        ekskulName: g.extracurricular?.name || 'Deleted Ekskul',
        semester: g.semester,
        academicYear: g.academic_year,
        attitude: g.attitude_score || 0,
        skill: g.skill_score || 0,
        activity: g.knowledge_score || 0,
        avg,
        predikat,
        notes: g.notes || '-'
      }
    }).filter(row => {
      const matchEkskul = selectedEkskul ? row.ekskulId === selectedEkskul : true
      const matchSemester = selectedSemester ? row.semester === selectedSemester : true
      const matchYear = selectedAcademicYear ? row.academicYear === selectedAcademicYear : true
      const matchSearch = searchQuery 
        ? row.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || row.nis.includes(searchQuery)
        : true

      return matchEkskul && matchSemester && matchYear && matchSearch
    })
  }, [grades, selectedEkskul, selectedSemester, selectedAcademicYear, searchQuery])

  // --- EXPORTS TO EXCEL ---
  const exportEkskulToExcel = () => {
    const rows = filteredEkskulSummaries.map(e => [
      e.name,
      e.coachName,
      e.schedule,
      e.activeSiswa,
      e.sessionsCount,
      `${e.attendanceRate}%`,
      e.avgGrade
    ])
    const headers = ['Nama Ekstrakurikuler', 'Nama Pelatih', 'Jadwal', 'Siswa Aktif', 'Sesi Terlaksana', 'Persentase Absensi', 'Rata-rata Nilai']
    exportToExcel(rows, headers, 'Ringkasan Ekskul', 'rekap_ekstrakurikuler.xlsx')
  }

  const exportAttendanceToExcel = () => {
    const rows = attendanceReportRows.map(r => [
      r.nis,
      r.studentName,
      r.class,
      r.ekskulName,
      r.semester,
      r.academicYear,
      r.hadir,
      r.izin,
      r.alpha,
      r.total,
      `${r.percentage}%`
    ])
    const headers = ['NIS', 'Nama Siswa', 'Kelas', 'Ekstrakurikuler', 'Semester', 'Tahun Ajaran', 'Hadir', 'Izin', 'Alpha', 'Total Sesi', 'Persentase Kehadiran']
    exportToExcel(rows, headers, 'Laporan Kehadiran', 'rekap_kehadiran_siswa.xlsx')
  }

  const exportGradesToExcel = () => {
    const rows = gradeReportRows.map(r => [
      r.nis,
      r.studentName,
      r.class,
      r.ekskulName,
      r.semester,
      r.academicYear,
      r.attitude,
      r.skill,
      r.activity,
      r.avg,
      r.predikat,
      r.notes
    ])
    const headers = ['NIS', 'Nama Siswa', 'Kelas', 'Ekstrakurikuler', 'Semester', 'Tahun Ajaran', 'Nilai Sikap', 'Nilai Keterampilan', 'Nilai Pengetahuan', 'Rata-rata', 'Predikat', 'Catatan/Keterangan']
    exportToExcel(rows, headers, 'Laporan Nilai', 'rekap_nilai_siswa.xlsx')
  }

  const exportToExcel = (rows, headers, sheetName, filename) => {
    const wb = XLSX.utils.book_new()
    const data = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(data)
    
    // Auto column widths
    const maxCols = headers.length
    ws['!cols'] = Array(maxCols).fill({ wch: 18 })
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename)
  }

  // Data for visual bar chart (Top 5 Ekskul based on Average Grade & Attendance)
  const chartData = useMemo(() => {
    return computedStats.ekskulSummaries
      .slice(0, 8)
      .map(e => ({
        name: e.name,
        'Rata-rata Nilai': e.avgGrade,
        'Persentase Absensi': e.attendanceRate
      }))
  }, [computedStats.ekskulSummaries])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-sm font-medium">Memuat formulir rekap & laporan...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-2xl text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12 scale-150">
          <FileSpreadsheet className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-indigo-400" />
            Rekapitulasi & Laporan Sekolah
          </h1>
          <p className="text-slate-300 max-w-2xl text-sm md:text-base">
            Unduh laporan rekapitulasi nilai, absensi, dan partisipasi siswa di setiap ekstrakurikuler dalam format spreadsheet Excel secara langsung.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-sm font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-500">Total Keikutsertaan Siswa</p>
              <h3 className="text-3xl font-extrabold text-slate-900">{computedStats.totalEnrolled}</h3>
              <p className="text-xs text-slate-400">Total siswa terdaftar secara aktif</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-500">Rata-rata Nilai Sekolah</p>
              <h3 className="text-3xl font-extrabold text-emerald-600">{computedStats.avgGrade} <span className="text-sm text-slate-400">/ 100</span></h3>
              <p className="text-xs text-slate-400">Dari seluruh nilai ekskul siswa</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
              <GraduationCap className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-500">Rata-rata Kehadiran</p>
              <h3 className="text-3xl font-extrabold text-cyan-600">{computedStats.attendanceRate}%</h3>
              <p className="text-xs text-slate-400">Tingkat kehadiran di seluruh sesi</p>
            </div>
            <div className="p-4 rounded-xl bg-cyan-50 text-cyan-600">
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Recap Visual Chart */}
      <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-6 pb-0">
          <CardTitle className="text-lg font-bold text-slate-800">Perbandingan Nilai & Absensi Antar Ekskul</CardTitle>
          <CardDescription>Grafik perbandingan rata-rata nilai akademik dan persentase kehadiran siswa per cabang ekskul</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="w-full h-[320px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data visualisasi yang cukup.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Rata-rata Nilai" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Persentase Absensi" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <div className="space-y-6">
        <div className="flex border-b border-slate-200 gap-6 overflow-x-auto pb-px scrollbar-none">
          <button 
            onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ringkasan Ekskul
          </button>
          <button 
            onClick={() => { setActiveTab('attendance'); setSearchQuery(''); }}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'attendance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Laporan Absensi Siswa
          </button>
          <button 
            onClick={() => { setActiveTab('grades'); setSearchQuery(''); }}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'grades' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Laporan Nilai Siswa
          </button>
        </div>

        {/* Global & Specific Filters */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Filter */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={activeTab === 'overview' ? "Cari ekskul atau pelatih..." : "Cari nama siswa atau NIS..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-sm pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Attendance & Grades Specific Filters */}
            {activeTab !== 'overview' && (
              <>
                <select
                  value={selectedEkskul}
                  onChange={e => setSelectedEkskul(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Semua Ekskul</option>
                  {extracurriculars.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>

                <select
                  value={selectedSemester}
                  onChange={e => setSelectedSemester(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Semua Semester</option>
                  {semesters.map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>

                <select
                  value={selectedAcademicYear}
                  onChange={e => setSelectedAcademicYear(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Semua Tahun Ajaran</option>
                  {academicYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Export Action Button */}
          <div>
            <Button
              onClick={
                activeTab === 'overview' ? exportEkskulToExcel :
                activeTab === 'attendance' ? exportAttendanceToExcel : exportGradesToExcel
              }
              disabled={
                (activeTab === 'overview' && filteredEkskulSummaries.length === 0) ||
                (activeTab === 'attendance' && attendanceReportRows.length === 0) ||
                (activeTab === 'grades' && gradeReportRows.length === 0)
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 w-full md:w-auto"
            >
              <Download className="w-4 h-4" />
              Ekspor ke Excel
            </Button>
          </div>
        </div>

        {/* Tab 1 Content: Overview */}
        {activeTab === 'overview' && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="p-4 pl-6">Ekstrakurikuler</th>
                    <th className="p-4">Pelatih Utama</th>
                    <th className="p-4">Jadwal Latihan</th>
                    <th className="p-4 text-center">Siswa Aktif</th>
                    <th className="p-4 text-center">Sesi Terlaksana</th>
                    <th className="p-4 text-center">Absensi Rata-rata</th>
                    <th className="p-4 text-center">Rata-rata Nilai</th>
                    <th className="p-4 text-center pr-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEkskulSummaries.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">Tidak ada ekskul yang cocok dengan pencarian.</td>
                    </tr>
                  ) : (
                    filteredEkskulSummaries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 pl-6 font-semibold text-slate-800">{e.name}</td>
                        <td className="p-4 text-slate-600">{e.coachName}</td>
                        <td className="p-4 text-slate-500">{e.schedule}</td>
                        <td className="p-4 text-center font-semibold text-slate-700">{e.activeSiswa}</td>
                        <td className="p-4 text-center text-slate-500">{e.sessionsCount}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            e.attendanceRate >= 80 ? 'bg-emerald-50 text-emerald-600' :
                            e.attendanceRate >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {e.attendanceRate}%
                          </span>
                        </td>
                        <td className="p-4 text-center font-bold text-indigo-600">{e.avgGrade || '-'}</td>
                        <td className="p-4 text-center pr-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase ${
                            e.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {e.isActive ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2 Content: Attendance Report */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="p-4 pl-6">NIS</th>
                    <th className="p-4">Nama Siswa</th>
                    <th className="p-4 text-center">Kelas</th>
                    <th className="p-4">Ekstrakurikuler</th>
                    <th className="p-4 text-center">Hadir</th>
                    <th className="p-4 text-center">Izin</th>
                    <th className="p-4 text-center">Alpha</th>
                    <th className="p-4 text-center">Total</th>
                    <th className="p-4 pr-6 min-w-[140px]">Rasio Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceReportRows.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-slate-400">Tidak ada laporan kehadiran yang cocok dengan kriteria filter.</td>
                    </tr>
                  ) : (
                    attendanceReportRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 pl-6 font-mono text-slate-500">{r.nis}</td>
                        <td className="p-4 font-semibold text-slate-800">{r.studentName}</td>
                        <td className="p-4 text-center text-slate-600">{r.class}</td>
                        <td className="p-4 font-medium text-slate-700">{r.ekskulName}</td>
                        <td className="p-4 text-center font-bold text-emerald-600">{r.hadir}</td>
                        <td className="p-4 text-center text-amber-600">{r.izin}</td>
                        <td className="p-4 text-center text-rose-500">{r.alpha}</td>
                        <td className="p-4 text-center text-slate-500">{r.total}</td>
                        <td className="p-4 pr-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[50px]">
                              <div 
                                className={`h-full rounded-full ${
                                  r.percentage >= 80 ? 'bg-emerald-500' :
                                  r.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`} 
                                style={{ width: `${r.percentage}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-slate-700 shrink-0 text-xs">{r.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3 Content: Grade Report */}
        {activeTab === 'grades' && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="p-4 pl-6">NIS</th>
                    <th className="p-4">Nama Siswa</th>
                    <th className="p-4 text-center">Kelas</th>
                    <th className="p-4">Ekstrakurikuler</th>
                    <th className="p-4 text-center">Sikap</th>
                    <th className="p-4 text-center">Keterampilan</th>
                    <th className="p-4 text-center">Pengetahuan</th>
                    <th className="p-4 text-center">Rata-rata</th>
                    <th className="p-4 text-center">Predikat</th>
                    <th className="p-4 pr-6 max-w-[200px]">Catatan / Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradeReportRows.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400">Tidak ada laporan nilai yang cocok dengan kriteria filter.</td>
                    </tr>
                  ) : (
                    gradeReportRows.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 pl-6 font-mono text-slate-500">{r.nis}</td>
                        <td className="p-4 font-semibold text-slate-800">{r.studentName}</td>
                        <td className="p-4 text-center text-slate-600">{r.class}</td>
                        <td className="p-4 font-medium text-slate-700">{r.ekskulName}</td>
                        <td className="p-4 text-center text-slate-600 font-semibold">{r.attitude}</td>
                        <td className="p-4 text-center text-slate-600 font-semibold">{r.skill}</td>
                        <td className="p-4 text-center text-slate-600 font-semibold">{r.activity}</td>
                        <td className="p-4 text-center font-extrabold text-slate-800">{r.avg}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block w-7 h-7 rounded-full leading-7 text-center font-black text-xs ${
                            r.predikat === 'A' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                            r.predikat === 'B' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                            r.predikat === 'C' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 
                            'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}>
                            {r.predikat}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 italic text-xs pr-6 truncate max-w-[200px]" title={r.notes}>
                          {r.notes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
