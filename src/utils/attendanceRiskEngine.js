/**
 * Attendance Risk Engine
 * Engine terpusat untuk mendeteksi siswa yang berisiko / jarang hadir / sering alpa
 * Menjadi Single Source of Truth bagi Admin, Coach, Compliance, dan Parent views.
 */

/**
 * Cek apakah suatu sesi berlaku bagi siswa tertentu berdasarkan target kelas & sesi khusus.
 * @param {Object} session - Objek sesi { id, is_special_training, target_class, attendance_submitted }
 * @param {Object} student - Objek siswa { id, class } atau string studentId / studentClass
 * @param {Array} specialParticipants - Daftar peserta khusus [{ session_id, student_id }]
 * @param {Array} attendances - Daftar record absensi (opsional, untuk cek apakah sesi sudah ada absensinya)
 * @returns {boolean}
 */
export function isSessionApplicableToStudent(session, student, specialParticipants = [], attendances = []) {
  if (!session) return false

  const studentId = typeof student === 'object' ? student.id : student
  const studentClass = typeof student === 'object' ? student.class : ''

  // 1. Cek apakah sesi sudah ada absensi / disubmit
  const hasAtt = Array.isArray(attendances) && attendances.some(a => a.session_id === session.id)
  if (!session.attendance_submitted && !hasAtt) {
    return false
  }

  // 2. Cek undangan latihan khusus
  if (session.is_special_training) {
    const isInvited = specialParticipants.some(
      sp => sp.session_id === session.id && sp.student_id === studentId
    )
    if (!isInvited) return false
  }

  // 3. Cek target kelas
  if (session.target_class && session.target_class !== 'all') {
    if (!studentClass) return false
    const targetClasses = session.target_class.split(',').map(tc => tc.trim().toLowerCase())
    const normalizedStudentClass = studentClass.trim().toLowerCase()
    const isTarget = targetClasses.some(tc => normalizedStudentClass.startsWith(tc))
    if (!isTarget) return false
  }

  return true
}

/**
 * Hitung alpa berturut-turut terkini (trailing consecutive alpha).
 * Dimulai dari sesi valid terbaru ke belakang sampai menemukan hadir/izin.
 * Sesi yang sudah terlaksana tanpa catatan hadir/izin dihitung sebagai ketidakhadiran (alpa).
 * @param {Array} studentAtts - Record absensi siswa
 * @param {Array} validSessions - Sesi valid terurut (bisa ascending atau descending)
 * @returns {number}
 */
export function calculateTrailingConsecutiveAlpha(studentAtts, validSessions) {
  if (!validSessions || validSessions.length === 0) {
    return 0
  }

  // Pastikan terurut dari terbaru ke terlama (descending date)
  const sortedDesc = [...validSessions].sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
  const attMap = new Map((studentAtts || []).map(a => [a.session_id, a]))

  let consecutive = 0
  for (const session of sortedDesc) {
    const att = attMap.get(session.id)
    if (att) {
      if (att.status === 'alpha') {
        consecutive++
      } else {
        // Hadir / Izin / Sakit memutus rangkaian alpa
        break
      }
    } else {
      // Sesi yang sudah terlaksana tapi siswa tidak ada record hadir/izin = alpa
      consecutive++
    }
  }

  return consecutive
}

/**
 * Hitung alpa berturut-turut maksimum sepanjang sejarah (historical max).
 * @param {Array} studentAtts - Record absensi siswa
 * @param {Array} validSessions - Sesi valid terurut
 * @returns {number}
 */
