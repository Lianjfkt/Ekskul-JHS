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
 Loader2, 
 TrendingUp, 
 Activity, 
 GraduationCap, 
 Users, 
 Download,
 CheckCircle,
 AlertCircle,
 AlertTriangle,
 Calendar,
 X,
 BookOpen,
 ShieldAlert,
 BarChart2,
 TrendingDown,
 Minus
} from 'lucide-react'
import { saveAs } from 'file-saver'
import { addKopSuratToPDF } from '../../utils/pdfHelper'
import {
 ResponsiveContainer,
 BarChart,
 Bar,
 LineChart,
 Line,
 XAxis,
 YAxis,
 Tooltip as RechartsTooltip,
 CartesianGrid,
 Legend
} from 'recharts'

// ─── Helpers ────────────────────────────────────────────────────────────────

const monthsIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function getMondayOfCurrentWeek() {
 const d = new Date()
 const day = d.getDay()
 const diff = d.getDate() - day + (day === 0 ? -6 : 1)
 const monday = new Date(d.setDate(diff))
 monday.setHours(0,0,0,0)
 return monday.toISOString().split('T')[0]
}

function getSundayOfCurrentWeek() {
 const monday = new Date(getMondayOfCurrentWeek())
 const sunday = new Date(monday.setDate(monday.getDate() + 6))
 sunday.setHours(23,59,59,999)
 return sunday.toISOString().split('T')[0]
}

