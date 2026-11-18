# Latest Session Attendance Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "📅 Absensi per Sesi" (Session Attendance) tab in `RecapManagement.jsx`, enabling admins to inspect student attendance for the latest (or selected) session of any extracurricular, highlight absent/problematic students (with streak alpha & BK risk level), copy WhatsApp reports for Kepala Sekolah & BK, and export session attendance to PDF (with official kop surat) and Excel.

**Architecture:** 
- Extract reporting and calculation logic into `src/utils/sessionAttendanceHelper.js` with comprehensive unit tests (`node --test`).
- Provide export helpers for PDF (using `addKopSuratToPDF` and `jspdf-autotable`) and Excel (using `xlsx`).
- Add the `sessionAttendance` tab to `src/pages/admin/RecapManagement.jsx` with responsive selectors, session summary cards, action buttons (WA, PDF, Excel), and student list table sorted by urgency (alpa first).

**Tech Stack:** React 18, Tailwind CSS, Lucide React, jsPDF, jspdf-autotable, SheetJS (`xlsx`), Supabase, Node.js test runner (`node --test`).

## Global Constraints
- Follow existing pixel retro theme styling (`bg-pixel-navy`, `bg-pixel-panel`, `border-pixel-gray/30`, `text-pixel-white`, `text-pixel-lavender`, `text-pixel-peach`).
- Ensure no breaking changes to existing tabs (`overview`, `fillTracking`, `warnings`, `attendance`, `grades`, `coachSessions`, `activity`, `coachEvaluations`).
- Ensure `npm run build` succeeds cleanly without bundle or type errors.

---

### Task 1: Create Session Attendance Helper & Unit Tests

**Files:**
- Create: `src/utils/sessionAttendanceHelper.js`
- Test: `tests/sessionAttendanceHelper.test.js`

**Interfaces:**
- Produces:
  - `computeSessionStudentList({ session, extracurricular, enrollments, attendances, specialParticipants, studentRiskMap })`: Array of students mapped to their attendance status on this session, sorted with alpa/risk at top.
  - `formatSessionWhatsAppReport({ ekskul, session, coachName, stats, absentStudents })`: Formatted WhatsApp markdown string ready for clipboard.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/sessionAttendanceHelper.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeSessionStudentList,
  formatSessionWhatsAppReport
} from '../src/utils/sessionAttendanceHelper.js'

