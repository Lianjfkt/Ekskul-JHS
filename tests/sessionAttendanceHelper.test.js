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

  it('marks unsubmitted sessions without attendance records as unmarked', () => {
    const session = {
      id: 'sess-2',
      extracurricular_id: 'ekskul-1',
      session_date: '2026-11-20',
      topic: 'Strategi Tim',
      attendance_submitted: false
    }
    const extracurricular = { id: 'ekskul-1', name: 'Futsal' }
    const enrollments = [
      { student_id: 's1', extracurricular_id: 'ekskul-1', student: { id: 's1', full_name: 'Ahmad', class: '8-B', nis: '1001' } }
    ]

    const attendances = [
      { session_id: 'sess-2', student_id: 's2', status: 'hadir' }
    ]

    const result = computeSessionStudentList({
      session,
      extracurricular,
      enrollments,
      attendances,
      specialParticipants: [],
      studentRiskMap: {}
    })

    assert.equal(result.length, 1)
    assert.equal(result[0].status, 'unmarked')
  })

  it('returns empty array when session or extracurricular is missing', () => {
    assert.deepEqual(computeSessionStudentList({}), [])
    assert.deepEqual(computeSessionStudentList({ session: null, extracurricular: { id: '1' } }), [])
    assert.deepEqual(computeSessionStudentList({ session: { id: '1' }, extracurricular: null }), [])
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

  it('formats WhatsApp message properly when no students are absent', () => {
    const ekskul = { name: 'Pramuka' }
    const session = { session_date: '2026-11-16', topic: 'Simpul & Tali' }
    const coachName = 'Kak Joni'
    const stats = { hadir: 20, izin: 2, alpha: 0, total: 22, pct: 91 }

    const text = formatSessionWhatsAppReport({
      ekskul,
      session,
      coachName,
      stats,
      absentStudents: []
    })

    assert.match(text, /Seluruh siswa hadir \/ izin tertib\. Tidak ada siswa alpa pada sesi ini\./)
  })
})