export function calculateMaxHistoricalConsecutiveAlpha(studentAtts, validSessions) {
  if (!validSessions || validSessions.length === 0) {
    return 0
  }

  // Terurut kronologis (ascending date)
  const sortedAsc = [...validSessions].sort((a, b) => new Date(a.session_date) - new Date(b.session_date))
  const attMap = new Map((studentAtts || []).map(a => [a.session_id, a]))

  let maxStreak = 0
  let currentStreak = 0

  for (const session of sortedAsc) {
    const att = attMap.get(session.id)
    if (att) {
      if (att.status === 'alpha') {
        currentStreak++
        if (currentStreak > maxStreak) maxStreak = currentStreak
      } else {
        currentStreak = 0
      }
    } else {
      currentStreak++
      if (currentStreak > maxStreak) maxStreak = currentStreak
    }
  }

  return maxStreak
}

/**
 * Evaluasi status risiko absensi siswa untuk 1 kegiatan ekstrakurikuler.
 * Menggunakan standar laporan resmi sekolah (Wali Kelas, BK, Kesiswaan, Kepala Sekolah).
 * 
 * @param {Object} params
 * @param {Object} params.student - { id, full_name, class, nis }
 * @param {Object} params.ekskul - { id, name, is_mandatory, mandatory_class }
 * @param {Array} params.studentAtts - Record absensi siswa untuk ekskul ini
 * @param {Array} params.validSessions - Daftar sesi valid yang relevan untuk siswa ini
 * @returns {Object} Hasil evaluasi risiko lengkap
 */
