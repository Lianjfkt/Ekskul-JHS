import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ShieldAlert, AlertTriangle, CheckCircle, Search, 
  Bell, Download, RefreshCw, Calendar, ClipboardCheck, 
  GraduationCap, AlertCircle, Eye, X
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function ComplianceManagement() {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [activeTab, setActiveTab] = useState('schedule_conflicts')
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')

  // Raw data state
  const [students, setStudents] = useState([])
  const [extracurriculars, setExtracurriculars] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [sessions, setSessions] = useState([])
  const [attendances, setAttendances] = useState([])
  const [grades, setGrades] = useState([])

  // Modal State for Absence Detail
  const [selectedAbsenceDetail, setSelectedAbsenceDetail] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [
        { data: studentsData, error: sErr },
        { data: ekskulData, error: eErr },
        { data: enrollmentsData, error: enErr },
        { data: sessionsData, error: sesErr },
        { data: attendancesData, error: aErr },
        { data: gradesData, error: gErr }
      ] = await Promise.all([
        supabase.from('students').select('*').order('full_name', { ascending: true }),
        supabase.from('extracurriculars').select('*'),
        supabase.from('enrollments').select('*, extracurricular:extracurricular_id(*)').eq('status', 'active'),
        supabase.from('sessions').select('*').order('session_date', { ascending: true }),
        supabase.from('attendances').select('*'),
        supabase.from('grades').select('*, extracurricular:extracurricular_id(*)')
      ])

      if (sErr) throw sErr
      if (eErr) throw eErr
      if (enErr) throw enErr
      if (sesErr) throw sesErr
      if (aErr) throw aErr
      if (gErr) throw gErr

      setStudents(studentsData || [])
      setExtracurriculars(ekskulData || [])
      setEnrollments(enrollmentsData || [])
      setSessions(sessionsData || [])
      setAttendances(attendancesData || [])
      setGrades(gradesData || [])
    } catch (err) {
      console.error('Error fetching compliance data:', err.message)
      setErrorMsg('Gagal memuat data kepatuhan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- Helper to determine if an extracurricular is Mandatory (Wajib) or Elective (Pilihan) for a student ---
  const getEkskulType = (studentClass, ekskulName) => {
    const grade = studentClass?.trim().charAt(0)
    const nameLower = ekskulName?.toLowerCase() || ''
    if (grade === '7' && nameLower.includes('pramuka')) {
      return 'Wajib'
    }
    if (grade === '8' && (nameLower.includes('karate') || nameLower.includes('taekwondo'))) {
      return 'Wajib'
    }
    return 'Pilihan'
  }

  // --- Utility functions for schedule conflict detection ---
  const parseSchedule = (scheduleText) => {
    if (!scheduleText) return []
    const daysMap = {
      'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6, 'minggu': 7
    }
    const results = []
    const parts = scheduleText.toLowerCase().split(/[;\n]/)
    for (let part of parts) {
      part = part.trim()
      if (!part) continue
      const timeMatch = part.match(/(\d{2})[:\.](\d{2})\s*-\s*(\d{2})[:\.](\d{2})/)
      if (!timeMatch) continue
      const startMinutes = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10)
      const endMinutes = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10)
      
      const foundDays = []
      Object.keys(daysMap).forEach(dayName => {
        if (part.includes(dayName)) {
          foundDays.push(daysMap[dayName])
        }
      })
      foundDays.forEach(day => {
        results.push({ day, startMinutes, endMinutes, originalText: part })
      })
    }
    return results
  }

  const checkOverlap = (s1, s2) => {
    return s1.day === s2.day && s1.startMinutes < s2.endMinutes && s2.startMinutes < s1.endMinutes
  }

  // --- Computations for compliance / violations ---
  const complianceData = useMemo(() => {
    if (loading) return { conflicts: [], lowAttendance: [], consecutiveAbsences: [], missingMandatory: [], lowAttitude: [] }

    // 1. Schedule Conflicts
    const conflicts = []
    const studentEnrollments = {}
    enrollments.forEach(en => {
      if (!studentEnrollments[en.student_id]) {
        studentEnrollments[en.student_id] = []
      }
      studentEnrollments[en.student_id].push(en)
    })

    Object.keys(studentEnrollments).forEach(studentId => {
      const ens = studentEnrollments[studentId]
      const student = students.find(s => s.id === studentId)
      if (!student || ens.length < 2) return

      for (let i = 0; i < ens.length; i++) {
        for (let j = i + 1; j < ens.length; j++) {
          const e1 = ens[i].extracurricular
          const e2 = ens[j].extracurricular
          if (!e1 || !e2) continue
          const sched1 = parseSchedule(e1.schedule)
          const sched2 = parseSchedule(e2.schedule)

          for (let s1 of sched1) {
            for (let s2 of sched2) {
              if (checkOverlap(s1, s2)) {
                const dayName = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][s1.day - 1]
                conflicts.push({
                  id: `${studentId}-${e1.id}-${e2.id}`,
                  nis: student.nis,
                  student_id: student.id,
                  full_name: student.full_name,
                  class: student.class,
                  ekskul1: e1.name,
                  ekskul1Type: getEkskulType(student.class, e1.name),
                  ekskul2: e2.name,
                  ekskul2Type: getEkskulType(student.class, e2.name),
                  schedule1: e1.schedule,
                  schedule2: e2.schedule,
                  conflictDetail: `${dayName} (${Math.floor(s1.startMinutes/60).toString().padStart(2, '0')}:${(s1.startMinutes%60).toString().padStart(2, '0')}-${Math.floor(s1.endMinutes/60).toString().padStart(2, '0')}:${(s1.endMinutes%60).toString().padStart(2, '0')} vs ${Math.floor(s2.startMinutes/60).toString().padStart(2, '0')}:${(s2.startMinutes%60).toString().padStart(2, '0')}-${Math.floor(s2.endMinutes/60).toString().padStart(2, '0')}:${(s2.endMinutes%60).toString().padStart(2, '0')})`
                })
              }
            }
          }
        }
      }
    })

    // 2. Attendance < 80% & 3. Consecutive Absences (Alpha 3x+)
    const lowAttendance = []
    const consecutiveAbsences = []

    enrollments.forEach(en => {
      const student = students.find(s => s.id === en.student_id)
      const ekskul = en.extracurricular
      if (!student || !ekskul) return

      const ekskulSessions = sessions.filter(s => s.extracurricular_id === ekskul.id)
      const totalSessions = ekskulSessions.length
      if (totalSessions === 0) return

      const sessionIds = ekskulSessions.map(s => s.id)
      const studentAtts = attendances.filter(a => a.student_id === student.id && sessionIds.includes(a.session_id))
      const attendedCount = studentAtts.filter(a => a.status === 'hadir').length
      const percentage = Math.round((attendedCount / totalSessions) * 100)

      const ekskulType = getEkskulType(student.class, ekskul.name)

      if (percentage < 80) {
        lowAttendance.push({
          id: `${student.id}-${ekskul.id}`,
          nis: student.nis,
          student_id: student.id,
          full_name: student.full_name,
          class: student.class,
          ekskulName: ekskul.name,
          ekskulId: ekskul.id,
          ekskulType,
          attended: attendedCount,
          total: totalSessions,
          percentage
        })
      }

      // Check consecutive absences (3x Alpha)
      const sortedAtts = ekskulSessions.map(session => {
        const att = studentAtts.find(a => a.session_id === session.id)
        return {
          session_date: session.session_date,
          topic: session.topic,
          status: att ? att.status : 'alpha', // assume alpha if no attendance record but session existed
          notes: att ? att.notes : 'Tidak ada keterangan'
        }
      })

      let maxConsecutiveAlpha = 0
      let currentConsecutiveAlpha = 0
      sortedAtts.forEach(att => {
        if (att.status === 'alpha') {
          currentConsecutiveAlpha++
          if (currentConsecutiveAlpha > maxConsecutiveAlpha) {
            maxConsecutiveAlpha = currentConsecutiveAlpha
          }
        } else {
          currentConsecutiveAlpha = 0
        }
      })

      if (maxConsecutiveAlpha >= 3) {
        consecutiveAbsences.push({
          id: `${student.id}-${ekskul.id}-consecutive`,
          nis: student.nis,
          student_id: student.id,
          full_name: student.full_name,
          class: student.class,
          ekskulName: ekskul.name,
          ekskulId: ekskul.id,
          ekskulType,
          consecutiveCount: maxConsecutiveAlpha
        })
      }
    })

    // 4. Missing Mandatory Extracurricular
    const missingMandatory = []
    students.forEach(student => {
      const activeEns = enrollments.filter(en => en.student_id === student.id)
      const enrolledNames = activeEns.map(en => en.extracurricular?.name?.toLowerCase() || '').join(', ')
      const grade = student.class?.trim().charAt(0)

      if (grade === '7') {
        if (!enrolledNames.includes('pramuka')) {
          missingMandatory.push({
            id: student.id,
            nis: student.nis,
            student_id: student.id,
            full_name: student.full_name,
            class: student.class,
            violationType: 'Wajib Pramuka',
            enrolled: enrolledNames || '-'
          })
        }
      } else if (grade === '8') {
        if (!enrolledNames.includes('karate') && !enrolledNames.includes('taekwondo')) {
          missingMandatory.push({
            id: student.id,
            nis: student.nis,
            student_id: student.id,
            full_name: student.full_name,
            class: student.class,
            violationType: 'Wajib Karate / Taekwondo',
            enrolled: enrolledNames || '-'
          })
        }
      }
    })

    // 5. Low Attitude Score (< 70)
    const lowAttitude = []
    grades.forEach(gr => {
      if (gr.attitude_score !== null && gr.attitude_score < 70) {
        const student = students.find(s => s.id === gr.student_id)
        if (!student) return
        lowAttitude.push({
          id: gr.id,
          nis: student.nis,
          student_id: student.id,
          full_name: student.full_name,
          class: student.class,
          ekskulName: gr.extracurricular?.name || '-',
          ekskulType: getEkskulType(student.class, gr.extracurricular?.name),
          score: gr.attitude_score,
          notes: gr.notes || 'Tanpa catatan'
        })
      }
    })

    return { conflicts, lowAttendance, consecutiveAbsences, missingMandatory, lowAttitude }
  }, [loading, students, extracurriculars, enrollments, sessions, attendances, grades])

  // --- Filtering ---
  const getFilteredData = () => {
    let data = []
    if (activeTab === 'schedule_conflicts') data = complianceData.conflicts
    else if (activeTab === 'low_attendance') data = complianceData.lowAttendance
    else if (activeTab === 'consecutive_absences') data = complianceData.consecutiveAbsences
    else if (activeTab === 'missing_mandatory') data = complianceData.missingMandatory
    else if (activeTab === 'low_attitude') data = complianceData.lowAttitude

    return data.filter(item => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch = !q || item.full_name?.toLowerCase().includes(q) || item.nis?.includes(q)
      const matchClass = classFilter === 'all' || item.class?.trim().startsWith(classFilter)
      return matchSearch && matchClass
    })
  }

  const filteredItems = getFilteredData()

  // --- Action: Show detailed absence logs ---
  const handleShowAbsenceDetail = (studentId, ekskulId, studentName, ekskulName, type) => {
    const ekskulSessions = sessions.filter(s => s.extracurricular_id === ekskulId)
    const sessionIds = ekskulSessions.map(s => s.id)
    const studentAtts = attendances.filter(a => a.student_id === studentId && sessionIds.includes(a.session_id))
    
    // Construct all logs
    const logs = ekskulSessions.map(session => {
      const att = studentAtts.find(a => a.session_id === session.id)
      return {
        date: session.session_date,
        topic: session.topic || 'Tanpa topik',
        status: att ? att.status : 'alpha', // Default alpha if no record is created yet
        notes: att?.notes || '-'
      }
    })

    setSelectedAbsenceDetail({
      studentName,
      ekskulName,
      type,
      logs
    })
  }

  // --- Reminder Action ---
  const handleSendReminder = async (studentNis, studentName, violationMessage) => {
    setSuccessMsg('')
    setErrorMsg('')
    try {
      const { data: targetUsers, error } = await supabase
        .from('users')
        .select('id, role, students!inner(nis)')
        .eq('students.nis', studentNis)
        
      if (error) throw error
      
      if (!targetUsers || targetUsers.length === 0) {
        setErrorMsg(`Siswa ${studentName} atau Orang Tua belum terdaftar di sistem (belum memiliki akun).`)
        return
      }

      const notifications = targetUsers.map(u => ({
        user_id: u.id,
        title: 'Peringatan Ketertiban Ekskul',
        message: `Peringatan Kepatuhan: Untuk ${u.role === 'student' ? 'kamu' : 'anak Anda'} (${studentName}) - ${violationMessage}. Harap segera ditindaklanjuti demi memenuhi syarat kelulusan ekskul.`,
      }))

      const { error: insErr } = await supabase.from('notifications').insert(notifications)
      if (insErr) throw insErr

      setSuccessMsg(`Peringatan kedisiplinan berhasil dikirim ke ${targetUsers.length} akun (Siswa/Orang Tua).`)
    } catch (err) {
      console.error(err)
      setErrorMsg('Gagal mengirim peringatan: ' + err.message)
    }
  }

  // --- Exporting ---
  const exportToExcel = () => {
    let sheetData = []
    let fileName = ''
    
    if (activeTab === 'schedule_conflicts') {
      fileName = 'Laporan_Jadwal_Bertabrakan'
      sheetData = filteredItems.map((item, idx) => ({
        'No': idx + 1,
        'NIS': item.nis,
        'Nama Siswa': item.full_name,
        'Kelas': item.class,
        'Ekskul 1': `${item.ekskul1} (${item.ekskul1Type})`,
        'Ekskul 2': `${item.ekskul2} (${item.ekskul2Type})`,
        'Detail Bentrokan': item.conflictDetail
      }))
    } else if (activeTab === 'low_attendance') {
      fileName = 'Laporan_Absensi_Rendah'
      sheetData = filteredItems.map((item, idx) => ({
        'No': idx + 1,
        'NIS': item.nis,
        'Nama Siswa': item.full_name,
        'Kelas': item.class,
        'Nama Ekskul': item.ekskulName,
        'Sifat Ekskul': item.ekskulType,
        'Kehadiran Sesi': `${item.attended}/${item.total}`,
        'Persentase Kehadiran': `${item.percentage}%`
      }))
    } else if (activeTab === 'consecutive_absences') {
      fileName = 'Laporan_Alpha_Berturut'
      sheetData = filteredItems.map((item, idx) => ({
        'No': idx + 1,
        'NIS': item.nis,
        'Nama Siswa': item.full_name,
        'Kelas': item.class,
        'Nama Ekskul': item.ekskulName,
        'Sifat Ekskul': item.ekskulType,
        'Alpha Berturut-Turut': `${item.consecutiveCount} Kali`
      }))
    } else if (activeTab === 'missing_mandatory') {
      fileName = 'Laporan_Belum_Ekskul_Wajib'
      sheetData = filteredItems.map((item, idx) => ({
        'No': idx + 1,
        'NIS': item.nis,
        'Nama Siswa': item.full_name,
        'Kelas': item.class,
        'Pelanggaran': item.violationType,
        'Ekskul Aktif Saat Ini': item.enrolled
      }))
    } else if (activeTab === 'low_attitude') {
      fileName = 'Laporan_Nilai_Sikap_Rendah'
      sheetData = filteredItems.map((item, idx) => ({
        'No': idx + 1,
        'NIS': item.nis,
        'Nama Siswa': item.full_name,
        'Kelas': item.class,
        'Nama Ekskul': item.ekskulName,
        'Sifat Ekskul': item.ekskulType,
        'Nilai Sikap': item.score,
        'Catatan Pelatih': item.notes
      }))
    }

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Kepatuhan Siswa")
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    let title = ''
    let headers = []
    let body = []
    let fileName = ''

    if (activeTab === 'schedule_conflicts') {
      title = 'Laporan Siswa dengan Jadwal Ekskul Bertabrakan'
      fileName = 'Laporan_Jadwal_Bertabrakan.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Ekskul 1', 'Ekskul 2', 'Detail Bentrokan']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, `${item.ekskul1} (${item.ekskul1Type})`, `${item.ekskul2} (${item.ekskul2Type})`, item.conflictDetail
      ])
    } else if (activeTab === 'low_attendance') {
      title = 'Laporan Siswa dengan Kehadiran di Bawah 80%'
      fileName = 'Laporan_Absensi_Rendah.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Ekskul', 'Jenis', 'Sesi Hadir', 'Persentase']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.ekskulName, item.ekskulType, `${item.attended}/${item.total}`, `${item.percentage}%`
      ])
    } else if (activeTab === 'consecutive_absences') {
      title = 'Laporan Siswa dengan Alpha 3x Berturut-Turut'
      fileName = 'Laporan_Alpha_Berturut.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Ekskul', 'Jenis', 'Alpha Berturut']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.ekskulName, item.ekskulType, `${item.consecutiveCount} Kali`
      ])
    } else if (activeTab === 'missing_mandatory') {
      title = 'Laporan Siswa Belum Mengambil Ekskul Wajib'
      fileName = 'Laporan_Belum_Ekskul_Wajib.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Pelanggaran', 'Ekskul Terdaftar']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.violationType, item.enrolled
      ])
    } else if (activeTab === 'low_attitude') {
      title = 'Laporan Siswa dengan Nilai Sikap di Bawah 70'
      fileName = 'Laporan_Nilai_Sikap_Rendah.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Ekskul', 'Jenis', 'Nilai Sikap', 'Catatan Pelatih']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.ekskulName, item.ekskulType, item.score, item.notes
      ])
    }

    doc.setFontSize(14)
    doc.text(title, 14, 15)
    doc.setFontSize(9)
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22)

    doc.autoTable({
      startY: 28,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 }
    })

    doc.save(fileName)
  }

  // --- Rendering Helpers ---
  const getTabBadgeCount = (tabName) => {
    if (loading) return 0
    if (tabName === 'schedule_conflicts') return complianceData.conflicts.length
    if (tabName === 'low_attendance') return complianceData.lowAttendance.length
    if (tabName === 'consecutive_absences') return complianceData.consecutiveAbsences.length
    if (tabName === 'missing_mandatory') return complianceData.missingMandatory.length
    if (tabName === 'low_attitude') return complianceData.lowAttitude.length
    return 0
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pixel-panel border-4 border-pixel-gray p-6 relative">
        <div>
          <h1 className="font-pixel text-[10px] text-pixel-blue pixel-text-shadow flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-pixel-red animate-pulse" />
            KEPATUHAN & KETERTIBAN SISWA
          </h1>
          <p className="font-retro text-lg text-pixel-lavender mt-2">
            Pusat pelacakan pelanggaran siswa, bentrok jadwal, dan monitoring ketidakhadiran dalam ekstrakurikuler.
          </p>
        </div>
        <Button 
          onClick={fetchData} 
          disabled={loading}
          className="font-pixel text-[8px] bg-pixel-blue text-pixel-navy border-2 border-pixel-blue hover:bg-pixel-navy hover:text-pixel-blue rounded-none flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> AKTUALKAN
        </Button>
      </div>

      {/* Alert status */}
      {errorMsg && (
        <div className="p-4 bg-pixel-red/10 border-3 border-pixel-red text-pixel-red font-retro text-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-pixel-green/10 border-3 border-pixel-green text-pixel-green font-retro text-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b-4 border-pixel-gray pb-2">
        {[
          { id: 'schedule_conflicts', label: 'JADWAL TABRAKAN', icon: Calendar },
          { id: 'low_attendance', label: 'ABSENSI < 80%', icon: ClipboardCheck },
          { id: 'consecutive_absences', label: 'ALPHA 3X+ BERTURUT', icon: AlertTriangle },
          { id: 'missing_mandatory', label: 'BELUM EKSKUL WAJIB', icon: ShieldAlert },
          { id: 'low_attitude', label: 'NILAI SIKAP RENDAH', icon: GraduationCap }
        ].map(tab => {
          const isActive = activeTab === tab.id
          const count = getTabBadgeCount(tab.id)
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 font-pixel text-[7px] px-3 py-2 border-2 transition-all rounded-none ${
                isActive 
                  ? 'bg-pixel-blue/20 border-pixel-blue text-pixel-blue pixel-text-shadow'
                  : 'border-transparent text-pixel-peach hover:bg-pixel-panel-light hover:border-pixel-gray'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`ml-1 font-pixel text-[6px] px-1 py-0.5 rounded-none border ${
                  isActive ? 'border-pixel-blue bg-pixel-blue/15' : 'border-pixel-red text-pixel-red bg-pixel-red/10'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Main Table Filter & Controls */}
      <Card className="border-4 border-pixel-gray bg-pixel-panel rounded-none">
        <CardHeader className="border-b-2 border-pixel-gray/30 bg-pixel-navy/20 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-1 gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pixel-lavender" />
                <input
                  type="text"
                  placeholder="Cari siswa berdasarkan nama atau NIS..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-pixel-navy border-2 border-pixel-gray focus:border-pixel-blue outline-none font-retro text-lg text-pixel-white placeholder:text-pixel-lavender/50"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Class Filter */}
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[6px] text-pixel-lavender">KELAS:</span>
                {['all', '7', '8', '9'].map(c => (
                  <button
                    key={c}
                    onClick={() => setClassFilter(c)}
                    className={`font-pixel text-[7px] px-2 py-1.5 border-2 transition-all rounded-none ${
                      classFilter === c 
                        ? 'bg-pixel-blue/20 border-pixel-blue text-pixel-blue'
                        : 'border-pixel-gray text-pixel-lavender hover:border-pixel-gray-light'
                    }`}
                  >
                    {c === 'all' ? 'SEMUA' : `KLS ${c}`}
                  </button>
                ))}
              </div>

              {/* Export buttons */}
              {filteredItems.length > 0 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={exportToExcel}
                    className="font-pixel text-[7px] text-pixel-green border-pixel-green hover:bg-pixel-green hover:text-pixel-navy rounded-none h-9 gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> EXCEL
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={exportToPDF}
                    className="font-pixel text-[7px] text-pixel-red border-pixel-red hover:bg-pixel-red hover:text-pixel-navy rounded-none h-9 gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center font-retro text-2xl text-pixel-lavender">
              <span className="pixel-blink">MENGEVALUASI DATA KEPATUHAN SISWA...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center font-retro text-xl text-pixel-lavender">
              <CheckCircle className="w-16 h-16 text-pixel-green mx-auto mb-4" />
              <p className="text-pixel-white font-bold">Luar Biasa! Tidak ada pelanggaran terdeteksi.</p>
              <p className="text-base text-pixel-lavender/70 mt-1">Semua siswa mengikuti program dengan tertib sesuai filter saat ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-retro text-lg">
                <thead>
                  <tr className="border-b-3 border-pixel-gray bg-pixel-navy font-pixel text-[7px] text-pixel-lavender uppercase tracking-wider">
                    <th className="p-4">Siswa</th>
                    <th className="p-4">Kelas / NIS</th>
                    {activeTab === 'schedule_conflicts' && (
                      <>
                        <th className="p-4">Ekskul Terkait</th>
                        <th className="p-4 text-pixel-red">Detail Tabrakan</th>
                      </>
                    )}
                    {activeTab === 'low_attendance' && (
                      <>
                        <th className="p-4">Ekstrakurikuler</th>
                        <th className="p-4">Jenis</th>
                        <th className="p-4">Detail Sesi</th>
                        <th className="p-4 text-pixel-red">Persentase</th>
                      </>
                    )}
                    {activeTab === 'consecutive_absences' && (
                      <>
                        <th className="p-4">Ekstrakurikuler</th>
                        <th className="p-4">Jenis</th>
                        <th className="p-4 text-pixel-red">Ketidakhadiran Alpha</th>
                      </>
                    )}
                    {activeTab === 'missing_mandatory' && (
                      <>
                        <th className="p-4">Status Ekskul</th>
                        <th className="p-4 text-pixel-red">Pelanggaran Wajib</th>
                      </>
                    )}
                    {activeTab === 'low_attitude' && (
                      <>
                        <th className="p-4">Ekstrakurikuler</th>
                        <th className="p-4">Jenis</th>
                        <th className="p-4 text-pixel-red">Nilai Sikap</th>
                        <th className="p-4">Catatan Guru</th>
                      </>
                    )}
                    <th className="p-4 text-right">Aksi Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-pixel-gray/20">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-pixel-panel-light">
                      <td className="p-4 font-bold text-pixel-white">{item.full_name}</td>
                      <td className="p-4">
                        <span className="text-pixel-peach border border-pixel-peach/30 bg-pixel-peach/5 px-2 py-0.5">Kelas {item.class}</span>
                        <div className="font-mono text-base text-pixel-lavender/70 mt-1">{item.nis}</div>
                      </td>

                      {/* Tab Specific Columns */}
                      {activeTab === 'schedule_conflicts' && (
                        <>
                          <td className="p-4">
                            <div className="text-pixel-white">
                              {item.ekskul1} <span className="text-xs text-pixel-blue bg-pixel-blue/10 px-1.5 py-0.5 border border-pixel-blue/20">{item.ekskul1Type}</span>
                              <div className="text-sm text-pixel-lavender/70 mt-0.5">Jadwal: {item.schedule1}</div>
                            </div>
                            <div className="text-pixel-white mt-2">
                              {item.ekskul2} <span className="text-xs text-pixel-blue bg-pixel-blue/10 px-1.5 py-0.5 border border-pixel-blue/20">{item.ekskul2Type}</span>
                              <div className="text-sm text-pixel-lavender/70 mt-0.5">Jadwal: {item.schedule2}</div>
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-pixel-red">{item.conflictDetail}</td>
                        </>
                      )}

                      {activeTab === 'low_attendance' && (
                        <>
                          <td className="p-4 text-pixel-white">{item.ekskulName}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2 py-0.5 border ${
                              item.ekskulType === 'Wajib' 
                                ? 'text-pixel-red border-pixel-red/30 bg-pixel-red/5' 
                                : 'text-pixel-green border-pixel-green/30 bg-pixel-green/5'
                            }`}>
                              {item.ekskulType}
                            </span>
                          </td>
                          <td className="p-4 text-pixel-lavender">
                            <div className="flex items-center gap-2">
                              <span>{item.attended} dari {item.total} Sesi</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleShowAbsenceDetail(item.student_id, item.ekskulId, item.full_name, item.ekskulName, item.ekskulType)}
                                className="font-pixel text-[5px] h-5 py-0 border-pixel-blue text-pixel-blue hover:bg-pixel-blue hover:text-pixel-navy rounded-none flex items-center gap-0.5"
                              >
                                <Eye className="w-2.5 h-2.5" /> DETAIL
                              </Button>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-pixel-red">{item.percentage}% Kehadiran</td>
                        </>
                      )}

                      {activeTab === 'consecutive_absences' && (
                        <>
                          <td className="p-4 text-pixel-white">{item.ekskulName}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2 py-0.5 border ${
                              item.ekskulType === 'Wajib' 
                                ? 'text-pixel-red border-pixel-red/30 bg-pixel-red/5' 
                                : 'text-pixel-green border-pixel-green/30 bg-pixel-green/5'
                            }`}>
                              {item.ekskulType}
                            </span>
                          </td>
                          <td className="p-4 text-pixel-red">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{item.consecutiveCount} Sesi Alpha Berturut-turut</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleShowAbsenceDetail(item.student_id, item.ekskulId, item.full_name, item.ekskulName, item.ekskulType)}
                                className="font-pixel text-[5px] h-5 py-0 border-pixel-blue text-pixel-blue hover:bg-pixel-blue hover:text-pixel-navy rounded-none flex items-center gap-0.5"
                              >
                                <Eye className="w-2.5 h-2.5" /> DETAIL
                              </Button>
                            </div>
                          </td>
                        </>
                      )}

                      {activeTab === 'missing_mandatory' && (
                        <>
                          <td className="p-4 text-pixel-lavender">Terdaftar di: {item.enrolled}</td>
                          <td className="p-4 font-semibold text-pixel-red">{item.violationType}</td>
                        </>
                      )}

                      {activeTab === 'low_attitude' && (
                        <>
                          <td className="p-4 text-pixel-white">{item.ekskulName}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2 py-0.5 border ${
                              item.ekskulType === 'Wajib' 
                                ? 'text-pixel-red border-pixel-red/30 bg-pixel-red/5' 
                                : 'text-pixel-green border-pixel-green/30 bg-pixel-green/5'
                            }`}>
                              {item.ekskulType}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-pixel-red">{item.score} / 100</td>
                          <td className="p-4 text-sm text-pixel-lavender max-w-[200px] truncate" title={item.notes}>{item.notes}</td>
                        </>
                      )}

                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            let message = ''
                            if (activeTab === 'schedule_conflicts') {
                              message = `Jadwal ekskul bentrok antara ${item.ekskul1} dan ${item.ekskul2} (${item.conflictDetail})`
                            } else if (activeTab === 'low_attendance') {
                              message = `Kehadiran ekskul ${item.ekskulName} (${item.ekskulType}) kurang dari batas minimum (${item.percentage}%)`
                            } else if (activeTab === 'consecutive_absences') {
                              message = `Telah alpha sebanyak ${item.consecutiveCount} sesi berturut-turut di ekskul ${item.ekskulName} (${item.ekskulType})`
                            } else if (activeTab === 'missing_mandatory') {
                              message = `Belum mendaftar ekskul wajib yang ditentukan (${item.violationType})`
                            } else if (activeTab === 'low_attitude') {
                              message = `Nilai sikap berada di bawah batas ketertiban (Skor: ${item.score}) di ekskul ${item.ekskulName} (${item.ekskulType})`
                            }
                            handleSendReminder(item.nis, item.full_name, message)
                          }}
                          className="font-pixel text-[6px] py-1 border-pixel-yellow text-pixel-yellow hover:bg-pixel-yellow hover:text-pixel-navy rounded-none gap-1 inline-flex items-center"
                        >
                          <Bell className="w-3 h-3" /> PERINGATKAN
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detail Absensi */}
      {selectedAbsenceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl bg-pixel-panel border-4 border-pixel-gray rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-pixel-navy border-b-4 border-pixel-gray p-4 flex justify-between items-center shrink-0">
              <h2 className="font-pixel text-[8px] text-pixel-blue pixel-text-shadow flex items-center gap-2">
                <Calendar className="w-5 h-5 text-pixel-green" />
                RIWAYAT ABSENSI DETAIL
              </h2>
              <button 
                onClick={() => setSelectedAbsenceDetail(null)}
                className="text-pixel-peach hover:text-pixel-red border-2 border-transparent hover:border-pixel-red p-1 bg-pixel-panel-light rounded-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body Info */}
            <div className="p-4 border-b-2 border-pixel-gray/20 bg-pixel-navy/20 shrink-0">
              <p className="font-retro text-lg text-pixel-white">Siswa: <span className="font-bold">{selectedAbsenceDetail.studentName}</span></p>
              <div className="flex items-center gap-3 mt-1 font-retro text-base text-pixel-lavender">
                <span>Ekstrakurikuler: <span className="text-pixel-white font-bold">{selectedAbsenceDetail.ekskulName}</span></span>
                <span className={`text-xs px-2 py-0.2 border ${
                  selectedAbsenceDetail.type === 'Wajib' 
                    ? 'text-pixel-red border-pixel-red/30 bg-pixel-red/5' 
                    : 'text-pixel-green border-pixel-green/30 bg-pixel-green/5'
                }`}>
                  Ekskul {selectedAbsenceDetail.type}
                </span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pixel-scroll p-4 space-y-3">
              {selectedAbsenceDetail.logs.length === 0 ? (
                <p className="text-center font-retro text-pixel-lavender py-6">Belum ada sesi latihan tercatat untuk ekskul ini.</p>
              ) : (
                <div className="space-y-2">
                  {selectedAbsenceDetail.logs.map((log, index) => {
                    const isAbsent = log.status !== 'hadir'
                    return (
                      <div 
                        key={index}
                        className={`p-3 border-2 flex flex-col sm:flex-row justify-between sm:items-center gap-2 rounded-none font-retro ${
                          log.status === 'hadir'
                            ? 'border-pixel-green/20 bg-pixel-green/5'
                            : log.status === 'izin'
                            ? 'border-pixel-yellow/20 bg-pixel-yellow/5'
                            : 'border-pixel-red/20 bg-pixel-red/5'
                        }`}
                      >
                        <div>
                          <p className="text-pixel-white font-bold">{new Date(log.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          <p className="text-sm text-pixel-lavender mt-0.5">Topik: {log.topic}</p>
                          {isAbsent && <p className="text-xs text-pixel-peach/70 mt-1">Keterangan: {log.notes}</p>}
                        </div>
                        <span className={`font-pixel text-[6px] px-2.5 py-1 text-center self-start sm:self-center rounded-none border ${
                          log.status === 'hadir'
                            ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                            : log.status === 'izin'
                            ? 'border-pixel-yellow text-pixel-yellow bg-pixel-yellow/10'
                            : 'border-pixel-red text-pixel-red bg-pixel-red/10'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-pixel-navy border-t-4 border-pixel-gray text-right shrink-0">
              <Button 
                onClick={() => setSelectedAbsenceDetail(null)}
                className="font-pixel text-[7px] bg-pixel-gray text-pixel-navy hover:bg-pixel-navy hover:text-pixel-peach rounded-none h-8"
              >
                TUTUP
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
