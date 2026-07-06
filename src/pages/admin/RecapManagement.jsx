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
 AlertCircle,
 Calendar,
 X,
 BookOpen
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
 const [selectedSessionGroup, setSelectedSessionGroup] = useState(null)

 // Raw data from DB
 const [extracurriculars, setExtracurriculars] = useState([])
 const [enrollments, setEnrollments] = useState([])
 const [grades, setGrades] = useState([])
 const [sessions, setSessions] = useState([])
 const [attendances, setAttendances] = useState([])
 const [coaches, setCoaches] = useState([])

 // Filters state
 const [selectedEkskul, setSelectedEkskul] = useState('')
 const [selectedSemester, setSelectedSemester] = useState('')
 const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
 const [selectedCoach, setSelectedCoach] = useState('')
 const [selectedMonth, setSelectedMonth] = useState('')
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
 { data: attendancesData, error: aErr },
 { data: coachesData, error: cErr }
 ] = await Promise.all([
 supabase.from('extracurriculars').select('*, coach:coach_id (id, full_name, email)').order('name', { ascending: true }),
 supabase.from('enrollments').select('*, student:student_id (id, nis, full_name, class)').eq('status', 'active'),
 supabase.from('grades').select('*, student:student_id (id, nis, full_name, class), extracurricular:extracurricular_id (id, name)'),
 supabase.from('sessions').select('*, creator:created_by (id, full_name, email), extracurricular:extracurricular_id (id, name, coach:coach_id (id, full_name, email))').order('session_date', { ascending: false }),
 supabase.from('attendances').select('*, student:student_id (id, nis, full_name, class)'),
 supabase.from('users').select('id, full_name, email').eq('role', 'coach').order('full_name', { ascending: true })
 ])

 if (eErr) throw eErr
 if (enErr) throw enErr
 if (gErr) throw gErr
 if (sErr) throw sErr
 if (aErr) throw aErr
 if (cErr) throw cErr

 setExtracurriculars(ekskulData || [])
 setEnrollments(enrollmentsData || [])
 setGrades(gradesData || [])
 setSessions(sessionsData || [])
 setAttendances(attendancesData || [])
 setCoaches(coachesData || [])
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

 // Helpers & memoized hooks for Coach Sessions Recap
 const availableMonths = useMemo(() => {
 const months = new Set()
 sessions.forEach(s => {
 if (s.session_date) {
 const yyyymm = s.session_date.substring(0, 7)
 months.add(yyyymm)
 }
 })
 return Array.from(months).sort().reverse()
 }, [sessions])

 const formatMonthYearIndo = (yyyymm) => {
 if (!yyyymm || yyyymm === 'unknown') return 'Bulan Tidak Diketahui'
 const [year, month] = yyyymm.split('-')
 const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
 return `${monthsIndo[parseInt(month, 10) - 1]} ${year}`
 }

 const getSessionCoach = (session) => {
 if (session.creator) return session.creator
 if (session.extracurricular?.coach) return session.extracurricular.coach
 return { id: 'unknown', full_name: 'Tanpa Pelatih', email: '' }
 }

 const coachSessionReportRows = useMemo(() => {
 const groups = {}

 sessions.forEach(s => {
 const coach = getSessionCoach(s)
 const ekskul = s.extracurricular || { id: 'unknown', name: 'Ekskul Tidak Diketahui' }
 const yyyymm = s.session_date ? s.session_date.substring(0, 7) : 'unknown'

 const key = `${coach.id}_${ekskul.id}_${yyyymm}`
 if (!groups[key]) {
 groups[key] = {
 coachId: coach.id,
 coachName: coach.full_name,
 coachEmail: coach.email || '-',
 ekskulId: ekskul.id,
 ekskulName: ekskul.name,
 monthKey: yyyymm,
 sessionsCount: 0,
 sessionsList: []
 }
 }
 groups[key].sessionsCount++
 groups[key].sessionsList.push({
 id: s.id,
 session_date: s.session_date,
 topic: s.topic,
 notes: s.notes
 })
 })

 return Object.values(groups).filter(row => {
 const matchCoach = selectedCoach ? row.coachId === selectedCoach : true
 const matchEkskul = selectedEkskul ? row.ekskulId === selectedEkskul : true
 const matchMonth = selectedMonth ? row.monthKey === selectedMonth : true
 const matchSearch = searchQuery
 ? row.coachName.toLowerCase().includes(searchQuery.toLowerCase()) ||
 row.ekskulName.toLowerCase().includes(searchQuery.toLowerCase()) ||
 row.sessionsList.some(s => s.topic?.toLowerCase().includes(searchQuery.toLowerCase()))
 : true

 return matchCoach && matchEkskul && matchMonth && matchSearch
 })
 }, [sessions, selectedCoach, selectedEkskul, selectedMonth, searchQuery])

 // --- CORE COMPUTED METRICS ---
 const computedStats = useMemo(() => {
 // 1. Total Enrolled
 const totalEnrolled = enrollments.length

 // 2. Average Grade Overall
 let totalGradeScore = 0
 let gradeCount = 0
 grades.forEach(g => {
 const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
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
 const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
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
 const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
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
 activity: g.activity_score || 0,
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

 const exportCoachSessionsToExcel = () => {
 const rows = coachSessionReportRows.map(r => [
 r.coachName,
 r.coachEmail,
 r.ekskulName,
 formatMonthYearIndo(r.monthKey),
 r.sessionsCount,
 r.sessionsList.map(s => `${s.session_date} (${s.topic || 'Sesi Latihan'})`).join('; ')
 ])
 const headers = ['Nama Pelatih', 'Email Pelatih', 'Ekstrakurikuler', 'Bulan & Tahun', 'Jumlah Sesi', 'Daftar Sesi']
 exportToExcel(rows, headers, 'Laporan Sesi Pelatih', 'rekap_sesi_pelatih.xlsx')
 }

 const exportCoachSessionsDetailToExcel = (rowGroup) => {
 const { coachName, ekskulName, monthKey, sessionsList, ekskulId } = rowGroup

 // Find total active students registered in this ekskul
 const totalPeserta = enrollments.filter(en => en.extracurricular_id === ekskulId).length

 // Extract academic year & semester from enrollments, default to 2025/2026 & Genap
 const sampleEnroll = enrollments.find(en => en.extracurricular_id === ekskulId)
 const academicYear = sampleEnroll?.academic_year || '2025/2026'
 const semester = sampleEnroll?.semester || 'Genap'

 const monthsIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
 const [year, month] = monthKey.split('-')
 const periodeLabel = `${monthsIndo[parseInt(month, 10) - 1]} ${year}`

 // Construct the custom header structure like the image
 const data = [
 ['DAFTAR HADIR PEMBIMBING EKSTRAKURIKULER'],
 ['SMP GLOBAL MADANI'],
 [`SEMESTER ${semester.toUpperCase()} - TAHUN AKADEMIK ${academicYear}`],
 [],
 [`Periode: ${periodeLabel}`],
 [],
 [`Pembimbing : ${coachName}`, '', '', '', `Jenis Ekskul : ${ekskulName}`],
 ['Kelas : -', '', '', '', `Jumlah Peserta : ${totalPeserta} Siswa`],
 [],
 ['No', 'Hari/Tanggal', 'Waktu', '', 'Materi', 'Tanda Tangan', 'Siswa Tidak Hadir'],
 ['', '', 'Mulai', 'Selesai', '', '', '']
 ]

 // Populate data rows for each session
 sessionsList.forEach((s, index) => {
 const dateObj = new Date(s.session_date)
 const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' })
 const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
 const formattedDate = `${dayName}, ${dateStr}`

 // Find absent students
 const absentList = attendances
 .filter(a => a.session_id === s.id && a.status !== 'hadir')
 .map(a => a.student?.full_name || '')
 .filter(Boolean)
 .join(', ')

 data.push([
 index + 1,
 formattedDate,
 '14.00', // Default Waktu Mulai
 '15.30', // Default Waktu Selesai
 s.topic || '-',
 '', // Kolom Tanda Tangan
 absentList || 'Nihil'
 ])
 })

 // Create Worksheet & apply structural properties
 const ws = XLSX.utils.aoa_to_sheet(data)

 // Merges matching the layout in the image
 ws['!merges'] = [
 // Title merges
 { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // A1:G1
 { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // A2:G2
 { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }, // A3:G3
 { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }, // A5:G5

 // Header Info merges (Pembimbing & Jenis Ekskul)
 { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } }, // A7:D7
 { s: { r: 6, c: 4 }, e: { r: 6, c: 6 } }, // E7:G7
 { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } }, // A8:D8
 { s: { r: 7, c: 4 }, e: { r: 7, c: 6 } }, // E8:G8

 // Table Header merges
 { s: { r: 9, c: 0 }, e: { r: 10, c: 0 } }, // No (A10:A11)
 { s: { r: 9, c: 1 }, e: { r: 10, c: 1 } }, // Hari/Tanggal (B10:B11)
 { s: { r: 9, c: 2 }, e: { r: 9, c: 3 } }, // Waktu (C10:D10)
 { s: { r: 9, c: 4 }, e: { r: 10, c: 4 } }, // Materi (E10:E11)
 { s: { r: 9, c: 5 }, e: { r: 10, c: 5 } }, // Tanda Tangan (F10:F11)
 { s: { r: 9, c: 6 }, e: { r: 10, c: 6 } } // Siswa Tidak Hadir (G10:G11)
 ]

 // Set Column Widths
 ws['!cols'] = [
 { wch: 6 }, // No
 { wch: 22 }, // Hari/Tanggal
 { wch: 10 }, // Mulai
 { wch: 10 }, // Selesai
 { wch: 32 }, // Materi
 { wch: 15 }, // Tanda Tangan
 { wch: 30 } // Siswa Tidak Hadir
 ]

 const wb = XLSX.utils.book_new()
 XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir')

 const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
 const sanitizedCoachName = coachName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
 const sanitizedEkskulName = ekskulName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
 saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `daftar_hadir_${sanitizedCoachName}_${sanitizedEkskulName}_${monthKey}.xlsx`)
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

 const coachChartData = useMemo(() => {
 const coachSessionCounts = {}
 sessions.forEach(s => {
 const coach = getSessionCoach(s)
 coachSessionCounts[coach.full_name] = (coachSessionCounts[coach.full_name] || 0) + 1
 })
 return Object.entries(coachSessionCounts).map(([name, count]) => ({
 name,
 'Jumlah Sesi': count
 }))
 }, [sessions])

 if (loading) {
 return (
 <div className="flex flex-col items-center justify-center py-32 space-y-4">
 <Loader2 className="w-10 h-10 text-pixel-blue animate-spin" />
 <p className="text-pixel-lavender font-retro text-lg">Memuat formulir rekap & laporan...</p>
 </div>
 )
 }

 return (
 <div className="space-y-8 pb-12">
 {/* Header Banner */}
 <div className="bg-pixel-navy p-6 md:p-8 rounded-none text-pixel-white shadow-pixel-sm border-3 border-pixel-gray flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
 <div className="absolute right-0 top-0 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12 scale-150">
 <FileSpreadsheet className="w-80 h-80" />
 </div>
 <div className="relative z-10 space-y-2">
 <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
 <ClipboardCheck className="w-8 h-8 text-pixel-blue" />
 Rekapitulasi & Laporan Sekolah
 </h1>
 <p className="text-pixel-peach max-w-2xl text-sm md:text-base">
 Unduh laporan rekapitulasi nilai, absensi, dan partisipasi siswa di setiap ekstrakurikuler dalam format spreadsheet Excel secara langsung.
 </p>
 </div>
 </div>

 {errorMsg && (
 <div className="bg-pixel-red/10 border border-rose-200 text-rose-700 p-4 rounded-none flex items-center gap-3 shadow-pixel-sm">
 <AlertCircle className="w-5 h-5 text-pixel-red shrink-0" />
 <p className="font-retro text-lg">{errorMsg}</p>
 </div>
 )}

 {/* Stats Cards Row */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden hover:brightness-110 transition-shadow">
 <CardContent className="p-6 flex items-center justify-between">
 <div className="space-y-1">
 <p className="font-retro text-lg text-pixel-lavender">Total Keikutsertaan Siswa</p>
 <h3 className="text-3xl font-extrabold text-pixel-white">{computedStats.totalEnrolled}</h3>
 <p className="text-xs text-pixel-lavender">Total siswa terdaftar secara aktif</p>
 </div>
 <div className="p-4 rounded-none bg-pixel-blue/10 text-pixel-blue">
 <Users className="w-6 h-6" />
 </div>
 </CardContent>
 </Card>

 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden hover:brightness-110 transition-shadow">
 <CardContent className="p-6 flex items-center justify-between">
 <div className="space-y-1">
 <p className="font-retro text-lg text-pixel-lavender">Rata-rata Nilai Sekolah</p>
 <h3 className="text-3xl font-extrabold text-pixel-green">{computedStats.avgGrade} <span className="text-sm text-pixel-lavender">/ 100</span></h3>
 <p className="text-xs text-pixel-lavender">Dari seluruh nilai ekskul siswa</p>
 </div>
 <div className="p-4 rounded-none bg-pixel-green/10 text-pixel-green">
 <GraduationCap className="w-6 h-6" />
 </div>
 </CardContent>
 </Card>

 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden hover:brightness-110 transition-shadow">
 <CardContent className="p-6 flex items-center justify-between">
 <div className="space-y-1">
 <p className="font-retro text-lg text-pixel-lavender">Rata-rata Kehadiran</p>
 <h3 className="text-3xl font-extrabold text-cyan-600">{computedStats.attendanceRate}%</h3>
 <p className="text-xs text-pixel-lavender">Tingkat kehadiran di seluruh sesi</p>
 </div>
 <div className="p-4 rounded-none bg-cyan-50 text-cyan-600">
 <Activity className="w-6 h-6" />
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Main Recap Visual Chart */}
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
 <CardHeader className="p-6 pb-0">
 <CardTitle className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white">
 {activeTab === 'coachSessions' ? 'Sesi Latihan per Pelatih' : 'Perbandingan Nilai & Absensi Antar Ekskul'}
 </CardTitle>
 <CardDescription>
 {activeTab === 'coachSessions'
 ? 'Grafik jumlah total sesi latihan yang telah dilaksanakan oleh masing-masing pelatih'
 : 'Grafik perbandingan rata-rata nilai akademik dan persentase kehadiran siswa per cabang ekskul'}
 </CardDescription>
 </CardHeader>
 <CardContent className="p-6">
 <div className="w-full h-[320px]">
 {activeTab === 'coachSessions' ? (
 coachChartData.length === 0 ? (
 <div className="h-full flex items-center justify-center text-pixel-lavender text-sm">Belum ada data visualisasi sesi pelatih.</div>
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={coachChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
 <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
 <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
 <RechartsTooltip />
 <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
 <Bar dataKey="Jumlah Sesi" fill="#6366f1" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )
 ) : (
 chartData.length === 0 ? (
 <div className="h-full flex items-center justify-center text-pixel-lavender text-sm">Belum ada data visualisasi yang cukup.</div>
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
 )
 )}
 </div>
 </CardContent>
 </Card>

 {/* Tabs Navigation */}
 <div className="space-y-6">
 <div className="flex border-b border-pixel-gray gap-6 overflow-x-auto pb-px scrollbar-none">
 <button 
 onClick={() => { setActiveTab('overview'); setSearchQuery(''); setSelectedEkskul(''); }}
 className={`pb-3 font-retro text-lg border-b-2 whitespace-nowrap ${
 activeTab === 'overview' ? 'border-indigo-600 text-pixel-blue' : 'border-transparent text-pixel-lavender hover:text-pixel-white'
 }`}
 >
 Ringkasan Ekskul
 </button>
 <button 
 onClick={() => { setActiveTab('attendance'); setSearchQuery(''); setSelectedEkskul(''); setSelectedSemester(''); setSelectedAcademicYear(''); }}
 className={`pb-3 font-retro text-lg border-b-2 whitespace-nowrap ${
 activeTab === 'attendance' ? 'border-indigo-600 text-pixel-blue' : 'border-transparent text-pixel-lavender hover:text-pixel-white'
 }`}
 >
 Laporan Absensi Siswa
 </button>
 <button 
 onClick={() => { setActiveTab('grades'); setSearchQuery(''); setSelectedEkskul(''); setSelectedSemester(''); setSelectedAcademicYear(''); }}
 className={`pb-3 font-retro text-lg border-b-2 whitespace-nowrap ${
 activeTab === 'grades' ? 'border-indigo-600 text-pixel-blue' : 'border-transparent text-pixel-lavender hover:text-pixel-white'
 }`}
 >
 Laporan Nilai Siswa
 </button>
 <button 
 onClick={() => { setActiveTab('coachSessions'); setSearchQuery(''); setSelectedCoach(''); setSelectedEkskul(''); setSelectedMonth(''); }}
 className={`pb-3 font-retro text-lg border-b-2 whitespace-nowrap ${
 activeTab === 'coachSessions' ? 'border-indigo-600 text-pixel-blue' : 'border-transparent text-pixel-lavender hover:text-pixel-white'
 }`}
 >
 Laporan Sesi Pelatih
 </button>
 </div>

 {/* Global & Specific Filters */}
 <div className="bg-pixel-navy border border-pixel-gray/30 rounded-none p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div className="flex flex-wrap items-center gap-3 flex-1">
 {/* Search Filter */}
 <div className="relative flex-1 min-w-[200px] max-w-sm">
 <Search className="w-4 h-4 text-pixel-lavender absolute left-3 top-3" />
 <input
 type="text"
 placeholder={
 activeTab === 'overview' ?"Cari ekskul atau pelatih..." : 
 activeTab === 'coachSessions' ?"Cari pelatih, ekskul atau materi..." : 
"Cari nama siswa atau NIS..."
 }
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 className="w-full text-sm pl-9 pr-4 py-2 bg-pixel-panel border border-pixel-gray rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
 />
 </div>

 {/* Attendance & Grades Specific Filters */}
 {(activeTab === 'attendance' || activeTab === 'grades') && (
 <>
 <select
 value={selectedEkskul}
 onChange={e => setSelectedEkskul(e.target.value)}
 className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300"
 >
 <option value="">Semua Ekskul</option>
 {extracurriculars.map(e => (
 <option key={e.id} value={e.id}>{e.name}</option>
 ))}
 </select>

 <select
 value={selectedSemester}
 onChange={e => setSelectedSemester(e.target.value)}
 className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300"
 >
 <option value="">Semua Semester</option>
 {semesters.map(s => (
 <option key={s} value={s}>Semester {s}</option>
 ))}
 </select>

 <select
 value={selectedAcademicYear}
 onChange={e => setSelectedAcademicYear(e.target.value)}
 className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300"
 >
 <option value="">Semua Tahun Ajaran</option>
 {academicYears.map(y => (
 <option key={y} value={y}>{y}</option>
 ))}
 </select>
 </>
 )}

 {/* Coach Sessions Specific Filters */}
 {activeTab === 'coachSessions' && (
 <>
 <select
 value={selectedCoach}
 onChange={e => setSelectedCoach(e.target.value)}
 className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300"
 >
 <option value="">Semua Pelatih</option>
 {coaches.map(c => (
 <option key={c.id} value={c.id}>{c.full_name}</option>
 ))}
 </select>

 <select
 value={selectedEkskul}
 onChange={e => setSelectedEkskul(e.target.value)}
 className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300"
 >
 <option value="">Semua Ekskul</option>
 {extracurriculars.map(e => (
 <option key={e.id} value={e.id}>{e.name}</option>
 ))}
 </select>

 <select
 value={selectedMonth}
 onChange={e => setSelectedMonth(e.target.value)}
 className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300"
 >
 <option value="">Semua Bulan</option>
 {availableMonths.map(m => (
 <option key={m} value={m}>{formatMonthYearIndo(m)}</option>
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
 activeTab === 'attendance' ? exportAttendanceToExcel :
 activeTab === 'coachSessions' ? exportCoachSessionsToExcel : exportGradesToExcel
 }
 disabled={
 (activeTab === 'overview' && filteredEkskulSummaries.length === 0) ||
 (activeTab === 'attendance' && attendanceReportRows.length === 0) ||
 (activeTab === 'grades' && gradeReportRows.length === 0) ||
 (activeTab === 'coachSessions' && coachSessionReportRows.length === 0)
 }
 className="bg-indigo-600 hover:bg-indigo-700 text-pixel-white shadow-pixel-sm flex items-center gap-2 w-full md:w-auto"
 >
 <Download className="w-4 h-4" />
 Ekspor ke Excel
 </Button>
 </div>
 </div>

 {/* Tab 1 Content: Overview */}
 {activeTab === 'overview' && (
 <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-sm">
 <thead>
 <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
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
 <tbody className="divide-y-2 divide-pixel-gray/30">
 {filteredEkskulSummaries.length === 0 ? (
 <tr>
 <td colSpan="8" className="p-8 text-center text-pixel-lavender">Tidak ada ekskul yang cocok dengan pencarian.</td>
 </tr>
 ) : (
 filteredEkskulSummaries.map(e => (
 <tr key={e.id} className="hover:bg-pixel-navy/30">
 <td className="p-4 pl-6 font-semibold text-pixel-white">{e.name}</td>
 <td className="p-4 text-pixel-peach">{e.coachName}</td>
 <td className="p-4 text-pixel-lavender">{e.schedule}</td>
 <td className="p-4 text-center font-semibold text-pixel-peach">{e.activeSiswa}</td>
 <td className="p-4 text-center text-pixel-lavender">{e.sessionsCount}</td>
 <td className="p-4 text-center">
 <span className={`inline-block px-2.5 py-0.5 rounded-none font-bold text-xs ${
 e.attendanceRate >= 80 ? 'bg-pixel-green/10 text-pixel-green' :
 e.attendanceRate >= 60 ? 'bg-amber-50 text-pixel-orange' : 'bg-pixel-red/10 text-pixel-red'
 }`}>
 {e.attendanceRate}%
 </span>
 </td>
 <td className="p-4 text-center font-bold text-pixel-blue">{e.avgGrade || '-'}</td>
 <td className="p-4 text-center pr-6">
 <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-2xs font-bold uppercase ${
 e.isActive ? 'bg-pixel-green/10 text-pixel-green' : 'bg-slate-100 text-pixel-lavender'
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
 <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-sm">
 <thead>
 <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
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
 <tbody className="divide-y-2 divide-pixel-gray/30">
 {attendanceReportRows.length === 0 ? (
 <tr>
 <td colSpan="9" className="p-8 text-center text-pixel-lavender">Tidak ada laporan kehadiran yang cocok dengan kriteria filter.</td>
 </tr>
 ) : (
 attendanceReportRows.map((r, i) => (
 <tr key={i} className="hover:bg-pixel-navy/30">
 <td className="p-4 pl-6 font-mono text-pixel-lavender">{r.nis}</td>
 <td className="p-4 font-semibold text-pixel-white">{r.studentName}</td>
 <td className="p-4 text-center text-pixel-peach">{r.class}</td>
 <td className="p-4 font-medium text-pixel-peach">{r.ekskulName}</td>
 <td className="p-4 text-center font-bold text-pixel-green">{r.hadir}</td>
 <td className="p-4 text-center text-pixel-orange">{r.izin}</td>
 <td className="p-4 text-center text-pixel-red">{r.alpha}</td>
 <td className="p-4 text-center text-pixel-lavender">{r.total}</td>
 <td className="p-4 pr-6">
 <div className="flex items-center gap-3">
 <div className="flex-1 h-2 bg-slate-100 rounded-none overflow-hidden min-w-[50px]">
 <div 
 className={`h-full rounded-none ${
 r.percentage >= 80 ? 'bg-pixel-green/100' :
 r.percentage >= 60 ? 'bg-amber-500' : 'bg-pixel-red/100'
 }`} 
 style={{ width: `${r.percentage}%` }}
 ></div>
 </div>
 <span className="font-bold text-pixel-peach shrink-0 text-xs">{r.percentage}%</span>
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
 <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-sm">
 <thead>
 <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
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
 <tbody className="divide-y-2 divide-pixel-gray/30">
 {gradeReportRows.length === 0 ? (
 <tr>
 <td colSpan="10" className="p-8 text-center text-pixel-lavender">Tidak ada laporan nilai yang cocok dengan kriteria filter.</td>
 </tr>
 ) : (
 gradeReportRows.map(r => (
 <tr key={r.id} className="hover:bg-pixel-navy/30">
 <td className="p-4 pl-6 font-mono text-pixel-lavender">{r.nis}</td>
 <td className="p-4 font-semibold text-pixel-white">{r.studentName}</td>
 <td className="p-4 text-center text-pixel-peach">{r.class}</td>
 <td className="p-4 font-medium text-pixel-peach">{r.ekskulName}</td>
 <td className="p-4 text-center text-pixel-peach font-semibold">{r.attitude}</td>
 <td className="p-4 text-center text-pixel-peach font-semibold">{r.skill}</td>
 <td className="p-4 text-center text-pixel-peach font-semibold">{r.activity}</td>
 <td className="p-4 text-center font-extrabold text-pixel-white">{r.avg}</td>
 <td className="p-4 text-center">
 <span className={`inline-block w-7 h-7 rounded-none leading-7 text-center font-black text-xs ${
 r.predikat === 'A' ? 'bg-pixel-green/10 text-pixel-green border border-emerald-200' :
 r.predikat === 'B' ? 'bg-blue-50 text-pixel-blue border border-blue-200' :
 r.predikat === 'C' ? 'bg-amber-50 text-pixel-orange border border-amber-200' : 
 'bg-pixel-red/10 text-pixel-red border border-rose-200'
 }`}>
 {r.predikat}
 </span>
 </td>
 <td className="p-4 text-pixel-lavender italic text-xs pr-6 truncate max-w-[200px]" title={r.notes}>
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

 {/* Tab 4 Content: Coach Sessions Report */}
 {activeTab === 'coachSessions' && (
 <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-sm">
 <thead>
 <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
 <th className="p-4 pl-6">Nama Pelatih</th>
 <th className="p-4">Email Pelatih</th>
 <th className="p-4">Ekstrakurikuler</th>
 <th className="p-4 text-center">Bulan & Tahun</th>
 <th className="p-4 text-center">Total Sesi Pertemuan</th>
 <th className="p-4 text-center pr-6">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30">
 {coachSessionReportRows.length === 0 ? (
 <tr>
 <td colSpan="6" className="p-8 text-center text-pixel-lavender">Tidak ada data rekap sesi pelatih yang cocok dengan kriteria filter.</td>
 </tr>
 ) : (
 coachSessionReportRows.map((r, idx) => (
 <tr key={idx} className="hover:bg-pixel-navy/30">
 <td className="p-4 pl-6 font-semibold text-pixel-white">{r.coachName}</td>
 <td className="p-4 text-pixel-lavender">{r.coachEmail}</td>
 <td className="p-4 font-medium text-pixel-peach">{r.ekskulName}</td>
 <td className="p-4 text-center text-pixel-peach font-medium">{formatMonthYearIndo(r.monthKey)}</td>
 <td className="p-4 text-center pr-6 font-bold text-pixel-blue">{r.sessionsCount} Sesi</td>
 <td className="p-4 text-center pr-6 space-x-2">
 <Button 
 variant="ghost" 
 size="sm" 
 onClick={() => setSelectedSessionGroup(r)}
 className="text-pixel-blue hover:text-indigo-700 hover:bg-pixel-blue/10 font-semibold text-xs"
 >
 Lihat Detail
 </Button>
 <Button 
 variant="outline" 
 size="sm" 
 onClick={() => exportCoachSessionsDetailToExcel(r)}
 className="text-pixel-green hover:text-pixel-green hover:bg-pixel-green/10 border-emerald-200 hover:border-emerald-300 font-semibold text-xs gap-1"
 >
 <Download className="w-3.5 h-3.5" />
 Unduh Form
 </Button>
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

 {/* Detail Sesi Pelatih Modal */}
 {selectedSessionGroup && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-2xl overflow-hidden pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy">
 <div>
 <h3 className="font-bold text-pixel-white text-lg flex items-center gap-2">
 <BookOpen className="w-5 h-5 text-pixel-blue" />
 Detail Sesi Latihan
 </h3>
 <p className="text-xs text-pixel-lavender mt-0.5">
 Pelatih: <span className="font-semibold text-pixel-peach">{selectedSessionGroup.coachName}</span> | Ekskul: <span className="font-semibold text-pixel-peach">{selectedSessionGroup.ekskulName}</span>
 </p>
 </div>
 <Button onClick={() => setSelectedSessionGroup(null)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 
 <div className="p-6 overflow-y-auto max-h-[400px] space-y-4">
 <p className="font-retro text-lg text-pixel-white">
 Riwayat Sesi untuk Bulan {formatMonthYearIndo(selectedSessionGroup.monthKey)}
 </p>
 
 <div className="space-y-3">
 {selectedSessionGroup.sessionsList.map((session, sIdx) => (
 <div key={session.id || sIdx} className="bg-pixel-navy border border-pixel-gray/30 p-4 rounded-none space-y-2">
 <div className="flex justify-between items-center">
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-pixel-blue/10 text-indigo-700 font-retro text-base font-mono">
 <Calendar className="w-3.5 h-3.5" />
 {new Date(session.session_date).toLocaleDateString('id-ID', {
 weekday: 'long',
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 })}
 </span>
 </div>
 <div>
 <p className="text-sm font-bold text-pixel-white">{session.topic || 'Sesi Umum'}</p>
 <p className="text-xs text-pixel-lavender mt-1 whitespace-pre-line">{session.notes || 'Tidak ada catatan evaluasi untuk sesi ini.'}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 
 <div className="px-6 py-4 border-t border-pixel-gray/30 bg-pixel-navy flex justify-end gap-2">
 <Button 
 onClick={() => exportCoachSessionsDetailToExcel(selectedSessionGroup)}
 className="bg-emerald-600 hover:bg-emerald-700 text-pixel-white shadow-pixel-sm flex items-center gap-1.5"
 >
 <Download className="w-4 h-4" />
 Unduh Form Excel
 </Button>
 <Button onClick={() => setSelectedSessionGroup(null)} variant="outline">
 Tutup
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
