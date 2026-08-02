# Session and Attendance Tracking Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new "Tracking Pengisian" (Fill-out Tracking) tab in the admin's `RecapManagement` page, allowing admins to track which extracurriculars have not yet created sessions or recorded student attendance in a custom date range. Provide WhatsApp broadcast template copywriting and Excel export functionality.

**Architecture:** We will extend the existing `RecapManagement.jsx` page by adding states for tracking date range, computing status rows for active extracurriculars, and rendering the tracking interface including status cards, list table, copying utilities, and Excel export.

**Tech Stack:** React, Tailwind CSS, lucide-react (icons), xlsx (excel export), Supabase.

## Global Constraints
- Follow existing premium styling (pixel art/navy theme with bright accents: `bg-pixel-navy`, `bg-pixel-panel`, custom borders).
- Reuse the dynamic imports of `xlsx` for Excel export to keep bundling optimized.

---

### Task 1: Add State and Calculation Logic for Tracking Tab

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx:141-335`

**Interfaces:**
- Consumes: `extracurriculars`, `sessions`, `attendances` from the Supabase fetches already done in `fetchData`.
- Produces: `trackingStartDate`, `trackingEndDate` states, and `fillTrackingRows` computed array.

- [ ] **Step 1: Define date helpers and state variables**
  Add helper functions to calculate the current week's Monday and Sunday at the top of the file or component, and initialize the states:
  ```javascript
  const getMondayOfCurrentWeek = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    monday.setHours(0,0,0,0)
    return monday.toISOString().split('T')[0]
  }

  const getSundayOfCurrentWeek = () => {
    const monday = new Date(getMondayOfCurrentWeek())
    const sunday = new Date(monday.setDate(monday.getDate() + 6))
    sunday.setHours(23,59,59,999)
    return sunday.toISOString().split('T')[0]
  }
  ```
  And inside the component:
  ```javascript
  const [trackingStartDate, setTrackingStartDate] = useState(getMondayOfCurrentWeek())
  const [trackingEndDate, setTrackingEndDate] = useState(getSundayOfCurrentWeek())
  ```

- [ ] **Step 2: Add computed tracking rows**
  Add `fillTrackingRows` useMemo right after `filteredEkskulSummaries`:
  ```javascript
  const fillTrackingRows = useMemo(() => {
    return extracurriculars
      .filter(e => e.is_active)
      .map(e => {
        const ekskulSessions = sessions.filter(s => 
          s.extracurricular_id === e.id && 
          s.session_date >= trackingStartDate && 
          s.session_date <= trackingEndDate
        )
        
        let hasUnfilledAttendance = false
        const sessionDetails = ekskulSessions.map(s => {
          const sessionAttendancesCount = attendances.filter(a => a.session_id === s.id).length
          const isFilled = sessionAttendancesCount > 0
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
  }, [extracurriculars, sessions, attendances, trackingStartDate, trackingEndDate])
  ```

- [ ] **Step 3: Add export to excel function for tracking**
  Add the Excel export trigger:
  ```javascript
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
  ```

- [ ] **Step 4: Commit**
  ```bash
  git commit -am "feat: add backend tracking calculation and excel export"
  ```

---

### Task 2: Implement Copy Utilities (WhatsApp Broadcast templates)

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx`

**Interfaces:**
- Consumes: `fillTrackingRows`, `trackingStartDate`, `trackingEndDate`
- Produces: `copyAllToWhatsApp()`, `copySingleToWhatsApp(row)`

- [ ] **Step 1: Add helper function to format dates**
  Format Date helper:
  ```javascript
  const formatDateIndo = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  ```

- [ ] **Step 2: Add copyAllToWhatsApp handler**
  ```javascript
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
  ```

- [ ] **Step 3: Add copySingleToWhatsApp handler**
  ```javascript
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
  ```

- [ ] **Step 4: Commit**
  ```bash
  git commit -am "feat: implement copy to WhatsApp utilities for tracking"
  ```

---

### Task 3: Render tab content in the UI

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx`

- [ ] **Step 1: Add tab definition**
  Include `'fillTracking'` tab in `tabs` array.
  ```diff
    const tabs = [
     { id: 'overview', label: 'Ringkasan Ekskul' },
  +  { id: 'fillTracking', label: 'Tracking Pengisian' },
     { id: 'warnings', label: `⚠️ Siswa Bermasalah${warningRows.length > 0 ? ` (${warningRows.length})` : ''}` },
  ```

- [ ] **Step 2: Add routing for activeTab in controls and export logic**
  Update date input render conditions so that `trackingStartDate` and `trackingEndDate` inputs are shown only when active tab is `'fillTracking'`.
  Update Excel Export button click handler to call `exportTrackingToExcel` when `activeTab === 'fillTracking'`.

- [ ] **Step 3: Implement Tracking Tab Layout**
  Render the complete tracking interface, including:
  - Stats Cards (Total Active, Belum Sesi, Belum Absen, Lengkap).
  - Date picker filters (Start Date & End Date).
  - WhatsApp broadcast button.
  - Table listing all rows with search functionality.
  - Badge styles for statuses (`bg-red-900/30 text-red-300`, `bg-amber-900/30 text-amber-300`, `bg-emerald-900/30 text-emerald-300`).
  - Copy action buttons.

- [ ] **Step 4: Commit**
  ```bash
  git commit -am "feat: render tracking UI tab and buttons in dashboard"
  ```
