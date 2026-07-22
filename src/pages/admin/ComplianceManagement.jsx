import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ShieldAlert, AlertTriangle, CheckCircle, Search, 
  Bell, Download, RefreshCw, Calendar, ClipboardCheck, 
  GraduationCap, AlertCircle
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
    // Group active enrollments by student
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

      // Compare pairs
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
                  ekskul2: e2.name,
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

      // Find sessions of this ekskul
      const ekskulSessions = sessions.filter(s => s.extracurricular_id === ekskul.id)
      const totalSessions = ekskulSessions.length
      if (totalSessions === 0) return

      // Get student's attendance records for these sessions
      const sessionIds = ekskulSessions.map(s => s.id)
      const studentAtts = attendances.filter(a => a.student_id === student.id && sessionIds.includes(a.session_id))
      const attendedCount = studentAtts.filter(a => a.status === 'hadir').length
      const percentage = Math.round((attendedCount / totalSessions) * 100)

      if (percentage < 80) {
        lowAttendance.push({
          id: `${student.id}-${ekskul.id}`,
          nis: student.nis,
          student_id: student.id,
          full_name: student.full_name,
          class: student.class,
          ekskulName: ekskul.name,
          attended: attendedCount,
          total: totalSessions,
          percentage
        })
      }

      // Check consecutive absences (3x Alpha)
      // Sort student attendances by session date
      const sortedAtts = ekskulSessions.map(session => {
        const att = studentAtts.find(a => a.session_id === session.id)
        return att ? att.status : null
      }).filter(Boolean)

      let maxConsecutiveAlpha = 0
      let currentConsecutiveAlpha = 0
      sortedAtts.forEach(status => {
        if (status === 'alpha') {
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

  // --- Reminder Action ---
  const handleSendReminder = async (studentNis, studentName, violationMessage) => {
    setSuccessMsg('')
    setErrorMsg('')
    try {
      // Find all accounts linked to this student (student user + parent user)
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
        'Ekskul 1': item.ekskul1,
        'Ekskul 2': item.ekskul2,
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
        idx + 1, item.nis, item.full_name, item.class, item.ekskul1, item.ekskul2, item.conflictDetail
      ])
    } else if (activeTab === 'low_attendance') {
      title = 'Laporan Siswa dengan Kehadiran di Bawah 80%'
      fileName = 'Laporan_Absensi_Rendah.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Ekskul', 'Sesi Hadir', 'Persentase']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.ekskulName, `${item.attended}/${item.total}`, `${item.percentage}%`
      ])
    } else if (activeTab === 'consecutive_absences') {
      title = 'Laporan Siswa dengan Alpha 3x Berturut-Turut'
      fileName = 'Laporan_Alpha_Berturut.pdf'
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Ekskul', 'Alpha Berturut']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.ekskulName, `${item.consecutiveCount} Kali`
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
      headers = [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Ekskul', 'Nilai Sikap', 'Catatan Pelatih']]
      body = filteredItems.map((item, idx) => [
        idx + 1, item.nis, item.full_name, item.class, item.ekskulName, item.score, item.notes
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
                        <th className="p-4">Detail Sesi</th>
                        <th className="p-4 text-pixel-red">Persentase</th>
                      </>
                    )}
                    {activeTab === 'consecutive_absences' && (
                      <>
                        <th className="p-4">Ekstrakurikuler</th>
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
                            <div className="text-pixel-white">{item.ekskul1} <span className="text-xs text-pixel-lavender">({item.schedule1})</span></div>
                            <div className="text-pixel-white mt-1">{item.ekskul2} <span className="text-xs text-pixel-lavender">({item.schedule2})</span></div>
                          </td>
                          <td className="p-4 font-semibold text-pixel-red">{item.conflictDetail}</td>
                        </>
                      )}

                      {activeTab === 'low_attendance' && (
                        <>
                          <td className="p-4 text-pixel-white">{item.ekskulName}</td>
                          <td className="p-4 text-pixel-lavender">{item.attended} dari {item.total} Sesi</td>
                          <td className="p-4 font-mono font-bold text-pixel-red">{item.percentage}% Kehadiran</td>
                        </>
                      )}

                      {activeTab === 'consecutive_absences' && (
                        <>
                          <td className="p-4 text-pixel-white">{item.ekskulName}</td>
                          <td className="p-4 font-semibold text-pixel-red">{item.consecutiveCount} Sesi Alpha Berturut-turut</td>
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
                              message = `Kehadiran ekskul ${item.ekskulName} kurang dari batas minimum (${item.percentage}%)`
                            } else if (activeTab === 'consecutive_absences') {
                              message = `Telah alpha sebanyak ${item.consecutiveCount} sesi berturut-turut di ekskul ${item.ekskulName}`
                            } else if (activeTab === 'missing_mandatory') {
                              message = `Belum mendaftar ekskul wajib yang ditentukan (${item.violationType})`
                            } else if (activeTab === 'low_attitude') {
                              message = `Nilai sikap berada di bawah batas ketertiban (Skor: ${item.score}) di ekskul ${item.ekskulName}`
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
    </div>
  )
}
