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
      const student = en.student || en.students
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
      const streakDiff = (b.consecutiveAlpha || 0) - (a.consecutiveAlpha || 0)
      if (streakDiff !== 0) {
        return streakDiff
      }
      const totalDiff = (b.totalAlpha || 0) - (a.totalAlpha || 0)
      if (totalDiff !== 0) {
        return totalDiff
      }
    }
    return (a.studentName || '').localeCompare(b.studentName || '')
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
    ? new Date(
        session.session_date.includes('T')
          ? session.session_date
          : `${session.session_date}T00:00:00`
      ).toLocaleDateString('id-ID', {
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