function formatDateIndo(dateStr) {
 if (!dateStr) return ''
 const d = new Date(dateStr)
 return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMonthYearIndo(yyyymm) {
 if (!yyyymm || yyyymm === 'unknown') return 'Bulan Tidak Diketahui'
 const [year, month] = yyyymm.split('-')
 return `${monthsIndo[parseInt(month, 10) - 1]} ${year}`
}

function getSessionPeriodKey(sessionDate) {
 if (!sessionDate) return 'unknown'
 const date = new Date(sessionDate)
 const day = date.getDate()
 const month = date.getMonth()
 const year = date.getFullYear()
 if (day >= 20) {
  const endMonth = (month + 1) % 12
  const endYear = month === 11 ? year + 1 : year
  return `${year}-${String(month+1).padStart(2,'0')}_${endYear}-${String(endMonth+1).padStart(2,'0')}`
 } else {
  const startMonth = (month - 1 + 12) % 12
  const startYear = month === 0 ? year - 1 : year
  return `${startYear}-${String(startMonth+1).padStart(2,'0')}_${year}-${String(month+1).padStart(2,'0')}`
 }
}

function formatPeriodIndo(periodKey) {
 if (!periodKey || periodKey === 'unknown') return 'Periode Tidak Diketahui'
 const parts = periodKey.split('_')
 if (parts.length !== 2) return formatMonthYearIndo(periodKey)
 const [s, e] = parts
 const [sy, sm] = s.split('-')
 const [ey, em] = e.split('-')
 return `20 ${monthsIndo[parseInt(sm,10)-1]} ${sy} – 19 ${monthsIndo[parseInt(em,10)-1]} ${ey}`
}

function formatPeriodShortIndo(periodKey) {
 if (!periodKey || periodKey === 'unknown') return 'Periode Tidak Diketahui'
 const parts = periodKey.split('_')
 if (parts.length !== 2) return formatMonthYearIndo(periodKey)
 const [s, e] = parts
 const [, sm] = s.split('-')
 const [ey, em] = e.split('-')
 return `${monthsIndo[parseInt(sm,10)-1]} – ${monthsIndo[parseInt(em,10)-1]} ${ey}`
}

function getSessionMonthKey(sessionDate) {
 if (!sessionDate) return 'unknown'
 const d = new Date(sessionDate)
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

// ─── PDF Export Helper ───────────────────────────────────────────────────────

async function exportWarningsToPDF(rows) {
 const { default: jsPDF } = await import('jspdf')
 const { default: autoTable } = await import('jspdf-autotable')

 const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
 const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

 const startY = await addKopSuratToPDF(doc, 'landscape')

 doc.setFontSize(14)
 doc.setFont('helvetica', 'bold')
 doc.text('LAPORAN SISWA BERMASALAH — KEHADIRAN EKSTRAKURIKULER', 14, startY + 6)
 doc.setFontSize(10)
 doc.setFont('helvetica', 'normal')
 doc.text(`SMP Global Madani  |  Dicetak: ${now}`, 14, startY + 14)

 autoTable(doc, {
  startY: startY + 20,
  head: [['No','NIS','Nama Siswa','Kelas','Ekstrakurikuler','Jenis','Hadir','Alpha','% Kehadiran','Status']],
  body: rows.map((r,i) => [
   i + 1, r.nis, r.studentName, r.class, r.ekskulName,
   r.isMandatory ? 'Wajib' : 'Pilihan',
   r.hadir, r.alpha, `${r.percentage}%`, r.warningLabel
  ]),
  headStyles: { fillColor: [79,70,229], fontSize: 9 },
  bodyStyles: { fontSize: 8 },
  alternateRowStyles: { fillColor: [245,245,255] },
  didParseCell: (data) => {
   if (data.section === 'body') {
    const status = data.row.raw[9]
    if (status === 'TEGURAN') data.cell.styles.textColor = [185,28,28]
    else if (status === 'PERINGATAN') data.cell.styles.textColor = [180,83,9]
   }
  },
  margin: { left: 14, right: 14 }
 })

 doc.save(`laporan_siswa_bermasalah_${now.replace(/ /g,'_')}.pdf`)
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RecapManagement() {
 const [loading, setLoading] = useState(true)
 const [activeTab, setActiveTab] = useState('overview')
 const [errorMsg, setErrorMsg] = useState('')
 const [selectedSessionGroup, setSelectedSessionGroup] = useState(null)

 // Raw data
 const [extracurriculars, setExtracurriculars] = useState([])
 const [enrollments, setEnrollments] = useState([])
 const [grades, setGrades] = useState([])
 const [sessions, setSessions] = useState([])
 const [attendances, setAttendances] = useState([])
 const [coaches, setCoaches] = useState([])
 const [specialParticipants, setSpecialParticipants] = useState([])

 // Filters
 const [selectedEkskul, setSelectedEkskul] = useState('')
 const [selectedSemester, setSelectedSemester] = useState('')
 const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
 const [selectedCoach, setSelectedCoach] = useState('')
 const [selectedMonth, setSelectedMonth] = useState('')
 const [searchQuery, setSearchQuery] = useState('')
 const [warningTypeFilter, setWarningTypeFilter] = useState('') // 'wajib' | 'pilihan' | ''
 const [warningLevelFilter, setWarningLevelFilter] = useState('') // 'TEGURAN' | 'PERINGATAN' | ''
 const [trackingStartDate, setTrackingStartDate] = useState(getMondayOfCurrentWeek())
 const [trackingEndDate, setTrackingEndDate] = useState(getSundayOfCurrentWeek())

 useEffect(() => {
  fetchData()
 }, [])

 const fetchData = async () => {
  setLoading(true)
  setErrorMsg('')
  try {
   const [
    { data: ekskulData, error: eErr },
    { data: enrollmentsData, error: enErr },
    { data: gradesData, error: gErr },
    { data: sessionsData, error: sErr },
    { data: attendancesData, error: aErr },
    { data: coachesData, error: cErr },
    { data: spData, error: spErr }
   ] = await Promise.all([
    supabase.from('extracurriculars').select('*, coach:coach_id (id, full_name, email), coach2:coach_id_2 (id, full_name, email), coach3:coach_id_3 (id, full_name, email)').order('name', { ascending: true }),
    supabase.from('enrollments').select('*, student:student_id (id, nis, full_name, class)').eq('status', 'active'),
    supabase.from('grades').select('*, student:student_id (id, nis, full_name, class), extracurricular:extracurricular_id (id, name)'),
    supabase.from('sessions').select('*, creator:created_by (id, full_name, email), extracurricular:extracurricular_id (id, name, coach:coach_id (id, full_name, email), coach2:coach_id_2 (id, full_name, email), coach3:coach_id_3 (id, full_name, email)), session_coaches (id, coach:coach_id (id, full_name, email))').order('session_date', { ascending: false }),
    supabase.from('attendances').select('*, student:student_id (id, nis, full_name, class)'),
    supabase.from('users').select('id, full_name, email').eq('role', 'coach').order('full_name', { ascending: true }),
    supabase.from('special_session_participants').select('*')
   ])

   if (eErr) throw eErr
   if (enErr) throw enErr
   if (gErr) throw gErr
   if (sErr) throw sErr
   if (aErr) throw aErr
   if (cErr) throw cErr
   if (spErr) throw spErr

   setExtracurriculars(ekskulData || [])
   setEnrollments(enrollmentsData || [])
   setGrades(gradesData || [])
   setSessions(sessionsData || [])
   setAttendances(attendancesData || [])
   setCoaches(coachesData || [])
   setSpecialParticipants(spData || [])
  } catch (err) {
   console.error('Error fetching recap data:', err.message)
   setErrorMsg('Gagal memuat data laporan: ' + err.message)
  } finally {
   setLoading(false)
  }
 }

 // ─── Derived Filters ───────────────────────────────────────────────────────

 const academicYears = useMemo(() => {
  const years = new Set([...enrollments.map(e => e.academic_year), ...grades.map(g => g.academic_year)])
  return Array.from(years).filter(Boolean).sort()
 }, [enrollments, grades])

 const semesters = useMemo(() => {
  const sem = new Set([...enrollments.map(e => e.semester), ...grades.map(g => g.semester)])
  return Array.from(sem).filter(Boolean).sort()
 }, [enrollments, grades])

 const availablePeriods = useMemo(() => {
  const periods = new Set()
  sessions.forEach(s => { if (s.session_date) periods.add(getSessionPeriodKey(s.session_date)) })
  return Array.from(periods).sort().reverse()
 }, [sessions])

 // ─── Coach Session Helpers ─────────────────────────────────────────────────

 const getSessionCoaches = (session) => {
  if (session.session_coaches && session.session_coaches.length > 0) {
   return session.session_coaches.map(sc => sc.coach).filter(Boolean)
  }
  if (session.creator) return [session.creator]
  if (session.extracurricular?.coach) return [session.extracurricular.coach]
  return [{ id: 'unknown', full_name: 'Tanpa Pelatih', email: '' }]
 }

 const coachSessionReportRows = useMemo(() => {
  const groups = {}
  sessions.forEach(s => {
   const coaches = getSessionCoaches(s)
   const ekskul = s.extracurricular || { id: 'unknown', name: 'Ekskul Tidak Diketahui' }
   const periodKey = getSessionPeriodKey(s.session_date)
   coaches.forEach(coach => {
    const key = `${coach.id}_${ekskul.id}_${periodKey}`
    if (!groups[key]) {
     groups[key] = {
      coachId: coach.id, coachName: coach.full_name, coachEmail: coach.email || '-',
      ekskulId: ekskul.id, ekskulName: ekskul.name,
      periodKey, sessionsCount: 0, sessionsList: []
     }
    }
    groups[key].sessionsCount++
    groups[key].sessionsList.push({
     id: s.id, session_date: s.session_date, topic: s.topic,
     notes: s.notes, is_special_training: s.is_special_training, event_name: s.event_name
    })
   })
  })
  return Object.values(groups).filter(row => {
   const matchCoach = selectedCoach ? row.coachId === selectedCoach : true
   const matchEkskul = selectedEkskul ? row.ekskulId === selectedEkskul : true
   const matchMonth = selectedMonth ? row.periodKey === selectedMonth : true
   const matchSearch = searchQuery
    ? row.coachName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.ekskulName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.sessionsList.some(s => s.topic?.toLowerCase().includes(searchQuery.toLowerCase()))
    : true
   return matchCoach && matchEkskul && matchMonth && matchSearch
  })
 }, [sessions, selectedCoach, selectedEkskul, selectedMonth, searchQuery])

 // ─── Core Computed Metrics ─────────────────────────────────────────────────

 const computedStats = useMemo(() => {
  const totalEnrolled = enrollments.length

  let totalGradeScore = 0, gradeCount = 0
  grades.forEach(g => {
   const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
   totalGradeScore += avg; gradeCount++
  })
  const avgGrade = gradeCount > 0 ? Math.round(totalGradeScore / gradeCount) : 0

  const totalAtts = attendances.length
  const presentAtts = attendances.filter(a => a.status === 'hadir').length
  const attendanceRate = totalAtts > 0 ? Math.round((presentAtts / totalAtts) * 100) : 0

  const attendanceStatsByEkskul = {}
  attendances.forEach(a => {
   const session = sessions.find(s => s.id === a.session_id)
   if (session) {
    const eksId = session.extracurricular_id
    if (!attendanceStatsByEkskul[eksId]) attendanceStatsByEkskul[eksId] = { total: 0, present: 0 }
    attendanceStatsByEkskul[eksId].total++
    if (a.status === 'hadir') attendanceStatsByEkskul[eksId].present++
   }
  })

  const gradeStatsByEkskul = {}
  grades.forEach(g => {
   const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
   if (!gradeStatsByEkskul[g.extracurricular_id]) gradeStatsByEkskul[g.extracurricular_id] = { totalScore: 0, count: 0 }
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
   const coachNames = [e.coach?.full_name, e.coach2?.full_name, e.coach3?.full_name].filter(Boolean).join(', ') || 'Belum ditunjuk'
   return {
    id: e.id, name: e.name, coachName: coachNames, schedule: e.schedule || '-',
    isActive: e.is_active, activeSiswa, sessionsCount, attendanceRate, avgGrade: avgGr,
    isMandatory: e.is_mandatory || false, mandatoryClass: e.mandatory_class || null
   }
  })

  return { totalEnrolled, avgGrade, attendanceRate, ekskulSummaries }
 }, [extracurriculars, enrollments, grades, sessions, attendances])

 // ─── Tab 1: Ekskul Summary ─────────────────────────────────────────────────

 const filteredEkskulSummaries = useMemo(() => {
  return computedStats.ekskulSummaries.filter(e =>
   e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
   e.coachName.toLowerCase().includes(searchQuery.toLowerCase())
  )
 }, [computedStats.ekskulSummaries, searchQuery])

 // ─── Tab: Fill Tracking ───────────────────────────────────────────────────

 const fillTrackingRows = useMemo(() => {
  // Normalisasi tanggal — amankan jika session_date dari DB bertipe timestamptz
  // (format "2026-08-19T00:00:00+07:00" vs string "2026-08-19")
  const normalizeDate = (d) => (d ? String(d).split('T')[0] : d)

  return extracurriculars
   .filter(e => e.is_active)
   .map(e => {
    const ekskulSessions = sessions.filter(s =>
     s.extracurricular_id === e.id &&
     normalizeDate(s.session_date) >= trackingStartDate &&
     normalizeDate(s.session_date) <= trackingEndDate
    )

    let hasUnfilledAttendance = false
    const sessionDetails = ekskulSessions.map(s => {
     const sessionAttendancesCount = attendances.filter(a => a.session_id === s.id).length
     // Fix: cek flag attendance_submitted terlebih dulu.
     // Menangani kasus ekskul tanpa siswa enrolled — pelatih tetap bisa
     // menyimpan absensi dan flag ini di-set true, tapi tabel attendances kosong.
     const isFilled = s.attendance_submitted === true || sessionAttendancesCount > 0
     if (!isFilled) {
      hasUnfilledAttendance = true
     }
     return {
      id: s.id,
      date: s.session_date,
      topic: s.topic || 'Tanpa Topik',
      isFilled
     }
    })

    let status = 'completed' // 'no_session' | 'unfilled_attendance' | 'completed'
    if (ekskulSessions.length === 0) {
     status = 'no_session'
    } else if (hasUnfilledAttendance) {
     status = 'unfilled_attendance'
    }

    const coachNames = [e.coach?.full_name, e.coach2?.full_name, e.coach3?.full_name].filter(Boolean).join(', ') || 'Belum ditunjuk'

    return {
     id: e.id,
     name: e.name,
     coachName: coachNames,
     sessionsCount: ekskulSessions.length,
     sessionDetails,
     status
    }
   })
   .filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.coachName.toLowerCase().includes(searchQuery.toLowerCase())
   )
 }, [extracurriculars, sessions, attendances, trackingStartDate, trackingEndDate, searchQuery])

 const trackingStats = useMemo(() => {
  let noSession = 0
  let unfilledAttendance = 0
  let completed = 0
  fillTrackingRows.forEach(r => {
   if (r.status === 'no_session') noSession++
   else if (r.status === 'unfilled_attendance') unfilledAttendance++
   else completed++
  })
  return { total: fillTrackingRows.length, noSession, unfilledAttendance, completed }
 }, [fillTrackingRows])

 // ─── Tab 2: Attendance Report ──────────────────────────────────────────────

 const attendanceReportRows = useMemo(() => {
  const keyMap = {}
  enrollments.forEach(en => {
   const student = en.student
   const ekskul = extracurriculars.find(e => e.id === en.extracurricular_id)
   if (student && ekskul) {
    const key = `${student.id}_${ekskul.id}`
    keyMap[key] = {
     studentId: student.id, nis: student.nis, studentName: student.full_name,
     class: student.class, ekskulId: ekskul.id, ekskulName: ekskul.name,
     semester: en.semester, academicYear: en.academic_year,
     hadir: 0, izin: 0, alpha: 0, total: 0
    }
   }
  })
  attendances.forEach(a => {
   const student = a.student
   const session = sessions.find(s => s.id === a.session_id)
   if (student && session) {
    const key = `${student.id}_${session.extracurricular_id}`
    if (!keyMap[key]) {
     const ekskul = extracurriculars.find(e => e.id === session.extracurricular_id)
     keyMap[key] = {
      studentId: student.id, nis: student.nis, studentName: student.full_name,
      class: student.class, ekskulId: session.extracurricular_id,
      ekskulName: ekskul?.name || 'Ekskul Lama', semester: '-', academicYear: '-',
      hadir: 0, izin: 0, alpha: 0, total: 0
     }
    }
    const row = keyMap[key]
    row.total++
    if (a.status === 'hadir') row.hadir++
    else if (a.status === 'izin') row.izin++
    else if (a.status === 'alpha') row.alpha++
   }
  })
  return Object.values(keyMap).map(row => {
   const percentage = row.total > 0 ? Math.round((row.hadir / row.total) * 100) : 0
   return { ...row, percentage }
  }).filter(row => {
   const matchEkskul = selectedEkskul ? row.ekskulId === selectedEkskul : true
   const matchSemester = selectedSemester ? row.semester === selectedSemester : true
   const matchYear = selectedAcademicYear ? row.academicYear === selectedAcademicYear : true
   const matchSearch = searchQuery
    ? row.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || row.nis.includes(searchQuery)
    : true
   return matchEkskul && matchSemester && matchYear && matchSearch
  })
 }, [enrollments, extracurriculars, attendances, sessions, selectedEkskul, selectedSemester, selectedAcademicYear, searchQuery])

 // ─── Tab 3: Grade Report ───────────────────────────────────────────────────

 const gradeReportRows = useMemo(() => {
  return grades.map(g => {
   const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
   let predikat = 'D'
   if (avg >= 90) predikat = 'A'
   else if (avg >= 75) predikat = 'B'
   else if (avg >= 60) predikat = 'C'
   return {
    id: g.id, nis: g.student?.nis || '-', studentName: g.student?.full_name || 'Unknown',
    class: g.student?.class || '-', ekskulId: g.extracurricular_id,
    ekskulName: g.extracurricular?.name || 'Deleted Ekskul',
    semester: g.semester, academicYear: g.academic_year,
    attitude: g.attitude_score || 0, skill: g.skill_score || 0, activity: g.activity_score || 0,
    avg, predikat, notes: g.notes || '-'
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

 // ─── Tab 5: Warning Siswa Bermasalah ──────────────────────────────────────
 // Helper: deteksi alpha berturut-turut
 const getConsecutiveAlpha = (studentId, ekskulId) => {
  const ekskulSessions = sessions
   .filter(s => s.extracurricular_id === ekskulId)
   .sort((a, b) => new Date(b.session_date) - new Date(a.session_date)) // terbaru dulu

  let consecutive = 0
  for (const session of ekskulSessions) {
   const sessionAtts = attendances.filter(a => a.session_id === session.id)
   const isFilled = sessionAtts.length > 0
   const isInvited = !session.is_special_training || specialParticipants.some(sp => sp.session_id === session.id && sp.student_id === studentId)
   
   if (isFilled && isInvited) {
    const att = sessionAtts.find(a => a.student_id === studentId)
    if (att && att.status === 'alpha') {
     consecutive++
    } else {
     break
    }
   }
  }
  return consecutive
 }

 const warningRows = useMemo(() => {
  const keyMap = {}

  // Build base data from enrollments
  enrollments.forEach(en => {
   const student = en.student
   const ekskul = extracurriculars.find(e => e.id === en.extracurricular_id)
   if (!student || !ekskul) return
   const key = `${student.id}_${ekskul.id}`
   keyMap[key] = {
    studentId: student.id,
    nis: student.nis || '-',
    studentName: student.full_name,
    class: student.class,
    ekskulId: ekskul.id,
    ekskulName: ekskul.name,
    isMandatory: ekskul.is_mandatory || false,
    mandatoryClass: ekskul.mandatory_class || null,
    semester: en.semester,
    academicYear: en.academic_year,
    hadir: 0, izin: 0, alpha: 0, total: 0
   }
  })

  // Sum attendance
  attendances.forEach(a => {
   const student = a.student
   const session = sessions.find(s => s.id === a.session_id)
   if (!student || !session) return
   const key = `${student.id}_${session.extracurricular_id}`
   if (!keyMap[key]) return
   const row = keyMap[key]
   row.total++
   if (a.status === 'hadir') row.hadir++
   else if (a.status === 'izin') row.izin++
   else if (a.status === 'alpha') row.alpha++
  })

  // Apply warning logic
  const result = []
  Object.values(keyMap).forEach(row => {
   if (row.total === 0) return

   const percentage = Math.round((row.hadir / row.total) * 100)
   const consecutiveAlpha = getConsecutiveAlpha(row.studentId, row.ekskulId)

   let warningLevel = null
   let warningLabel = ''
   let warningReasons = []

   if (row.isMandatory) {
    // Ekskul WAJIB: setiap alpha = warning
    if (row.alpha >= 1 && percentage < 80) {
     warningReasons.push(`Kehadiran ${percentage}% (min. 80%)`)
    }
    if (row.alpha >= 1) {
     warningReasons.push(`${row.alpha}x Alpha`)
    }
    if (row.alpha >= 3 || percentage < 70) {
     warningLevel = 'TEGURAN'
     warningLabel = 'TEGURAN'
    } else if (row.alpha >= 1 || percentage < 80) {
     warningLevel = 'PERINGATAN'
     warningLabel = 'PERINGATAN'
    }
   } else {
    // Ekskul PILIHAN: alpha 3x berturut-turut, atau kehadiran < 70%
    if (consecutiveAlpha >= 3) warningReasons.push(`${consecutiveAlpha}x Alpha Berturut-turut`)
    if (percentage < 70) warningReasons.push(`Kehadiran ${percentage}% (min. 70%)`)
    if (consecutiveAlpha >= 5 || percentage < 55) {
     warningLevel = 'TEGURAN'
     warningLabel = 'TEGURAN'
    } else if (consecutiveAlpha >= 3 || percentage < 70) {
     warningLevel = 'PERINGATAN'
     warningLabel = 'PERINGATAN'
    }
   }

   if (!warningLevel) return // hanya tampilkan yang bermasalah

   result.push({
    ...row,
    percentage,
    consecutiveAlpha,
    warningLevel,
    warningLabel,
    warningReasons
   })
  })

  return result.filter(row => {
   const matchEkskul = selectedEkskul ? row.ekskulId === selectedEkskul : true
   const matchSearch = searchQuery
    ? row.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || row.nis.includes(searchQuery)
    : true
   const matchType = warningTypeFilter ? (warningTypeFilter === 'wajib' ? row.isMandatory : !row.isMandatory) : true
   const matchLevel = warningLevelFilter ? row.warningLevel === warningLevelFilter : true
   return matchEkskul && matchSearch && matchType && matchLevel
  }).sort((a, b) => {
   // TEGURAN dulu, lalu urutkan % kehadiran dari terkecil
   if (a.warningLevel !== b.warningLevel) return a.warningLevel === 'TEGURAN' ? -1 : 1
   return a.percentage - b.percentage
  })
 }, [enrollments, extracurriculars, attendances, sessions, specialParticipants, selectedEkskul, searchQuery, warningTypeFilter, warningLevelFilter])

 const warningCount = useMemo(() => warningRows.length, [warningRows])
 const teguranCount = useMemo(() => warningRows.filter(r => r.warningLevel === 'TEGURAN').length, [warningRows])

 // ─── Tab 6: Keaktifan Ekskul ───────────────────────────────────────────────

 // Tren sesi per ekskul per bulan
 const ekskulActivityTrend = useMemo(() => {
  // Kumpulkan semua bulan yang ada
  const monthSet = new Set()
  sessions.forEach(s => { if (s.session_date) monthSet.add(getSessionMonthKey(s.session_date)) })
  const sortedMonths = Array.from(monthSet).sort()
  const lastSixMonths = sortedMonths.slice(-6)

  // Per ekskul, hitung sesi per bulan
  return lastSixMonths.map(monthKey => {
   const entry = { monthLabel: formatMonthYearIndo(monthKey) }
   extracurriculars.slice(0, 6).forEach(e => {
    entry[e.name] = sessions.filter(s =>
     s.extracurricular_id === e.id && getSessionMonthKey(s.session_date) === monthKey
    ).length
   })
   return entry
  })
 }, [sessions, extracurriculars])

 // Ranking ekskul keaktifan
 const ekskulActivityRanking = useMemo(() => {
  return extracurriculars.map(e => {
   const ekskulSessions = sessions.filter(s => s.extracurricular_id === e.id)
   const totalSessions = ekskulSessions.length

   // Tren: bandingkan 3 bulan terakhir dengan 3 bulan sebelumnya
   const now = new Date()
   const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
   const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)

   const recentCount = ekskulSessions.filter(s => new Date(s.session_date) >= threeMonthsAgo).length
   const prevCount = ekskulSessions.filter(s =>
    new Date(s.session_date) >= sixMonthsAgo && new Date(s.session_date) < threeMonthsAgo
   ).length

   let trend = 'Stabil'
   if (recentCount > prevCount + 1) trend = 'Meningkat'
   else if (recentCount < prevCount - 1) trend = 'Menurun'

   const attInfo = attendances.filter(a => {
    const s = sessions.find(ss => ss.id === a.session_id)
    return s && s.extracurricular_id === e.id
   })
   const avgAtt = attInfo.length > 0
    ? Math.round((attInfo.filter(a => a.status === 'hadir').length / attInfo.length) * 100)
    : 0

   const coachNames = [e.coach?.full_name, e.coach2?.full_name, e.coach3?.full_name].filter(Boolean).join(', ') || 'Belum ditunjuk'

   return {
    id: e.id, name: e.name, coachName: coachNames,
    totalSessions, recentCount, prevCount, trend,
    avgAttendance: avgAtt, isActive: e.is_active
   }
  }).filter(e => {
   return searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  }).sort((a, b) => b.totalSessions - a.totalSessions)
 }, [extracurriculars, sessions, attendances, searchQuery])

 const stagnanCount = useMemo(() =>
  ekskulActivityRanking.filter(e => e.trend === 'Menurun' || e.totalSessions === 0).length,
  [ekskulActivityRanking]
 )

 // Chart data
 const chartData = useMemo(() => {
  return computedStats.ekskulSummaries.slice(0, 8).map(e => ({
   name: e.name,
   'Rata-rata Nilai': e.avgGrade,
   'Persentase Absensi': e.attendanceRate
  }))
 }, [computedStats.ekskulSummaries])

 const coachChartData = useMemo(() => {
  const coachSessionCounts = {}
  sessions.forEach(s => {
   const coaches = getSessionCoaches(s)
   coaches.forEach(coach => {
    if (coach && coach.full_name) {
     coachSessionCounts[coach.full_name] = (coachSessionCounts[coach.full_name] || 0) + 1
    }
   })
  })
  return Object.entries(coachSessionCounts).map(([name, count]) => ({ name, 'Jumlah Sesi': count }))
 }, [sessions])

 // ─── Excel Exports ─────────────────────────────────────────────────────────

 const exportToExcel = async (rows, headers, sheetName, filename) => {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const data = [
   ['YAYASAN PENDIDIKAN GLOBAL MADANI'],
   ['SMP GLOBAL MADANI'],
   ['Jl. Kavling Raya, Pramuka Kel. Rajabasa Kec. Rajabasa Kota Bandar Lampung Provinsi Lampung 35144'],
   ['Telf. 0721-8011325/Faks. 0721-8011329 | www.globalmadani.sch.id | e-mail: ypgm.smp@globalmadani.sch.id'],
   [],
   [sheetName.toUpperCase()],
   [],
   headers,
   ...rows
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const maxCols = headers.length

  ws['!merges'] = [
   { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(maxCols - 1, 1) } },
   { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(maxCols - 1, 1) } },
   { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(maxCols - 1, 1) } },
   { s: { r: 3, c: 0 }, e: { r: 3, c: Math.max(maxCols - 1, 1) } },
   { s: { r: 5, c: 0 }, e: { r: 5, c: Math.max(maxCols - 1, 1) } }
  ]

  ws['!cols'] = Array(maxCols).fill({ wch: 18 })
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename)
 }

 const exportEkskulToExcel = () => {
  const rows = filteredEkskulSummaries.map(e => [e.name, e.coachName, e.schedule, e.activeSiswa, e.sessionsCount, `${e.attendanceRate}%`, e.avgGrade])
  exportToExcel(rows, ['Nama Ekstrakurikuler','Nama Pelatih','Jadwal','Siswa Aktif','Sesi Terlaksana','Persentase Absensi','Rata-rata Nilai'], 'Ringkasan Ekskul', 'rekap_ekstrakurikuler.xlsx')
 }

 const exportAttendanceToExcel = () => {
  const rows = attendanceReportRows.map(r => [r.nis, r.studentName, r.class, r.ekskulName, r.semester, r.academicYear, r.hadir, r.izin, r.alpha, r.total, `${r.percentage}%`])
  exportToExcel(rows, ['NIS','Nama Siswa','Kelas','Ekstrakurikuler','Semester','Tahun Ajaran','Hadir','Izin','Alpha','Total Sesi','Persentase Kehadiran'], 'Laporan Kehadiran', 'rekap_kehadiran_siswa.xlsx')
 }

 const exportCoachSessionsToExcel = () => {
  const rows = coachSessionReportRows.map(r => [
   r.coachName, r.coachEmail, r.ekskulName, formatPeriodIndo(r.periodKey), r.sessionsCount,
   r.sessionsList.map(s => {
    const badge = s.is_special_training && s.event_name ? ` [KHUSUS: ${s.event_name}]` : ''
    return `${s.session_date} (${s.topic || 'Sesi Latihan'}${badge})`
   }).join('; ')
  ])
  exportToExcel(rows, ['Nama Pelatih','Email Pelatih','Ekstrakurikuler','Periode','Jumlah Sesi','Daftar Sesi'], 'Laporan Sesi Pelatih', 'rekap_sesi_pelatih.xlsx')
 }

 const exportTrackingToExcel = () => {
  const rows = fillTrackingRows.map(r => [
   r.name,
   r.coachName,
   r.sessionsCount,
   r.status === 'no_session' ? 'Belum Membuat Sesi' : r.status === 'unfilled_attendance' ? 'Absensi Belum Diisi' : 'Lengkap',
   r.sessionDetails.map(s => `${s.date} (${s.isFilled ? 'Lengkap' : 'Belum Absen'})`).join('; ')
  ])
  exportToExcel(
   rows,
   ['Nama Ekstrakurikuler', 'Pelatih', 'Jumlah Sesi', 'Status Pengisian', 'Detail Sesi'],
   'Tracking Pengisian',
   'rekap_tracking_pengisian.xlsx'
  )
 }

 const copyAllToWhatsApp = () => {
  const problematicRows = fillTrackingRows.filter(r => r.status !== 'completed')
  if (problematicRows.length === 0) {
   alert('Semua ekskul sudah melengkapi sesi dan absensi!')
   return
  }
  
  let text = `*🚨 [LAPORAN PENGISIAN EKSKUL] 🚨*\n`
  text += `Periode: ${formatDateIndo(trackingStartDate)} s.d. ${formatDateIndo(trackingEndDate)}\n\n`
  text += `Berikut adalah daftar ekskul yang belum melengkapi sesi/absensi:\n\n`
  
  problematicRows.forEach((r, idx) => {
   text += `${idx + 1}. *${r.name}* (Pelatih: ${r.coachName})\n`
   if (r.status === 'no_session') {
    text += `   - Belum membuat sesi pertemuan.\n`
   } else {
    r.sessionDetails.forEach(s => {
     if (!s.isFilled) {
      text += `   - Sesi ${formatDateIndo(s.date)} (${s.topic}): Absensi belum diisi.\n`
     }
    })
   }
  })
  
  text += `\nMohon para pelatih terkait segera melengkapinya di aplikasi. Terima kasih.`
  
  navigator.clipboard.writeText(text)
  alert('Format laporan WhatsApp berhasil disalin!')
 }

 const copySingleToWhatsApp = (row) => {
  let text = `*Halo ${row.coachName},*\n\n`
  text += `Mohon segera melengkapi administrasi ekskul *${row.name}* untuk periode ${formatDateIndo(trackingStartDate)} s.d. ${formatDateIndo(trackingEndDate)}:\n`
  
  if (row.status === 'no_session') {
   text += `- Belum membuat sesi pertemuan di rentang tanggal tersebut.\n`
  } else {
   row.sessionDetails.forEach(s => {
    if (!s.isFilled) {
     text += `- Sesi tanggal ${formatDateIndo(s.date)} (${s.topic}): Absensi belum diisi.\n`
    }
   })
  }
  
  text += `\nSilakan melengkapi data tersebut melalui portal pelatih. Terima kasih!`
  
  navigator.clipboard.writeText(text)
  alert(`Pesan pengingat untuk ${row.name} berhasil disalin!`)
 }

 const exportGradesToExcel = () => {
  const rows = gradeReportRows.map(r => [r.nis, r.studentName, r.class, r.ekskulName, r.semester, r.academicYear, r.attitude, r.skill, r.activity, r.avg, r.predikat, r.notes])
  exportToExcel(rows, ['NIS','Nama Siswa','Kelas','Ekstrakurikuler','Semester','Tahun Ajaran','Nilai Sikap','Nilai Keterampilan','Nilai Pengetahuan','Rata-rata','Predikat','Catatan'], 'Laporan Nilai', 'rekap_nilai_siswa.xlsx')
 }

 const exportWarningsToExcel = () => {
  const rows = warningRows.map(r => [
   r.nis, r.studentName, r.class, r.ekskulName,
   r.isMandatory ? 'Wajib' : 'Pilihan',
   r.hadir, r.izin, r.alpha, `${r.percentage}%`,
   r.consecutiveAlpha, r.warningLabel, r.warningReasons.join('; ')
  ])
  exportToExcel(rows,
   ['NIS','Nama Siswa','Kelas','Ekstrakurikuler','Jenis','Hadir','Izin','Alpha','% Kehadiran','Alpha Berturut-turut','Status Warning','Alasan'],
   'Siswa Bermasalah', 'rekap_siswa_bermasalah.xlsx'
  )
 }

 const exportActivityToExcel = () => {
  const rows = ekskulActivityRanking.map((e, i) => [
   i + 1, e.name, e.coachName, e.totalSessions, e.recentCount, e.prevCount, e.trend, `${e.avgAttendance}%`, e.isActive ? 'Aktif' : 'Non-aktif'
  ])
  exportToExcel(rows,
   ['Ranking','Nama Ekskul','Pelatih','Total Sesi','3 Bulan Terakhir','3 Bulan Sebelumnya','Tren','Rata-rata Kehadiran','Status'],
   'Keaktifan Ekskul', 'rekap_keaktifan_ekskul.xlsx'
  )
 }


 const exportCoachSessionsDetailToExcel = async (rowGroup) => {
  const XLSX = await import('xlsx')
  const { coachName, ekskulName, periodKey, sessionsList, ekskulId } = rowGroup
  const totalPeserta = enrollments.filter(en => en.extracurricular_id === ekskulId).length
  const sampleEnroll = enrollments.find(en => en.extracurricular_id === ekskulId)
  const academicYear = sampleEnroll?.academic_year || '2026/2027'
  const semester = sampleEnroll?.semester || 'Genap'
  const periodeLabel = formatPeriodIndo(periodKey)

  const data = [
   ['YAYASAN PENDIDIKAN GLOBAL MADANI'],
   ['SMP GLOBAL MADANI'],
   ['Jl. Kavling Raya, Pramuka Kel. Rajabasa Kec. Rajabasa Kota Bandar Lampung Provinsi Lampung 35144'],
   ['Telf. 0721-8011325/Faks. 0721-8011329 | www.globalmadani.sch.id | e-mail: ypgm.smp@globalmadani.sch.id'],
   [],
   ['DAFTAR HADIR PEMBIMBING EKSTRAKURIKULER'],
   [`SEMESTER ${semester.toUpperCase()} - TAHUN AKADEMIK ${academicYear}`],
   [],
   [`Periode: ${periodeLabel}`],
   [],
   [`Pembimbing : ${coachName}`, '', '', '', `Jenis Ekskul : ${ekskulName}`],
   ['Kelas : 7, 8, 9', '', '', '', `Jumlah Peserta : ${totalPeserta} Siswa`],
   [],
   ['No', 'Hari/Tanggal', 'Waktu', '', 'Materi', 'Tanda Tangan', 'Siswa Tidak Hadir'],
   ['', '', 'Mulai', 'Selesai', '', '', '']
  ]

  sessionsList.forEach((s, index) => {
   const dateObj = new Date(s.session_date)
   const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' })
   const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
   const absentList = attendances
    .filter(a => a.session_id === s.id && a.status !== 'hadir')
    .map(a => a.student?.full_name || '').filter(Boolean).join(', ')
   data.push([
    index + 1, `${dayName}, ${dateStr}`, '15.15', '16.30',
    s.is_special_training ? `[KHUSUS: ${s.event_name}] ${s.topic || '-'}` : (s.topic || '-'),
    '', absentList || 'Nihil'
   ])
  })

  // Add signatures to Excel
  data.push([])
  data.push([])
  const now = new Date()
  const yearStr = now.getFullYear()
  const monthName = monthsIndo[now.getMonth()]
  data.push(['Mengetahui,', '', '', '', `Bandar Lampung,  ${monthName} ${yearStr}`])
  data.push(['Kepala SMP Global Madani', '', '', '', 'Koordinator Ekstrakurikuler'])
  data.push([])
  data.push([])
  data.push([])
  data.push(['Fathul Anwariyah, M.Pd., Gr.', '', '', '', 'Jalian Pebriandy, S.Kom'])
  data.push(['NPGM. 311030987 2 014', '', '', '', 'NPGM. 124090194 1 294'])

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!merges'] = [
   { s: { r:0,c:0 }, e: { r:0,c:6 } }, { s: { r:1,c:0 }, e: { r:1,c:6 } },
   { s: { r:2,c:0 }, e: { r:2,c:6 } }, { s: { r:3,c:0 }, e: { r:3,c:6 } },
   { s: { r:5,c:0 }, e: { r:5,c:6 } }, { s: { r:6,c:0 }, e: { r:6,c:6 } },
   { s: { r:8,c:0 }, e: { r:8,c:6 } },
   { s: { r:10,c:0 }, e: { r:10,c:3 } }, { s: { r:10,c:4 }, e: { r:10,c:6 } },
   { s: { r:11,c:0 }, e: { r:11,c:3 } }, { s: { r:11,c:4 }, e: { r:11,c:6 } },
   { s: { r:13,c:0 }, e: { r:14,c:0 } }, { s: { r:13,c:1 }, e: { r:14,c:1 } },
   { s: { r:13,c:2 }, e: { r:13,c:3 } }, { s: { r:13,c:4 }, e: { r:14,c:4 } },
   { s: { r:13,c:5 }, e: { r:14,c:5 } }, { s: { r:13,c:6 }, e: { r:14,c:6 } }
  ]
  ws['!cols'] = [{ wch:6 },{ wch:22 },{ wch:10 },{ wch:10 },{ wch:32 },{ wch:15 },{ wch:30 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const sanitize = s => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }),
   `daftar_hadir_${sanitize(coachName)}_${sanitize(ekskulName)}_${sanitize(periodKey)}.xlsx`)
 }

 const exportCoachSessionsDetailToPDF = async (rowGroup) => {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const { coachName, ekskulName, periodKey, sessionsList, ekskulId } = rowGroup

  const totalPeserta = enrollments.filter(en => en.extracurricular_id === ekskulId).length
  const sampleEnroll = enrollments.find(en => en.extracurricular_id === ekskulId)
  const academicYear = sampleEnroll?.academic_year || '2026/2027'
  const semester = sampleEnroll?.semester || 'Genap'
  const periodeLabel = formatPeriodIndo(periodKey)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Add Kop Surat
  const startY = await addKopSuratToPDF(doc, 'portrait')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DAFTAR HADIR PEMBIMBING EKSTRAKURIKULER SMP GLOBAL MADANI', 105, startY + 6, { align: 'center' })
  doc.text(`SEMESTER ${semester.toUpperCase()} TAHUN AKADEMIK ${academicYear}`, 105, startY + 11, { align: 'center' })
  doc.text(`Periode: ${periodeLabel}`, 105, startY + 18, { align: 'center' })

  // Metadata Box Table
  const metadataRows = [
   [`Tutor : ${coachName}`, `Jenis Ekskul : ${ekskulName}`],
   [`Kelas : 7, 8, 9`, `Jumlah Peserta : ${totalPeserta}`]
  ]

  autoTable(doc, {
   startY: startY + 23,
   body: metadataRows,
   theme: 'grid',
   styles: { fontSize: 9, cellPadding: 2.5, textColor: [0, 0, 0], fontStyle: 'bold' },
   columnStyles: {
    0: { width: 95 },
    1: { width: 95 }
   },
   tableLineColor: [0, 0, 0],
   tableLineWidth: 0.3,
   margin: { left: 10, right: 10 }
  })

  // Main Sessions Table
  const tableData = sessionsList.map((s, index) => {
   const dateObj = new Date(s.session_date)
   const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' })
   const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
   const absentList = attendances
    .filter(a => a.session_id === s.id && a.status !== 'hadir')
    .map(a => a.student?.full_name || '').filter(Boolean).join(', ')
   return [
    index + 1,
    `${dayName}, ${dateStr}`,
    '7, 8, 9',
    '15.15',
    '16.30',
    s.is_special_training ? `[KHUSUS: ${s.event_name}] ${s.topic || '-'}` : (s.topic || '-'),
    '',
    absentList || 'Nihil'
   ]
  })

  autoTable(doc, {
   startY: doc.lastAutoTable.finalY + 4,
   head: [
    [
     { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
     { content: 'Tanggal', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
     { content: 'Kelas', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
     { content: 'Waktu', colSpan: 2, styles: { halign: 'center' } },
     { content: 'Materi', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
     { content: 'Tanda Tangan', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
     { content: 'Siswa Tidak Hadir', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ],
    ['Mulai', 'Selesai']
   ],
   body: tableData,
   theme: 'grid',
   styles: { fontSize: 8.5, textColor: [0, 0, 0], cellPadding: 2 },
   headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
   columnStyles: {
    0: { width: 8, halign: 'center' },
    1: { width: 25, halign: 'center' },
    2: { width: 12, halign: 'center' },
    3: { width: 13, halign: 'center' },
    4: { width: 13, halign: 'center' },
    5: { width: 62 },
    6: { width: 22 },
    7: { width: 35 }
   },
   tableLineColor: [0, 0, 0],
   tableLineWidth: 0.3,
   margin: { left: 10, right: 10 }
  })

  // Signatures
  const finalY = doc.lastAutoTable.finalY + 12
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const now = new Date()
  const yearStr = now.getFullYear()
  const monthName = monthsIndo[now.getMonth()]

  doc.text('Mengetahui,', 25, finalY)
  doc.text('Kepala SMP Global Madani', 25, finalY + 4)

  doc.text(`Bandar Lampung,  ${monthName} ${yearStr}`, 130, finalY)
  doc.text('Koordinator Ekstrakurikuler', 130, finalY + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Fathul Anwariyah, M.Pd., Gr.', 25, finalY + 28)
  doc.text('Jalian Pebriandy, S.Kom', 130, finalY + 28)

  doc.setFont('helvetica', 'normal')
  doc.text('NPGM. 311030987 2 014', 25, finalY + 32)
  doc.text('NPGM. 124090194 1 294', 130, finalY + 32)

  const sanitize = s => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  doc.save(`laporan_absensi_pelatih_${sanitize(coachName)}_${sanitize(ekskulName)}_${sanitize(periodKey)}.pdf`)
 }

 const exportCoachSessionsFrequencyToPDF = async () => {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const targetPeriod = selectedMonth || availablePeriods[0]
  if (!targetPeriod) {
   alert("Tidak ada periode absensi pelatih yang tersedia.")
   return
  }

  const parts = targetPeriod.split('_')
  let periodTitle = ''
  if (parts.length === 2) {
   const [s, e] = parts
   const [sy, sm] = s.split('-')
   const [ey, em] = e.split('-')
   const startM = monthsIndo[parseInt(sm, 10) - 1].toUpperCase()
   const endM = monthsIndo[parseInt(em, 10) - 1].toUpperCase()
   if (startM === endM) {
    periodTitle = `BULAN ${startM} TAHUN ${ey}`
   } else {
    periodTitle = `BULAN ${startM} – ${endM} TAHUN ${ey}`
   }
  } else {
   const [year, month] = targetPeriod.split('-')
   const mName = monthsIndo[parseInt(month, 10) - 1].toUpperCase()
   periodTitle = `BULAN ${mName} TAHUN ${year}`
  }

  // Grouping and filtering sessions for targetPeriod
  const groups = {}
  sessions.forEach(s => {
   if (!s.session_date) return
   const periodKey = getSessionPeriodKey(s.session_date)
   if (periodKey !== targetPeriod) return

   const coaches = getSessionCoaches(s)
   const ekskul = s.extracurricular || { id: 'unknown', name: 'Ekskul Tidak Diketahui' }
   coaches.forEach(coach => {
    const key = `${coach.id}_${ekskul.id}`
    if (!groups[key]) {
     groups[key] = {
      coachName: coach.full_name,
      ekskulName: ekskul.name,
      sessionsCount: 0
     }
    }
    groups[key].sessionsCount++
   })
  })

  const reportRows = Object.values(groups).sort((a, b) => a.coachName.localeCompare(b.coachName))
  if (reportRows.length === 0) {
   alert("Tidak ada data kehadiran pelatih pada periode ini.")
   return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Add Kop Surat
  const startY = await addKopSuratToPDF(doc, 'portrait')

  // Titles
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('REKAP KEHADIRAN PELATIH EKSTRAKURIKULER', 105, startY + 6, { align: 'center' })
  doc.text('SMP GLOBAL MADANI', 105, startY + 11, { align: 'center' })
  doc.text(periodTitle, 105, startY + 16, { align: 'center' })

  // Prepare table data
  let totalSessions = 0
  const tableData = reportRows.map((row, index) => {
   totalSessions += row.sessionsCount
   return [
    index + 1,
    row.coachName,
    row.ekskulName,
    row.sessionsCount
   ]
  })

  // Add TOTAL row at the bottom
  tableData.push([
   { content: 'TOTAL', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
   { content: totalSessions, styles: { halign: 'center', fontStyle: 'bold' } }
  ])

  autoTable(doc, {
   startY: startY + 22,
   head: [
    [
     { content: 'No.', styles: { halign: 'center', valign: 'middle' } },
     { content: 'PEMBINA', styles: { halign: 'center', valign: 'middle' } },
     { content: 'EKSTRAKURIKULER', styles: { halign: 'center', valign: 'middle' } },
     { content: 'FREKUENSI', styles: { halign: 'center', valign: 'middle' } }
    ]
   ],
   body: tableData,
   theme: 'grid',
   styles: { fontSize: 9.5, textColor: [0, 0, 0], cellPadding: 3 },
   headStyles: { fillColor: [181, 172, 137], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
   columnStyles: {
    0: { width: 12, halign: 'center' },
    1: { width: 90 },
    2: { width: 63 },
    3: { width: 25, halign: 'center' }
   },
   tableLineColor: [0, 0, 0],
   tableLineWidth: 0.3,
   margin: { left: 10, right: 10 }
  })

  // Signatures
  const finalY = doc.lastAutoTable.finalY + 12
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const now = new Date()
  const yearStr = now.getFullYear()
  const monthName = monthsIndo[now.getMonth()]

  doc.text('Mengetahui,', 25, finalY)
  doc.text('Kepala SMP Global Madani', 25, finalY + 5)

  doc.text(`Bandar Lampung, ${now.getDate()} ${monthName} ${yearStr}`, 125, finalY)
  doc.text('Koordinator Ekstrakurikuler', 125, finalY + 5)

  doc.setFont('helvetica', 'bold')
  doc.text('Fathul Anwariyah, M.Pd., Gr.', 25, finalY + 30)
  doc.text('Jalian Pebriandy, S.Kom', 125, finalY + 30)

  doc.setFont('helvetica', 'normal')
  doc.text('NPGM. 311030987 2 014', 25, finalY + 34)
  doc.text('NPGM. 124090194 1 294', 125, finalY + 34)

  const sanitize = s => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  doc.save(`rekap_frekuensi_kehadiran_pelatih_${sanitize(targetPeriod)}.pdf`)
 }

 // ─── Loading State ─────────────────────────────────────────────────────────

 if (loading) {
  return (
   <div className="flex flex-col items-center justify-center py-32 space-y-4">
    <Loader2 className="w-10 h-10 text-pixel-blue animate-spin" />
    <p className="text-pixel-lavender font-retro text-lg">Memuat formulir rekap & laporan...</p>
   </div>
  )
 }

 // ─── Shared Filter UI ──────────────────────────────────────────────────────

 const tabs = [
  { id: 'overview', label: 'Ringkasan Ekskul' },
  { id: 'fillTracking', label: 'Tracking Pengisian' },
  { id: 'warnings', label: `⚠️ Siswa Bermasalah${warningRows.length > 0 ? ` (${warningRows.length})` : ''}` },
  { id: 'attendance', label: 'Laporan Absensi Siswa' },
  { id: 'grades', label: 'Laporan Nilai Siswa' },
  { id: 'coachSessions', label: 'Kehadiran Pelatih' },
  { id: 'activity', label: '📈 Keaktifan Ekskul' },
 ]

 const resetFilters = (tabId) => {
  setSearchQuery(''); setSelectedEkskul(''); setSelectedSemester(''); setSelectedAcademicYear('')
  setSelectedCoach(''); setSelectedMonth(''); setWarningTypeFilter(''); setWarningLevelFilter('')
  setActiveTab(tabId)
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
      Rekapitulasi &amp; Laporan Sekolah
     </h1>
     <p className="text-pixel-peach max-w-2xl text-sm md:text-base">
      Laporan kehadiran siswa, keaktifan ekskul, sesi pelatih, dan peringatan otomatis untuk siswa yang perlu perhatian.
     </p>
    </div>
   </div>

   {errorMsg && (
    <div className="bg-pixel-red/10 border border-rose-200 text-rose-700 p-4 rounded-none flex items-center gap-3 shadow-pixel-sm">
     <AlertCircle className="w-5 h-5 text-pixel-red shrink-0" />
     <p className="font-retro text-lg">{errorMsg}</p>
    </div>
   )}

   {/* Stats Cards */}
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden hover:brightness-110 transition-shadow">
     <CardContent className="p-5 flex items-center justify-between">
      <div className="space-y-1">
       <p className="font-retro text-base text-pixel-lavender">Total Keikutsertaan</p>
       <h3 className="text-3xl font-extrabold text-pixel-white">{computedStats.totalEnrolled}</h3>
       <p className="text-xs text-pixel-lavender">Siswa aktif terdaftar</p>
      </div>
      <div className="p-3 rounded-none bg-pixel-blue/10 text-pixel-blue"><Users className="w-6 h-6" /></div>
     </CardContent>
    </Card>

    <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden hover:brightness-110 transition-shadow">
     <CardContent className="p-5 flex items-center justify-between">
      <div className="space-y-1">
       <p className="font-retro text-base text-pixel-lavender">Rata-rata Kehadiran</p>
       <h3 className="text-3xl font-extrabold text-cyan-500">{computedStats.attendanceRate}%</h3>
       <p className="text-xs text-pixel-lavender">Seluruh sesi ekskul</p>
      </div>
      <div className="p-3 rounded-none bg-cyan-50 text-cyan-600"><Activity className="w-6 h-6" /></div>
     </CardContent>
    </Card>

    <Card className={`border-pixel-gray/30 shadow-pixel-sm overflow-hidden hover:brightness-110 transition-shadow ${teguranCount > 0 ? 'bg-rose-50/5 border-rose-500/30' : 'bg-pixel-panel'}`}>
     <CardContent className="p-5 flex items-center justify-between">
      <div className="space-y-1">
       <p className="font-retro text-base text-pixel-lavender">Siswa Bermasalah</p>
       <h3 className={`text-3xl font-extrabold ${teguranCount > 0 ? 'text-pixel-red' : warningCount > 0 ? 'text-pixel-orange' : 'text-pixel-green'}`}>
        {warningCount}
       </h3>
       <p className="text-xs text-pixel-lavender">{teguranCount} teguran, {warningCount - teguranCount} peringatan</p>
      </div>
      <div className={`p-3 rounded-none ${teguranCount > 0 ? 'bg-pixel-red/10 text-pixel-red' : 'bg-amber-50 text-amber-600'}`}>
       <ShieldAlert className="w-6 h-6" />
      </div>
     </CardContent>
    </Card>

    <Card className={`border-pixel-gray/30 shadow-pixel-sm overflow-hidden hover:brightness-110 transition-shadow ${stagnanCount > 0 ? 'bg-amber-50/5' : 'bg-pixel-panel'}`}>
     <CardContent className="p-5 flex items-center justify-between">
      <div className="space-y-1">
       <p className="font-retro text-base text-pixel-lavender">Ekskul Stagnan/Turun</p>
       <h3 className={`text-3xl font-extrabold ${stagnanCount > 0 ? 'text-pixel-orange' : 'text-pixel-green'}`}>{stagnanCount}</h3>
       <p className="text-xs text-pixel-lavender">Sesi menurun / belum mulai</p>
      </div>
      <div className={`p-3 rounded-none ${stagnanCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-pixel-green/10 text-pixel-green'}`}>
       <TrendingDown className="w-6 h-6" />
      </div>
     </CardContent>
    </Card>
   </div>

   {/* Visual Chart */}
   <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
    <CardHeader className="p-6 pb-0">
     <CardTitle className="font-pixel text-[10px] pixel-text-shadow leading-loose text-pixel-white">
      {activeTab === 'coachSessions' ? 'Sesi Latihan per Pelatih' :
       activeTab === 'activity' ? 'Tren Keaktifan Sesi per Ekskul (6 Bulan Terakhir)' :
       'Perbandingan Nilai & Absensi Antar Ekskul'}
     </CardTitle>
     <CardDescription>
      {activeTab === 'coachSessions' ? 'Grafik jumlah total sesi latihan yang telah dilaksanakan oleh masing-masing pelatih' :
       activeTab === 'activity' ? 'Grafik tren jumlah sesi per ekskul selama 6 bulan terakhir' :
       'Grafik perbandingan rata-rata nilai akademik dan persentase kehadiran siswa per cabang ekskul'}
     </CardDescription>
    </CardHeader>
    <CardContent className="p-6">
     <div className="w-full h-[300px]">
      {activeTab === 'coachSessions' ? (
       coachChartData.length === 0 ? (
        <div className="h-full flex items-center justify-center text-pixel-lavender text-sm">Belum ada data sesi pelatih.</div>
       ) : (
        <ResponsiveContainer width="100%" height="100%">
         <BarChart data={coachChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
          <RechartsTooltip />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
          <Bar dataKey="Jumlah Sesi" fill="#6366f1" radius={[4,4,0,0]} />
         </BarChart>
        </ResponsiveContainer>
       )
      ) : activeTab === 'activity' ? (
       ekskulActivityTrend.length === 0 ? (
        <div className="h-full flex items-center justify-center text-pixel-lavender text-sm">Belum ada data tren sesi.</div>
       ) : (
        <ResponsiveContainer width="100%" height="100%">
         <LineChart data={ekskulActivityTrend} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="monthLabel" tick={{ fill: '#64748b', fontSize: 10 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
          <RechartsTooltip />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          {extracurriculars.slice(0,6).map((e, i) => (
           <Line key={e.id} type="monotone" dataKey={e.name}
            stroke={['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6'][i]}
            strokeWidth={2} dot={{ r: 3 }} />
          ))}
         </LineChart>
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
          <Bar dataKey="Rata-rata Nilai" fill="#6366f1" radius={[4,4,0,0]} />
          <Bar dataKey="Persentase Absensi" fill="#06b6d4" radius={[4,4,0,0]} />
         </BarChart>
        </ResponsiveContainer>
       )
      )}
     </div>
    </CardContent>
   </Card>

   {/* Tabs */}
   <div className="space-y-6">
    <div className="flex border-b border-pixel-gray gap-0 overflow-x-auto pb-px scrollbar-none">
     {tabs.map(tab => (
      <button
       key={tab.id}
       onClick={() => resetFilters(tab.id)}
       className={`px-4 pb-3 font-retro text-base border-b-2 whitespace-nowrap transition-colors ${
        activeTab === tab.id ? 'border-indigo-600 text-pixel-blue' : 'border-transparent text-pixel-lavender hover:text-pixel-white'
       } ${tab.id === 'warnings' && teguranCount > 0 ? 'text-pixel-red!' : ''}`}
      >
       {tab.label}
      </button>
     ))}
    </div>

    {/* Filter Bar */}
    <div className="bg-pixel-navy border border-pixel-gray/30 rounded-none p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
     <div className="flex flex-wrap items-center gap-3 flex-1">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
       <Search className="w-4 h-4 text-pixel-lavender absolute left-3 top-3" />
       <input
        type="text"
        placeholder={
         activeTab === 'overview' ? "Cari ekskul atau pelatih..." :
         activeTab === 'fillTracking' ? "Cari ekskul atau pelatih..." :
         activeTab === 'coachSessions' ? "Cari pelatih, ekskul atau materi..." :
         activeTab === 'activity' ? "Cari nama ekskul..." :
         "Cari nama siswa atau NIS..."
        }
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full text-sm pl-9 pr-4 py-2 bg-pixel-panel border border-pixel-gray rounded-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
       />
      </div>

      {activeTab === 'fillTracking' && (
       <>
        <div className="flex items-center gap-2">
         <span className="text-xs text-pixel-lavender">Mulai:</span>
         <input type="date" value={trackingStartDate} onChange={e => setTrackingStartDate(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="flex items-center gap-2">
         <span className="text-xs text-pixel-lavender">Selesai:</span>
         <input type="date" value={trackingEndDate} onChange={e => setTrackingEndDate(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
       </>
      )}

      {(activeTab === 'attendance' || activeTab === 'grades') && (
       <>
        <select value={selectedEkskul} onChange={e => setSelectedEkskul(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Ekskul</option>
         {extracurriculars.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Semester</option>
         {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        <select value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Tahun Ajaran</option>
         {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
       </>
      )}

      {activeTab === 'coachSessions' && (
       <>
        <select value={selectedCoach} onChange={e => setSelectedCoach(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Pelatih</option>
         {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select value={selectedEkskul} onChange={e => setSelectedEkskul(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Ekskul</option>
         {extracurriculars.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Periode</option>
         {availablePeriods.map(p => <option key={p} value={p}>{formatPeriodShortIndo(p)}</option>)}
        </select>
       </>
      )}

      {activeTab === 'warnings' && (
       <>
        <select value={selectedEkskul} onChange={e => setSelectedEkskul(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Ekskul</option>
         {extracurriculars.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={warningTypeFilter} onChange={e => setWarningTypeFilter(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Wajib & Pilihan</option>
         <option value="wajib">Ekskul Wajib</option>
         <option value="pilihan">Ekskul Pilihan</option>
        </select>
        <select value={warningLevelFilter} onChange={e => setWarningLevelFilter(e.target.value)} className="text-sm border border-pixel-gray rounded-none px-3 py-2 bg-pixel-panel text-pixel-peach focus:outline-none focus:ring-2 focus:ring-indigo-300">
         <option value="">Semua Level</option>
         <option value="TEGURAN">Teguran</option>
         <option value="PERINGATAN">Peringatan</option>
        </select>
       </>
      )}
     </div>

     {/* Export Buttons */}
     <div className="flex gap-2 shrink-0">
      {activeTab === 'warnings' && (
       <Button
        onClick={() => exportWarningsToPDF(warningRows)}
        disabled={warningRows.length === 0}
        variant="outline"
        className="border-rose-300 text-pixel-red hover:bg-pixel-red/10 flex items-center gap-2"
       >
        <Download className="w-4 h-4" />
        PDF
       </Button>
      )}
      {activeTab === 'coachSessions' && (
       <Button
        onClick={exportCoachSessionsFrequencyToPDF}
        disabled={coachSessionReportRows.length === 0}
        variant="outline"
        className="border-orange-300 text-pixel-peach hover:bg-pixel-peach/10 flex items-center gap-2"
       >
        <Download className="w-4 h-4" />
        PDF Frekuensi
       </Button>
      )}
      <Button
       onClick={
        activeTab === 'overview' ? exportEkskulToExcel :
        activeTab === 'fillTracking' ? exportTrackingToExcel :
        activeTab === 'attendance' ? exportAttendanceToExcel :
        activeTab === 'grades' ? exportGradesToExcel :
        activeTab === 'coachSessions' ? exportCoachSessionsToExcel :
        activeTab === 'warnings' ? exportWarningsToExcel :
        exportActivityToExcel
       }
       disabled={
        (activeTab === 'overview' && filteredEkskulSummaries.length === 0) ||
        (activeTab === 'fillTracking' && fillTrackingRows.length === 0) ||
        (activeTab === 'attendance' && attendanceReportRows.length === 0) ||
        (activeTab === 'grades' && gradeReportRows.length === 0) ||
        (activeTab === 'coachSessions' && coachSessionReportRows.length === 0) ||
        (activeTab === 'warnings' && warningRows.length === 0) ||
        (activeTab === 'activity' && ekskulActivityRanking.length === 0)
       }
       className="bg-indigo-600 hover:bg-indigo-700 text-pixel-white shadow-pixel-sm flex items-center gap-2 w-full md:w-auto"
      >
       <Download className="w-4 h-4" />
       Ekspor Excel
      </Button>
     </div>
    </div>

    {/* ═══ TAB: Ringkasan Ekskul ═══════════════════════════════════════════ */}
    {activeTab === 'overview' && (
     <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
      <div className="overflow-x-auto">
       <table className="w-full text-left border-collapse text-sm">
        <thead>
         <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
          <th className="p-4 pl-6">Ekstrakurikuler</th>
          <th className="p-4">Jenis</th>
          <th className="p-4">Pelatih</th>
          <th className="p-4">Jadwal</th>
          <th className="p-4 text-center">Siswa Aktif</th>
          <th className="p-4 text-center">Sesi</th>
          <th className="p-4 text-center">Absensi</th>
          <th className="p-4 text-center">Nilai</th>
          <th className="p-4 text-center pr-6">Status</th>
         </tr>
        </thead>
        <tbody className="divide-y-2 divide-pixel-gray/30">
         {filteredEkskulSummaries.length === 0 ? (
          <tr><td colSpan="9" className="p-8 text-center text-pixel-lavender">Tidak ada ekskul yang cocok.</td></tr>
         ) : filteredEkskulSummaries.map(e => (
          <tr key={e.id} className="hover:bg-pixel-navy/30">
           <td className="p-4 pl-6 font-semibold text-pixel-white">{e.name}</td>
           <td className="p-4">
            {e.isMandatory ? (
             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs font-bold bg-indigo-900/30 text-indigo-300 border border-indigo-500/30">
              WAJIB {e.mandatoryClass ? `Kls ${e.mandatoryClass}` : ''}
             </span>
            ) : (
             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs font-bold bg-pixel-panel text-pixel-lavender border border-pixel-gray/30">
              Pilihan
             </span>
            )}
           </td>
           <td className="p-4 text-pixel-peach text-sm">{e.coachName}</td>
           <td className="p-4 text-pixel-lavender text-sm">{e.schedule}</td>
           <td className="p-4 text-center font-semibold text-pixel-peach">{e.activeSiswa}</td>
           <td className="p-4 text-center text-pixel-lavender">{e.sessionsCount}</td>
           <td className="p-4 text-center">
            <span className={`inline-block px-2.5 py-0.5 rounded-none font-bold text-xs ${
             e.attendanceRate >= 80 ? 'bg-pixel-green/10 text-pixel-green' :
             e.attendanceRate >= 60 ? 'bg-amber-50 text-pixel-orange' : 'bg-pixel-red/10 text-pixel-red'
            }`}>{e.attendanceRate}%</span>
           </td>
           <td className="p-4 text-center font-bold text-pixel-blue">{e.avgGrade || '-'}</td>
           <td className="p-4 text-center pr-6">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-2xs font-bold uppercase ${
             e.isActive ? 'bg-pixel-green/10 text-pixel-green' : 'bg-slate-100 text-pixel-lavender'
            }`}>{e.isActive ? 'Aktif' : 'Non-aktif'}</span>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     </div>
    )}

     {/* ═══ TAB: Tracking Pengisian Sesi & Absensi ═══════════════════════════ */}
     {activeTab === 'fillTracking' && (
      <div className="space-y-6">
       {/* Stats Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
         <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
           <p className="font-retro text-[10px] text-pixel-lavender uppercase tracking-wider">Total Ekskul Aktif</p>
           <h3 className="text-2xl font-extrabold text-pixel-white">{trackingStats.total}</h3>
          </div>
          <div className="p-2.5 bg-pixel-navy rounded-none text-pixel-blue">
           <Users className="w-5 h-5" />
          </div>
         </CardContent>
        </Card>

        <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
         <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
           <p className="font-retro text-[10px] text-pixel-lavender uppercase tracking-wider">Belum Buat Sesi</p>
           <h3 className="text-2xl font-extrabold text-pixel-red">{trackingStats.noSession}</h3>
          </div>
          <div className="p-2.5 bg-pixel-red/10 rounded-none text-pixel-red">
           <X className="w-5 h-5" />
          </div>
         </CardContent>
        </Card>

        <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
         <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
           <p className="font-retro text-[10px] text-pixel-lavender uppercase tracking-wider">Absensi Belum Diisi</p>
           <h3 className="text-2xl font-extrabold text-pixel-orange">{trackingStats.unfilledAttendance}</h3>
          </div>
          <div className="p-2.5 bg-amber-950/20 rounded-none text-pixel-orange">
           <AlertCircle className="w-5 h-5" />
          </div>
         </CardContent>
        </Card>

        <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
         <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
           <p className="font-retro text-[10px] text-pixel-lavender uppercase tracking-wider">Lengkap</p>
           <h3 className="text-2xl font-extrabold text-pixel-green">{trackingStats.completed}</h3>
          </div>
          <div className="p-2.5 bg-pixel-green/10 rounded-none text-pixel-green">
           <CheckCircle className="w-5 h-5" />
          </div>
         </CardContent>
        </Card>
       </div>

       {/* Broadcast WhatsApp & Actions */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-pixel-navy/50 p-4 border border-pixel-gray/30">
        <div className="space-y-1">
         <h4 className="font-bold text-sm text-pixel-white">Laporan Pengingat Mingguan</h4>
         <p className="text-xs text-pixel-lavender">Salin format laporan pengingat untuk seluruh pelatih yang belum melengkapi data.</p>
        </div>
        <Button onClick={copyAllToWhatsApp} className="bg-pixel-green hover:bg-pixel-green/90 text-pixel-navy font-bold shadow-pixel-sm flex items-center gap-2">
         <ClipboardCheck className="w-4 h-4" />
         Salin Laporan WA (Semua)
        </Button>
       </div>

       {/* Table */}
       <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
        <div className="overflow-x-auto">
         <table className="w-full text-left border-collapse text-sm">
          <thead>
           <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
            <th className="p-4 pl-6">Ekstrakurikuler</th>
            <th className="p-4">Pelatih</th>
            <th className="p-4 text-center">Jumlah Sesi</th>
            <th className="p-4">Detail Sesi di Periode Ini</th>
            <th className="p-4 text-center">Status</th>
            <th className="p-4 text-center pr-6">Aksi</th>
           </tr>
          </thead>
          <tbody className="divide-y-2 divide-pixel-gray/30">
           {fillTrackingRows.length === 0 ? (
            <tr><td colSpan="6" className="p-8 text-center text-pixel-lavender">Tidak ada ekskul yang cocok.</td></tr>
           ) : fillTrackingRows.map(r => (
            <tr key={r.id} className="hover:bg-pixel-navy/30">
             <td className="p-4 pl-6 font-semibold text-pixel-white">{r.name}</td>
             <td className="p-4 text-pixel-peach text-sm">{r.coachName}</td>
             <td className="p-4 text-center font-bold text-pixel-white">{r.sessionsCount}</td>
             <td className="p-4 text-sm text-pixel-lavender">
              {r.sessionsCount === 0 ? (
               <span className="italic text-pixel-lavender/60">Tidak ada pertemuan</span>
              ) : (
               <div className="space-y-1">
                {r.sessionDetails.map((s, idx) => (
                 <div key={s.id || idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-pixel-navy px-1.5 py-0.5 text-pixel-peach">{formatDateIndo(s.date)}</span>
                  <span className="text-pixel-white text-xs truncate max-w-[200px]" title={s.topic}>{s.topic}</span>
                  <span className={`inline-block w-2 h-2 rounded-full ${s.isFilled ? 'bg-pixel-green' : 'bg-pixel-red animate-pulse'}`} title={s.isFilled ? 'Absensi lengkap' : 'Absensi belum diisi'} />
                 </div>
                ))}
               </div>
              )}
             </td>
             <td className="p-4 text-center">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-[10px] font-bold uppercase ${
               r.status === 'no_session' ? 'bg-pixel-red/10 text-pixel-red border border-pixel-red/30' :
               r.status === 'unfilled_attendance' ? 'bg-amber-900/30 text-pixel-orange border border-pixel-orange/30' :
               'bg-pixel-green/10 text-pixel-green border border-pixel-green/30'
              }`}>
               {r.status === 'no_session' ? 'Belum Buat Sesi' :
                r.status === 'unfilled_attendance' ? 'Belum Absen' : 'Lengkap'}
              </span>
             </td>
             <td className="p-4 text-center pr-6 text-2xs">
              {r.status !== 'completed' ? (
               <Button size="xs" variant="outline" onClick={() => copySingleToWhatsApp(r)} className="border-pixel-gray hover:bg-pixel-navy/50 text-pixel-peach text-2xs">
                Salin Pengingat
               </Button>
              ) : (
               <span className="text-pixel-green font-semibold">✓ Selesai</span>
              )}
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       </div>
      </div>
     )}

    {/* ═══ TAB: Siswa Bermasalah ════════════════════════════════════════════ */}
    {activeTab === 'warnings' && (
     <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
       <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/30 border border-rose-500/30 rounded-none text-xs text-pixel-red font-semibold">
        <ShieldAlert className="w-3.5 h-3.5" />
        TEGURAN = Ekskul wajib: alpha ≥3 atau kehadiran &lt;70% | Pilihan: alpha ≥5 berturut atau kehadiran &lt;55%
       </div>
       <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border border-amber-500/30 rounded-none text-xs text-pixel-orange font-semibold">
        <AlertTriangle className="w-3.5 h-3.5" />
        PERINGATAN = Ekskul wajib: alpha ≥1 atau kehadiran &lt;80% | Pilihan: alpha ≥3 berturut atau kehadiran &lt;70%
       </div>
      </div>

      <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
       <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
         <thead>
          <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
           <th className="p-4 pl-6">Nama Siswa</th>
           <th className="p-4">NIS</th>
           <th className="p-4 text-center">Kelas</th>
           <th className="p-4">Ekstrakurikuler</th>
           <th className="p-4 text-center">Jenis</th>
           <th className="p-4 text-center">Hadir</th>
           <th className="p-4 text-center">Alpha</th>
           <th className="p-4 text-center">Alpha Turut</th>
           <th className="p-4 text-center">% Hadir</th>
           <th className="p-4 text-center pr-6">Status</th>
          </tr>
         </thead>
         <tbody className="divide-y divide-pixel-gray/20">
          {warningRows.length === 0 ? (
           <tr>
            <td colSpan="10" className="p-12 text-center space-y-2">
             <CheckCircle className="w-10 h-10 text-pixel-green mx-auto" />
             <p className="text-pixel-lavender">Tidak ada siswa bermasalah dengan filter yang dipilih. 🎉</p>
            </td>
           </tr>
          ) : warningRows.map((r, i) => (
           <tr key={i} className={`hover:bg-pixel-navy/30 ${
            r.warningLevel === 'TEGURAN' ? 'bg-rose-950/10 border-l-2 border-l-rose-500' :
            'bg-amber-950/5 border-l-2 border-l-amber-500'
           }`}>
            <td className="p-4 pl-6">
             <div>
              <p className="font-semibold text-pixel-white">{r.studentName}</p>
              {r.warningReasons.map((reason, ri) => (
               <p key={ri} className="text-xs text-pixel-lavender mt-0.5">• {reason}</p>
              ))}
             </div>
            </td>
            <td className="p-4 font-mono text-pixel-lavender text-xs">{r.nis}</td>
            <td className="p-4 text-center text-pixel-peach font-semibold">{r.class}</td>
            <td className="p-4 text-pixel-peach font-medium">{r.ekskulName}</td>
            <td className="p-4 text-center">
             {r.isMandatory ? (
              <span className="px-2 py-0.5 text-xs font-bold bg-indigo-900/30 text-indigo-300 border border-indigo-500/30">WAJIB</span>
             ) : (
              <span className="px-2 py-0.5 text-xs text-pixel-lavender border border-pixel-gray/30">Pilihan</span>
             )}
            </td>
            <td className="p-4 text-center font-bold text-pixel-green">{r.hadir}</td>
            <td className="p-4 text-center font-bold text-pixel-red">{r.alpha}</td>
            <td className="p-4 text-center">
             <span className={`font-mono font-bold text-sm ${r.consecutiveAlpha >= 3 ? 'text-pixel-red' : 'text-pixel-lavender'}`}>
              {r.consecutiveAlpha}×
             </span>
            </td>
            <td className="p-4 text-center">
             <div className="flex items-center gap-2 justify-center">
              <div className="w-12 h-2 bg-slate-700 rounded-none overflow-hidden">
               <div className={`h-full ${r.percentage >= 70 ? 'bg-amber-500' : 'bg-pixel-red'}`}
                style={{ width: `${r.percentage}%` }} />
              </div>
              <span className={`font-bold text-xs ${r.percentage < 60 ? 'text-pixel-red' : 'text-pixel-orange'}`}>
               {r.percentage}%
              </span>
             </div>
            </td>
            <td className="p-4 text-center pr-6">
             <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-none font-bold text-xs ${
              r.warningLevel === 'TEGURAN'
               ? 'bg-pixel-red/20 text-pixel-red border border-rose-500/40'
               : 'bg-amber-900/30 text-pixel-orange border border-amber-500/40'
             }`}>
              {r.warningLevel === 'TEGURAN' ? <ShieldAlert className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {r.warningLabel}
             </span>
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      </div>
     </div>
    )}

    {/* ═══ TAB: Laporan Absensi Siswa ══════════════════════════════════════ */}
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
          <tr><td colSpan="9" className="p-8 text-center text-pixel-lavender">Tidak ada laporan kehadiran yang cocok dengan filter.</td></tr>
         ) : attendanceReportRows.map((r, i) => (
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
              <div className={`h-full rounded-none ${r.percentage >= 80 ? 'bg-pixel-green/100' : r.percentage >= 60 ? 'bg-amber-500' : 'bg-pixel-red/100'}`}
               style={{ width: `${r.percentage}%` }} />
             </div>
             <span className="font-bold text-pixel-peach shrink-0 text-xs">{r.percentage}%</span>
            </div>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     </div>
    )}

    {/* ═══ TAB: Laporan Nilai Siswa ═════════════════════════════════════════ */}
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
          <th className="p-4 pr-6 max-w-[200px]">Catatan</th>
         </tr>
        </thead>
        <tbody className="divide-y-2 divide-pixel-gray/30">
         {gradeReportRows.length === 0 ? (
          <tr><td colSpan="10" className="p-8 text-center text-pixel-lavender">Tidak ada laporan nilai yang cocok.</td></tr>
         ) : gradeReportRows.map(r => (
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
            }`}>{r.predikat}</span>
           </td>
           <td className="p-4 text-pixel-lavender italic text-xs pr-6 truncate max-w-[200px]" title={r.notes}>{r.notes}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     </div>
    )}

    {/* ═══ TAB: Kehadiran Pelatih ═══════════════════════════════════════════ */}
    {activeTab === 'coachSessions' && (
     <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
      <div className="overflow-x-auto">
       <table className="w-full text-left border-collapse text-sm">
        <thead>
         <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
          <th className="p-4 pl-6">Nama Pelatih</th>
          <th className="p-4">Email</th>
          <th className="p-4">Ekstrakurikuler</th>
          <th className="p-4 text-center">Periode</th>
          <th className="p-4 text-center">Total Sesi</th>
          <th className="p-4 text-center pr-6">Aksi</th>
         </tr>
        </thead>
        <tbody className="divide-y-2 divide-pixel-gray/30">
         {coachSessionReportRows.length === 0 ? (
          <tr><td colSpan="6" className="p-8 text-center text-pixel-lavender">Tidak ada data rekap sesi pelatih.</td></tr>
         ) : coachSessionReportRows.map((r, idx) => (
          <tr key={idx} className="hover:bg-pixel-navy/30">
           <td className="p-4 pl-6 font-semibold text-pixel-white">{r.coachName}</td>
           <td className="p-4 text-pixel-lavender">{r.coachEmail}</td>
           <td className="p-4 font-medium text-pixel-peach">{r.ekskulName}</td>
           <td className="p-4 text-center text-pixel-peach font-medium">{formatPeriodShortIndo(r.periodKey)}</td>
           <td className="p-4 text-center pr-6 font-bold text-pixel-blue">{r.sessionsCount} Sesi</td>
           <td className="p-4 text-center pr-6 space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSessionGroup(r)}
             className="text-pixel-blue hover:text-indigo-700 hover:bg-pixel-blue/10 font-semibold text-xs">
             Lihat Detail
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCoachSessionsDetailToExcel(r)}
             className="text-pixel-green hover:text-pixel-green hover:bg-pixel-green/10 border-emerald-200 hover:border-emerald-300 font-semibold text-xs gap-1">
             <Download className="w-3.5 h-3.5" />
             Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCoachSessionsDetailToPDF(r)}
             className="text-pixel-peach hover:text-pixel-peach hover:bg-pixel-peach/10 border-orange-200 hover:border-orange-300 font-semibold text-xs gap-1">
             <Download className="w-3.5 h-3.5" />
             PDF
            </Button>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     </div>
    )}

    {/* ═══ TAB: Keaktifan Ekskul ═══════════════════════════════════════════ */}
    {activeTab === 'activity' && (
     <div className="space-y-6">
      <div className="bg-pixel-panel border border-pixel-gray/30 rounded-none shadow-pixel-sm overflow-hidden">
       <div className="p-4 bg-pixel-navy/50 border-b border-pixel-gray/30">
        <h3 className="font-bold text-pixel-white flex items-center gap-2">
         <BarChart2 className="w-4 h-4 text-pixel-blue" />
         Ranking Keaktifan Ekstrakurikuler
        </h3>
        <p className="text-xs text-pixel-lavender mt-1">Berdasarkan total sesi yang telah terlaksana. Tren dihitung dari perbandingan 3 bulan terakhir vs 3 bulan sebelumnya.</p>
       </div>
       <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
         <thead>
          <tr className="bg-pixel-navy/75 border-b border-pixel-gray/30 text-pixel-lavender font-semibold">
           <th className="p-4 pl-6 text-center w-12">#</th>
           <th className="p-4">Ekstrakurikuler</th>
           <th className="p-4">Pelatih</th>
           <th className="p-4 text-center">Total Sesi</th>
           <th className="p-4 text-center">3 Bln Terakhir</th>
           <th className="p-4 text-center">3 Bln Sebelumnya</th>
           <th className="p-4 text-center">Tren</th>
           <th className="p-4 text-center">Rata-rata Kehadiran</th>
           <th className="p-4 text-center pr-6">Status</th>
          </tr>
         </thead>
         <tbody className="divide-y divide-pixel-gray/20">
          {ekskulActivityRanking.length === 0 ? (
           <tr><td colSpan="9" className="p-8 text-center text-pixel-lavender">Tidak ada data keaktifan.</td></tr>
          ) : ekskulActivityRanking.map((e, i) => (
           <tr key={e.id} className="hover:bg-pixel-navy/30">
            <td className="p-4 pl-6 text-center font-bold text-pixel-lavender">
             {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
            </td>
            <td className="p-4 font-semibold text-pixel-white">{e.name}</td>
            <td className="p-4 text-pixel-peach text-sm">{e.coachName}</td>
            <td className="p-4 text-center font-bold text-pixel-blue">{e.totalSessions}</td>
            <td className="p-4 text-center font-semibold text-pixel-white">{e.recentCount}</td>
            <td className="p-4 text-center text-pixel-lavender">{e.prevCount}</td>
            <td className="p-4 text-center">
             <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs font-bold ${
              e.trend === 'Meningkat' ? 'bg-pixel-green/10 text-pixel-green' :
              e.trend === 'Menurun' ? 'bg-pixel-red/10 text-pixel-red' :
              'bg-pixel-panel text-pixel-lavender border border-pixel-gray/30'
             }`}>
              {e.trend === 'Meningkat' ? <TrendingUp className="w-3 h-3" /> :
               e.trend === 'Menurun' ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {e.trend}
             </span>
            </td>
            <td className="p-4 text-center">
             <span className={`font-bold text-sm ${
              e.avgAttendance >= 80 ? 'text-pixel-green' :
              e.avgAttendance >= 60 ? 'text-pixel-orange' : 'text-pixel-red'
             }`}>{e.avgAttendance}%</span>
            </td>
            <td className="p-4 text-center pr-6">
             <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-2xs font-bold uppercase ${
              e.isActive ? 'bg-pixel-green/10 text-pixel-green' : 'bg-slate-100 text-pixel-lavender'
             }`}>{e.isActive ? 'Aktif' : 'Non-aktif'}</span>
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      </div>
     </div>
    )}
   </div>

   {/* ═══ Modal: Detail Sesi Pelatih ════════════════════════════════════════ */}
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
        Riwayat Sesi untuk Periode {formatPeriodIndo(selectedSessionGroup.periodKey)}
       </p>
       <div className="space-y-3">
        {selectedSessionGroup.sessionsList.map((session, sIdx) => (
         <div key={session.id || sIdx} className="bg-pixel-navy border border-pixel-gray/30 p-4 rounded-none space-y-2">
          <div className="flex justify-between items-center">
           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-pixel-blue/10 text-indigo-700 font-retro text-base font-mono">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(session.session_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </span>
          </div>
          <div>
           <p className="text-sm font-bold text-pixel-white">{session.topic || 'Sesi Umum'}</p>
           <p className="text-xs text-pixel-lavender mt-1 whitespace-pre-line">{session.notes || 'Tidak ada catatan.'}</p>
          </div>
         </div>
        ))}
       </div>
      </div>

      <div className="px-6 py-4 border-t border-pixel-gray/30 bg-pixel-navy flex justify-end gap-2">
       <Button onClick={() => exportCoachSessionsDetailToExcel(selectedSessionGroup)}
        className="bg-emerald-600 hover:bg-emerald-700 text-pixel-white shadow-pixel-sm flex items-center gap-1.5">
        <Download className="w-4 h-4" />
        Unduh Form Excel
       </Button>
       <Button onClick={() => exportCoachSessionsDetailToPDF(selectedSessionGroup)}
        className="bg-orange-600 hover:bg-orange-700 text-pixel-white shadow-pixel-sm flex items-center gap-1.5">
        <Download className="w-4 h-4" />
        Unduh Form PDF
       </Button>
       <Button onClick={() => setSelectedSessionGroup(null)} variant="outline">Tutup</Button>
      </div>
     </div>
    </div>
   )}
  </div>
 )
}
