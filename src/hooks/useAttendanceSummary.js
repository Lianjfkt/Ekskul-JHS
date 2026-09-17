import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { evaluateAttendanceRisk, isSessionApplicableToStudent } from '../utils/attendanceRiskEngine'

export function useAttendanceSummary(studentId, extracurricularId) {
  const [summary, setSummary] = useState({
    hadir: 0,
    izin: 0,
    alpha: 0,
    total: 0,
    percentage: 0,
    consecutiveAlpha: 0,
    warningLevel: null,
    warningLabel: 'AMAN',
    warningReasons: [],
    isAtRisk: false
  })
  const [attendances, setAttendances] = useState([])
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAttendance = useCallback(async () => {
    if (!studentId || !extracurricularId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // 1. Get student & extracurricular info
      const [studentRes, ekskulRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, class, nis')
          .eq('id', studentId)
          .single(),
        supabase
          .from('extracurriculars')
          .select('id, name, is_mandatory, mandatory_class')
          .eq('id', extracurricularId)
          .single()
      ])

      const student = studentRes.data || { id: studentId }
      const ekskul = ekskulRes.data || { id: extracurricularId }

      // 2. Get all sessions for the extracurricular
      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select('id, session_date, topic, is_special_training, target_class, attendance_submitted')
        .eq('extracurricular_id', extracurricularId)
        .order('session_date', { ascending: false })

      if (sErr) throw sErr

      if (!sessions || sessions.length === 0) {
        setSummary({
          hadir: 0,
          izin: 0,
          alpha: 0,
          total: 0,
          percentage: 0,
          consecutiveAlpha: 0,
          warningLevel: null,
          warningLabel: 'AMAN',
          warningReasons: [],
          isAtRisk: false
        })
        setAttendances([])
        setRisk(null)
        setLoading(false)
        return
      }

      const sessionIds = sessions.map(s => s.id)

      // 3. Get attendances and special participants for those sessions
      const [attRes, spRes] = await Promise.all([
        supabase
          .from('attendances')
          .select('id, session_id, status, notes, recorded_at')
          .eq('student_id', studentId)
          .in('session_id', sessionIds),
        supabase
          .from('special_session_participants')
          .select('session_id, student_id')
          .eq('student_id', studentId)
          .in('session_id', sessionIds)
      ])

      if (attRes.error) throw attRes.error

      const rawAttendances = attRes.data || []
      const specialParticipants = spRes.data || []
      const attMap = Object.fromEntries(rawAttendances.map(a => [a.session_id, a]))

      // Sesi yang valid untuk siswa ini dengan engine
      const validSessions = sessions.filter(s =>
        isSessionApplicableToStudent(s, student, specialParticipants, rawAttendances)
      )

      // HANYA sertakan sesi yang memiliki record absensi ASLI di database
      const enriched = validSessions
        .filter(s => attMap[s.id] !== undefined)
        .map(s => {
          const att = attMap[s.id]
          return {
            id: att.id,
            session_id: s.id,
            student_id: studentId,
            status: att.status,
            notes: att.notes || '',
            recorded_at: att.recorded_at || null,
            session: s
          }
        })

      // Sort by session_date descending
      enriched.sort((a, b) => new Date(b.session?.session_date) - new Date(a.session?.session_date))

      setAttendances(enriched)

      // Hitung risiko menggunakan centralized engine
      const riskEvaluation = evaluateAttendanceRisk({
        student,
        ekskul,
        studentAtts: enriched,
        validSessions
      })

      setRisk(riskEvaluation)
      setSummary({
        hadir: riskEvaluation.hadir,
        izin: riskEvaluation.izin,
        alpha: riskEvaluation.alpha,
        total: riskEvaluation.total,
        percentage: riskEvaluation.percentage,
        consecutiveAlpha: riskEvaluation.consecutiveAlpha,
        maxConsecutiveAlpha: riskEvaluation.maxConsecutiveAlpha,
        warningLevel: riskEvaluation.warningLevel,
        warningLabel: riskEvaluation.warningLabel,
        warningReasons: riskEvaluation.warningReasons,
        riskTags: riskEvaluation.riskTags,
        isAtRisk: riskEvaluation.isAtRisk,
        isMandatory: riskEvaluation.isMandatory
      })
    } catch (err) {
      console.error('useAttendanceSummary error:', err)
    } finally {
      setLoading(false)
    }
  }, [studentId, extracurricularId])

  useEffect(() => {
    fetchAttendance()

    if (!studentId) return

    // Realtime subscription
    const channel = supabase
      .channel(`attendance-${studentId}-${extracurricularId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendances',
        filter: `student_id=eq.${studentId}`
      }, () => fetchAttendance())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAttendance, studentId, extracurricularId])

  return { summary, attendances, loading, refetch: fetchAttendance }
}