export function evaluateAttendanceRisk({
  student,
  ekskul,
  studentAtts = [],
  validSessions = []
}) {
  const hadir = studentAtts.filter(a => a.status === 'hadir').length
  const izin = studentAtts.filter(a => a.status === 'izin').length
  const recordedAlpha = studentAtts.filter(a => a.status === 'alpha').length
  
  // Total sesi yang wajib diikuti siswa adalah seluruh sesi terlaksana yang valid untuk siswa ini
  const totalSessions = validSessions.length
  
  // Sesi yang sudah terlaksana tapi tidak ada record absensi dianggap tidak hadir (alpa)
  const unrecordedAlpha = Math.max(0, totalSessions - (hadir + izin + recordedAlpha))
  const alpha = recordedAlpha + unrecordedAlpha

  // Total pertemuan yang dihitung adalah seluruh sesi yang terlaksana
  const total = totalSessions

  // Persentase kehadiran riil
  const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0
  const consecutiveAlpha = calculateTrailingConsecutiveAlpha(studentAtts, validSessions)
  const maxConsecutiveAlpha = calculateMaxHistoricalConsecutiveAlpha(studentAtts, validSessions)

  // Tentukan apakah ekskul ini wajib
  const isMandatory = Boolean(ekskul?.is_mandatory)

  let warningLevel = null // 'TEGURAN' | 'PERINGATAN' | null (Aman)
  let warningLabel = ''
  let warningReasons = []
  let actionRecommendation = 'Pertahankan keaktifan dan kehadiran.'
  const riskTags = []

  // Jika belum ada sesi yang terlaksana sama sekali
  if (total === 0) {
    return {
      warningLevel: null,
      warningLabel: 'BELUM_ADA_SESI',
      warningReasons: [],
      actionRecommendation: 'Belum ada sesi latihan terlaksana.',
      riskTags: [],
      isAtRisk: false,
      hadir: 0,
      izin: 0,
      alpha: 0,
      recordedAlpha: 0,
      unrecordedAlpha: 0,
      total: 0,
      percentage: 0,
      consecutiveAlpha: 0,
      maxConsecutiveAlpha: 0,
      isMandatory
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ATURAN EVALUASI RISIKO (Wajib vs Pilihan)
  // ──────────────────────────────────────────────────────────────────────────

  if (isMandatory) {
    // 🔴 EKSKUL WAJIB (Pramuka / Karate / Taekwondo - Standar Min. 80%)

    const isCriticalStreak = consecutiveAlpha >= 2
    const isCriticalTotalAlpha = alpha >= 3
    const isCriticalPercentage = percentage < 70
    const isPassiveStudent = total >= 4 && hadir <= 1

    const isWarningTotalAlpha = alpha >= 1 && alpha < 3
    const isWarningPercentage = percentage >= 70 && percentage < 80

    if (isCriticalStreak || isCriticalTotalAlpha || isCriticalPercentage || isPassiveStudent) {
      warningLevel = 'TEGURAN'
      warningLabel = 'TEGURAN'
      actionRecommendation = 'Panggil Siswa & Orang Tua ke Ruang BK / Terbitkan Surat Peringatan (SP).'

      if (isCriticalStreak) {
        warningReasons.push(`${consecutiveAlpha}x Alpa Berturut-turut`)
        riskTags.push('STREAK_ALPHA')
      }
      if (isCriticalTotalAlpha && !isCriticalStreak) {
        warningReasons.push(`Total ${alpha}x Alpa`)
        riskTags.push('HIGH_ALPHA')
      }
      if (isCriticalPercentage) {
        warningReasons.push(`Kehadiran ${percentage}% (Kritis, min. 80%)`)
        riskTags.push('LOW_ATTENDANCE')
      }
      if (isPassiveStudent && !isCriticalPercentage) {
        warningReasons.push(`Partisipasi sangat minim (Hadir ${hadir} dari ${total} sesi)`)
        riskTags.push('PASSIVE_STUDENT')
      }
    } else if (isWarningTotalAlpha || isWarningPercentage) {
      warningLevel = 'PERINGATAN'
      warningLabel = 'PERINGATAN'
      actionRecommendation = 'Pembinaan & Konfirmasi Kehadiran oleh Wali Kelas & Pelatih.'

      if (isWarningTotalAlpha) {
        warningReasons.push(`${alpha}x Alpa`)
        riskTags.push('ALPHA_DETECTED')
      }
      if (isWarningPercentage) {
        warningReasons.push(`Kehadiran ${percentage}% (Target min. 80%)`)
        riskTags.push('MODERATE_ATTENDANCE')
      }
    }
  } else {
    // 🔵 EKSKUL PILIHAN (Standar Min. 70%)

    const isCriticalStreak = consecutiveAlpha >= 4
    const isCriticalTotalAlpha = alpha >= 5
    const isCriticalPercentage = percentage < 55
    const isPassiveStudent = total >= 5 && hadir <= 1

    const isWarningStreak = consecutiveAlpha >= 2 && consecutiveAlpha < 4
    const isWarningTotalAlpha = alpha >= 3 && alpha < 5
    const isWarningPercentage = percentage >= 55 && percentage < 70

    if (isCriticalStreak || isCriticalTotalAlpha || isCriticalPercentage || isPassiveStudent) {
      warningLevel = 'TEGURAN'
      warningLabel = 'TEGURAN'
      actionRecommendation = 'Panggilan BK & Klarifikasi Komitmen / Pengunduran Diri Ekskul.'

      if (isCriticalStreak) {
        warningReasons.push(`${consecutiveAlpha}x Alpa Berturut-turut`)
        riskTags.push('STREAK_ALPHA')
      }
      if (isCriticalTotalAlpha && !isCriticalStreak) {
        warningReasons.push(`Total ${alpha}x Alpa`)
        riskTags.push('HIGH_ALPHA')
      }
      if (isCriticalPercentage) {
        warningReasons.push(`Kehadiran ${percentage}% (Sangat rendah, target 70%)`)
        riskTags.push('LOW_ATTENDANCE')
      }
      if (isPassiveStudent && !isCriticalPercentage) {
        warningReasons.push(`Partisipasi minim (Hadir ${hadir} dari ${total} sesi)`)
        riskTags.push('PASSIVE_STUDENT')
      }
    } else if (isWarningStreak || isWarningTotalAlpha || isWarningPercentage) {
      warningLevel = 'PERINGATAN'
      warningLabel = 'PERINGATAN'
      actionRecommendation = 'Konfirmasi Keaktifan Siswa oleh Wali Kelas & Pelatih.'

      if (isWarningStreak) {
        warningReasons.push(`${consecutiveAlpha}x Alpa Berturut-turut`)
        riskTags.push('STREAK_ALPHA')
      }
      if (isWarningTotalAlpha && !isWarningStreak) {
        warningReasons.push(`${alpha}x Alpa`)
        riskTags.push('ALPHA_DETECTED')
      }
      if (isWarningPercentage) {
        warningReasons.push(`Kehadiran ${percentage}% (Di bawah target 70%)`)
        riskTags.push('MODERATE_ATTENDANCE')
      }
    }
  }

  // Fallback jika berisiko tapi belum terisi alasan
  if (warningLevel && warningReasons.length === 0) {
    if (alpha > 0) warningReasons.push(`${alpha}x Alpa`)
    if (percentage < (isMandatory ? 80 : 70)) {
      warningReasons.push(`Kehadiran ${percentage}%`)
    }
  }

  return {
    warningLevel,
    warningLabel: warningLevel || 'AMAN',
    warningReasons,
    actionRecommendation,
    riskTags,
    isAtRisk: warningLevel !== null,
    hadir,
    izin,
    alpha,
    recordedAlpha,
    unrecordedAlpha,
    total,
    percentage,
    consecutiveAlpha,
    maxConsecutiveAlpha,
    isMandatory
  }
}

/**
 * Filter dan proses seluruh siswa bermasalah secara batch.
 * 
 * @param {Object} params
 * @param {Array} params.enrollments - Daftar enrollments
 * @param {Array} params.extracurriculars - Daftar ekskul
 * @param {Array} params.sessions - Daftar sesi
 * @param {Array} params.attendances - Daftar absensi
 * @param {Array} params.specialParticipants - Daftar peserta khusus
 * @returns {Array} List data baris siswa dengan status risiko lengkap
 */
export function processBatchAttendanceReport({
  enrollments = [],
  extracurriculars = [],
  sessions = [],
  attendances = [],
  specialParticipants = []
}) {
  const ekskulMap = new Map(extracurriculars.map(e => [e.id, e]))
  const results = []

  for (const en of enrollments) {
    const student = en.student || en.students
    const ekskulId = en.extracurricular_id
    const ekskul = en.extracurricular || en.extracurriculars || ekskulMap.get(ekskulId)

    if (!student || !ekskul) continue

    // Sesi ekskul ini yang valid untuk siswa ini
    const validSessions = sessions.filter(s => {
      if (s.extracurricular_id !== ekskulId) return false
      return isSessionApplicableToStudent(s, student, specialParticipants, attendances)
    })

    const validSessionIds = new Set(validSessions.map(s => s.id))
    const studentAtts = attendances.filter(
      a => a.student_id === student.id && validSessionIds.has(a.session_id)
    )

    const risk = evaluateAttendanceRisk({
      student,
      ekskul,
      studentAtts,
      validSessions
    })

    results.push({
      id: `${student.id}-${ekskul.id}`,
      studentId: student.id,
      nis: student.nis || '-',
      studentName: student.full_name,
      class: student.class || '-',
      ekskulId: ekskul.id,
      ekskulName: ekskul.name,
      semester: en.semester || '-',
      academicYear: en.academic_year || '-',
      isMandatory: risk.isMandatory,
      mandatoryClass: ekskul.mandatory_class || null,
      hadir: risk.hadir,
      izin: risk.izin,
      alpha: risk.alpha,
      total: risk.total,
      percentage: risk.percentage,
      consecutiveAlpha: risk.consecutiveAlpha,
      maxConsecutiveAlpha: risk.maxConsecutiveAlpha,
      warningLevel: risk.warningLevel,
      warningLabel: risk.warningLabel,
      warningReasons: risk.warningReasons,
      actionRecommendation: risk.actionRecommendation,
      riskTags: risk.riskTags,
      isAtRisk: risk.isAtRisk
    })
  }

  return results
}