describe('sessionAttendanceHelper', () => {
  it('correctly sorts students with alpa first and computes stats', () => {
    const session = {
      id: 'sess-1',
      extracurricular_id: 'ekskul-1',
      session_date: '2026-11-15',
      topic: 'Teknik Dribble',
      attendance_submitted: true
    }
    const extracurricular = { id: 'ekskul-1', name: 'Futsal' }
    const enrollments = [
      { student_id: 's1', extracurricular_id: 'ekskul-1', student: { id: 's1', full_name: 'Ahmad', class: '8-B', nis: '1001' } },
      { student_id: 's2', extracurricular_id: 'ekskul-1', student: { id: 's2', full_name: 'Budi', class: '7-A', nis: '1002' } },
      { student_id: 's3', extracurricular_id: 'ekskul-1', student: { id: 's3', full_name: 'Candra', class: '9-C', nis: '1003' } }
    ]
    const attendances = [
      { session_id: 'sess-1', student_id: 's1', status: 'alpha' },
      { session_id: 'sess-1', student_id: 's2', status: 'hadir' },
      { session_id: 'sess-1', student_id: 's3', status: 'izin', notes: 'Sakit flu' }
    ]
    const studentRiskMap = {
      s1: { consecutiveAlpha: 2, totalAlpha: 3, warningLevel: 'TEGURAN', actionRecommendation: 'Panggil ke BK' }
    }

    const result = computeSessionStudentList({
      session,
      extracurricular,
      enrollments,
      attendances,
      specialParticipants: [],
      studentRiskMap
    })

    assert.equal(result.length, 3)
    assert.equal(result[0].studentName, 'Ahmad') // Alpa student should be first
    assert.equal(result[0].status, 'alpha')
    assert.equal(result[0].consecutiveAlpha, 2)
    assert.equal(result[1].studentName, 'Candra') // Izin second
    assert.equal(result[2].studentName, 'Budi') // Hadir third
  })

  it('formats WhatsApp message properly with absent students', () => {
    const ekskul = { name: 'Futsal' }
    const session = { session_date: '2026-11-15', topic: 'Passing & Shooting', notes: 'Latihan intensif' }
    const coachName = 'Coach Bambang'
    const stats = { hadir: 10, izin: 1, alpha: 2, total: 13, pct: 77 }
    const absentStudents = [
      {
        studentName: 'Ahmad',
        class: '8-B',
        nis: '1001',
        consecutiveAlpha: 2,
        totalAlpha: 3,
        warningLevel: 'TEGURAN',
        actionRecommendation: 'Panggil ke BK'
      }
    ]

    const text = formatSessionWhatsAppReport({
      ekskul,
      session,
      coachName,
      stats,
      absentStudents
    })

    assert.match(text, /LAPORAN ABSENSI SESI LATIHAN EKSTRAKURIKULER/)
    assert.match(text, /Futsal/)
    assert.match(text, /Coach Bambang/)
    assert.match(text, /Ahmad/)
    assert.match(text, /Alpa Berturut-turut: 2x/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sessionAttendanceHelper.test.js`  
Expected: FAIL (module `../src/utils/sessionAttendanceHelper.js` does not exist).

- [ ] **Step 3: Implement `src/utils/sessionAttendanceHelper.js`**

```javascript
// src/utils/sessionAttendanceHelper.js
import { isSessionApplicableToStudent } from './attendanceRiskEngine.js'

export function computeSessionStudentList({
  session,
  extracurricular,
  enrollments = [],
  attendances = [],
  specialParticipants = [],
  studentRiskMap = {}
}) {
  if (!session || !extracurricular) return []

  const ekskulEnrollments = enrollments.filter(en => en.extracurricular_id === extracurricular.id)

  const rows = ekskulEnrollments
    .map(en => {
      const student = en.student
      if (!student) return null

      const isApplicable = isSessionApplicableToStudent(
        session,
        student,
        specialParticipants,
        attendances
      )
      if (!isApplicable) return null

      const attRecord = attendances.find(
        a => a.session_id === session.id && a.student_id === student.id
      )

      let status = 'alpha'
      let notes = ''
      if (attRecord) {
        status = attRecord.status || 'alpha'
        notes = attRecord.notes || ''
      } else if (!session.attendance_submitted) {
        status = 'unmarked'
      }

      const risk = studentRiskMap[student.id] || {}

      return {
        studentId: student.id,
        nis: student.nis || '-',
        studentName: student.full_name || 'Tanpa Nama',
        class: student.class || '-',
        status,
        notes,
        consecutiveAlpha: risk.consecutiveAlpha || (status === 'alpha' ? 1 : 0),
        totalAlpha: risk.totalAlpha || (status === 'alpha' ? 1 : 0),
        warningLevel: risk.warningLevel || null,
        actionRecommendation: risk.actionRecommendation || (status === 'alpha' ? 'Konfirmasi ke siswa/wali' : '')
      }
    })
    .filter(Boolean)

  // Sort urgency: alpha first (highest consecutiveAlpha), then unmarked, then izin, then hadir
  const statusPriority = {
    alpha: 0,
    unmarked: 1,
    izin: 2,
    hadir: 3
  }

  return rows.sort((a, b) => {
    const prioA = statusPriority[a.status] ?? 4
    const prioB = statusPriority[b.status] ?? 4
    if (prioA !== prioB) return prioA - prioB
    if (a.status === 'alpha' && b.status === 'alpha') {
      if (b.consecutiveAlpha !== a.consecutiveAlpha) {
        return b.consecutiveAlpha - a.consecutiveAlpha
      }
      return b.totalAlpha - a.totalAlpha
    }
    return a.studentName.localeCompare(b.studentName)
  })
}

export function formatSessionWhatsAppReport({
  ekskul,
  session,
  coachName,
  stats,
  absentStudents = []
}) {
  const dateFormatted = session?.session_date
    ? new Date(session.session_date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '-'

  const header = [
    `📢 *LAPORAN ABSENSI SESI LATIHAN EKSTRAKURIKULER*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*Ekskul*   : ${ekskul?.name || '-'}`,
    `*Tanggal*  : ${dateFormatted}`,
    `*Pelatih*  : ${coachName || '-'}`,
    `*Materi*   : ${session?.topic || '-'}`,
    `*Kehadiran*: Hadir: ${stats?.hadir || 0} | Izin: ${stats?.izin || 0} | Alpa: ${stats?.alpha || 0} (${stats?.pct || 0}%)`
  ]

  let body = []
  if (absentStudents.length > 0) {
    body.push(``)
    body.push(`⚠️ *DAFTAR SISWA ALPA / PERLU PERHATIAN BK:*`)
    absentStudents.forEach((st, idx) => {
      body.push(`${idx + 1}. *${st.studentName}* (${st.class} - NIS: ${st.nis})`)
      body.push(`   └ Alpa Sesi Ini (Alpa Berturut-turut: ${st.consecutiveAlpha}x | Total: ${st.totalAlpha}x)`)
      if (st.warningLevel) {
        body.push(`   └ Status Sanksi: ${st.warningLevel}`)
      }
      if (st.actionRecommendation) {
        body.push(`   └ Rekomendasi: ${st.actionRecommendation}`)
      }
    })
  } else {
    body.push(``)
    body.push(`🎉 *Seluruh siswa hadir / izin tertib. Tidak ada siswa alpa pada sesi ini.*`)
  }

  const footer = [
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    session?.notes ? `_Catatan Pelatih_: ${session.notes}` : null,
    `_Mohon bantuan Tim BK & Wali Kelas untuk menindaklanjuti ketidakhadiran siswa di atas. Terima kasih._`
  ].filter(Boolean)

  return [...header, ...body, ...footer].join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sessionAttendanceHelper.test.js`  
Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sessionAttendanceHelper.js tests/sessionAttendanceHelper.test.js
git commit -m "feat: add session attendance helper and unit tests"
```

---

### Task 2: Create PDF & Excel Export Utilities for Session Attendance

**Files:**
- Create: `src/utils/sessionExportHelper.js`
- Test: Manual / build verification

**Interfaces:**
- Produces:
  - `exportSessionAttendanceToPDF({ session, extracurricular, coachName, rows, stats })`
  - `exportSessionAttendanceToExcel({ session, extracurricular, coachName, rows, stats })`

- [ ] **Step 1: Implement `src/utils/sessionExportHelper.js`**

```javascript
// src/utils/sessionExportHelper.js
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { saveAs } from 'file-saver'
import { addKopSuratToPDF } from './pdfHelper'

export async function exportSessionAttendanceToExcel({
  session,
  extracurricular,
  coachName,
  rows
}) {
  const XLSX = await import('xlsx')
  
  const dateFormatted = session?.session_date
    ? new Date(session.session_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''

  const excelRows = rows.map((r, i) => [
    i + 1,
    r.nis,
    r.studentName,
    r.class,
    r.status === 'hadir' ? 'Hadir' : r.status === 'izin' ? 'Izin' : r.status === 'alpha' ? 'Alpa' : 'Belum Diabsen',
    r.notes || '-',
    r.status === 'alpha' ? `${r.consecutiveAlpha}x` : '-',
    r.status === 'alpha' ? `${r.totalAlpha}x` : '-',
    r.warningLevel || '-',
    r.actionRecommendation || '-'
  ])

  const headers = [
    'No',
    'NIS',
    'Nama Siswa',
    'Kelas',
    'Status Kehadiran',
    'Keterangan / Izin',
    'Alpa Berturut-turut',
    'Total Alpa Semester',
    'Status Sanksi',
    'Rekomendasi BK'
  ]

  const ws = XLSX.utils.aoa_to_sheet([
    [`REKAP KEHADIRAN SESI LATIHAN EKSTRAKURIKULER`],
    [`Ekskul: ${extracurricular?.name || '-'} | Tanggal: ${dateFormatted} | Pelatih: ${coachName || '-'}`],
    [`Materi: ${session?.topic || '-'} | Catatan: ${session?.notes || '-'}`],
    [],
    headers,
    ...excelRows
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi Sesi')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const filename = `rekap_sesi_${(extracurricular?.name || 'ekskul').toLowerCase().replace(/\s+/g, '_')}_${session?.session_date || 'tanggal'}.xlsx`
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename)
}

export function exportSessionAttendanceToPDF({
  session,
  extracurricular,
  coachName,
  rows,
  stats
}) {
  const doc = new jsPDF()
  const startY = addKopSuratToPDF(doc)

  const dateFormatted = session?.session_date
    ? new Date(session.session_date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '-'

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('BERITA ACARA & REKAP KEHADIRAN SESI LATIHAN', doc.internal.pageSize.getWidth() / 2, startY + 6, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const leftX = 14
  let currentY = startY + 14

  doc.text(`Ekstrakurikuler : ${extracurricular?.name || '-'}`, leftX, currentY)
  doc.text(`Pelatih           : ${coachName || '-'}`, leftX, currentY + 5)
  doc.text(`Hari / Tanggal  : ${dateFormatted}`, leftX, currentY + 10)
  doc.text(`Materi Sesi     : ${session?.topic || '-'}`, leftX, currentY + 15)

  const rightX = 125
  doc.text(`Total Peserta  : ${stats?.total || 0} Siswa`, rightX, currentY)
  doc.text(`Hadir              : ${stats?.hadir || 0} Siswa (${stats?.pct || 0}%)`, rightX, currentY + 5)
  doc.text(`Izin / Sakit      : ${stats?.izin || 0} Siswa`, rightX, currentY + 10)
  doc.text(`Alpa               : ${stats?.alpha || 0} Siswa`, rightX, currentY + 15)

  const tableData = rows.map((r, idx) => [
    idx + 1,
    r.nis,
    r.studentName,
    r.class,
    r.status === 'hadir' ? 'Hadir' : r.status === 'izin' ? 'Izin' : r.status === 'alpha' ? 'ALPA' : 'Belum Diabsen',
    r.status === 'alpha' && r.consecutiveAlpha > 1 ? `⚠️ ${r.consecutiveAlpha}x streak` : (r.notes || '-'),
    r.warningLevel || '-'
  ])

  doc.autoTable({
    startY: currentY + 22,
    head: [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Kehadiran', 'Keterangan / Streak', 'Level Sanksi']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 50 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 25 },
      5: { cellWidth: 40 },
      6: { halign: 'center', cellWidth: 25 }
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.cell.raw === 'ALPA') {
          data.cell.styles.textColor = [231, 76, 60]
          data.cell.styles.fontStyle = 'bold'
        } else if (data.cell.raw === 'Hadir') {
          data.cell.styles.textColor = [39, 174, 96]
        }
      }
    }
  })

  // Signatures
  let finalY = doc.lastAutoTable.finalY + 15
  if (finalY > 240) {
    doc.addPage()
    finalY = 25
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  doc.text(`Mengetahui,`, 20, finalY)
  doc.text(`Pelatih Ekstrakurikuler`, 20, finalY + 6)
  doc.text(`( ${coachName || '................................'} )`, 20, finalY + 30)

  doc.text(`Jakarta, ${todayStr}`, pageWidth - 70, finalY)
  doc.text(`Koordinator / Admin Ekskul`, pageWidth - 70, finalY + 6)
  doc.text(`( ................................ )`, pageWidth - 70, finalY + 30)

  const filename = `rekap_sesi_${(extracurricular?.name || 'ekskul').toLowerCase().replace(/\s+/g, '_')}_${session?.session_date || 'tanggal'}.pdf`
  doc.save(filename)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/sessionExportHelper.js
git commit -m "feat: add PDF and Excel export utilities for session attendance"
```

---

### Task 3: Integrate Tab "📅 Absensi per Sesi" in `RecapManagement.jsx`

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx`

**Interfaces:**
- Consumes:
  - `computeSessionStudentList` & `formatSessionWhatsAppReport` from `src/utils/sessionAttendanceHelper.js`
  - `exportSessionAttendanceToExcel` & `exportSessionAttendanceToPDF` from `src/utils/sessionExportHelper.js`
- Produces:
  - Tab `sessionAttendance` in `tabs`
  - States: `sessionEkskulId`, `selectedSessionId`, `sessionStatusFilter`, `sessionSearch`
  - Computed session list, session student rows, stats, and interactive UI

- [ ] **Step 1: Add Imports and State Variables**

Import the new helpers:
```javascript
import { computeSessionStudentList, formatSessionWhatsAppReport } from '../../utils/sessionAttendanceHelper'
import { exportSessionAttendanceToExcel, exportSessionAttendanceToPDF } from '../../utils/sessionExportHelper'
```

Add states inside `RecapManagement`:
```javascript
const [sessionEkskulId, setSessionEkskulId] = useState('')
const [selectedSessionId, setSelectedSessionId] = useState('')
const [sessionStatusFilter, setSessionStatusFilter] = useState('all') // 'all' | 'alpha' | 'izin' | 'hadir'
const [sessionSearch, setSessionSearch] = useState('')
```

- [ ] **Step 2: Add tab definition in `tabs` array**

Insert right after `'fillTracking'`:
```javascript
{ id: 'fillTracking', label: 'Tracking Pengisian' },
{ id: 'sessionAttendance', label: '📅 Absensi per Sesi' },
{ id: 'warnings', label: `⚠️ Siswa Bermasalah${warningRows.length > 0 ? ` (${warningRows.length})` : ''}` },
```

- [ ] **Step 3: Add computation for available sessions and auto-selection**

```javascript
// Active extracurriculars list
const activeEkskuls = useMemo(() => {
  return extracurriculars.filter(e => e.is_active)
}, [extracurriculars])

// Default sessionEkskulId when data loads
useEffect(() => {
  if (!sessionEkskulId && activeEkskuls.length > 0) {
    setSessionEkskulId(activeEkskuls[0].id)
  }
}, [activeEkskuls, sessionEkskulId])

// Sessions of currently selected ekskul, sorted newest first
const availableEkskulSessions = useMemo(() => {
  if (!sessionEkskulId) return []
  return sessions
    .filter(s => s.extracurricular_id === sessionEkskulId)
    .sort((a, b) => new Date(b.session_date || 0) - new Date(a.session_date || 0))
}, [sessions, sessionEkskulId])

// Auto-select latest session when ekskul changes
useEffect(() => {
  if (availableEkskulSessions.length > 0) {
    // Pick the newest session that has attendance, or simply newest session
    const newestFilled = availableEkskulSessions.find(s => {
      return attendances.some(a => a.session_id === s.id)
    })
    setSelectedSessionId(newestFilled ? newestFilled.id : availableEkskulSessions[0].id)
  } else {
    setSelectedSessionId('')
  }
}, [availableEkskulSessions])

// Active selected session object
const currentSelectedSession = useMemo(() => {
  return availableEkskulSessions.find(s => s.id === selectedSessionId) || null
}, [availableEkskulSessions, selectedSessionId])

// Active selected ekskul object
const currentSelectedEkskul = useMemo(() => {
  return extracurriculars.find(e => e.id === sessionEkskulId) || null
}, [extracurriculars, sessionEkskulId])

// Coach name of selected session
const currentSessionCoachName = useMemo(() => {
  if (!currentSelectedEkskul) return '-'
  return currentSelectedEkskul.coach?.full_name || currentSelectedEkskul.coach2?.full_name || '-'
}, [currentSelectedEkskul])

// Map of risk evaluations for fast lookup
const studentRiskMap = useMemo(() => {
  const map = {}
  attendanceReportRows.forEach(row => {
    map[row.studentId] = {
      consecutiveAlpha: row.consecutiveAlpha,
      totalAlpha: row.alpha,
      warningLevel: row.warningLevel,
      actionRecommendation: row.actionRecommendation
    }
  })
  return map
}, [attendanceReportRows])

// Computed student list for current session
const sessionRawStudentRows = useMemo(() => {
  if (!currentSelectedSession || !currentSelectedEkskul) return []
  return computeSessionStudentList({
    session: currentSelectedSession,
    extracurricular: currentSelectedEkskul,
    enrollments,
    attendances,
    specialParticipants,
    studentRiskMap
  })
}, [currentSelectedSession, currentSelectedEkskul, enrollments, attendances, specialParticipants, studentRiskMap])

// Stats for current session
const sessionStats = useMemo(() => {
  const total = sessionRawStudentRows.length
  const hadir = sessionRawStudentRows.filter(r => r.status === 'hadir').length
  const izin = sessionRawStudentRows.filter(r => r.status === 'izin').length
  const alpha = sessionRawStudentRows.filter(r => r.status === 'alpha').length
  const pct = total > 0 ? Math.round((hadir / total) * 100) : 0
  return { total, hadir, izin, alpha, pct }
}, [sessionRawStudentRows])

// Filtered student rows (by status pill and search)
const filteredSessionStudentRows = useMemo(() => {
  return sessionRawStudentRows.filter(r => {
    if (sessionStatusFilter === 'alpha' && r.status !== 'alpha') return false
    if (sessionStatusFilter === 'izin' && r.status !== 'izin') return false
    if (sessionStatusFilter === 'hadir' && r.status !== 'hadir') return false

    if (sessionSearch) {
      const q = sessionSearch.toLowerCase()
      const matchName = r.studentName.toLowerCase().includes(q)
      const matchNis = r.nis.includes(q)
      const matchClass = r.class.toLowerCase().includes(q)
      if (!matchName && !matchNis && !matchClass) return false
    }

    return true
  })
}, [sessionRawStudentRows, sessionStatusFilter, sessionSearch])
```

- [ ] **Step 4: Add Action Handlers (WA copy, PDF, Excel)**

```javascript
const handleCopySessionWAReport = () => {
  if (!currentSelectedSession || !currentSelectedEkskul) return
  const absentStudents = sessionRawStudentRows.filter(r => r.status === 'alpha')
  const text = formatSessionWhatsAppReport({
    ekskul: currentSelectedEkskul,
    session: currentSelectedSession,
    coachName: currentSessionCoachName,
    stats: sessionStats,
    absentStudents
  })

  navigator.clipboard.writeText(text)
  soundManager.playCoin()
  toast.success('Format Laporan WhatsApp untuk BK & Kepsek berhasil disalin ke clipboard!', 'Tersalin')
}

const handleExportSessionPDF = () => {
  if (!currentSelectedSession || !currentSelectedEkskul) return
  exportSessionAttendanceToPDF({
    session: currentSelectedSession,
    extracurricular: currentSelectedEkskul,
    coachName: currentSessionCoachName,
    rows: sessionRawStudentRows,
    stats: sessionStats
  })
  soundManager.playCoin()
  toast.success('Dokumen PDF Berita Acara Sesi berhasil diunduh!', 'Sukses')
}

const handleExportSessionExcel = () => {
  if (!currentSelectedSession || !currentSelectedEkskul) return
  exportSessionAttendanceToExcel({
    session: currentSelectedSession,
    extracurricular: currentSelectedEkskul,
    coachName: currentSessionCoachName,
    rows: sessionRawStudentRows,
    stats: sessionStats
  })
  soundManager.playCoin()
  toast.success('File Excel Rekap Sesi berhasil diunduh!', 'Sukses')
}
```

- [ ] **Step 5: Render Tab Content for `activeTab === 'sessionAttendance'`**

Add the JSX rendering block for `sessionAttendance` in `RecapManagement.jsx`:
- Ekskul selector and Session selector dropdowns.
- Session summary cards (Date, Coach, Topic, Notes, Total, Hadir, Izin, and highlighted Alpa card).
- Header action buttons: "Salin Laporan WA (BK & Kepsek)", "Unduh PDF Sesi", "Unduh Excel Sesi".
- Filter status pill tabs (`Semua`, `⚠️ Alpa`, `Izin`, `Hadir`) + Search Input.
- Student table with status badges (`bg-emerald-500/10 text-emerald-400` for hadir, `bg-amber-500/10 text-amber-400` for izin, `bg-rose-500/10 text-rose-400 border border-rose-500/30` for alpa), streak badge (`⚠️ 2x Alpa berturut-turut`), and recommendation note.

- [ ] **Step 6: Verify and Build**

Run: `npm run build`  
Expected: Build succeeds without errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/RecapManagement.jsx
git commit -m "feat: integrate session attendance tab and reporting in RecapManagement"
```

---

### Task 4: Verification and Quality Check

**Files:**
- Test: `tests/sessionAttendanceHelper.test.js`
- App: Build verification and smoke testing

- [ ] **Step 1: Run unit tests**

Run: `node --test tests/sessionAttendanceHelper.test.js`  
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: Vite build succeeds.

- [ ] **Step 3: Verification of Edge Cases**
- Test with an extracurricular with 0 sessions.
- Test with an extracurricular with 0 absent students (100% presence).
- Test copying WA report and verify message text syntax.

- [ ] **Step 4: Final commit**

```bash
git status
```
