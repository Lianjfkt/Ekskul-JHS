import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAttendanceSummary(studentId, extracurricularId) {
  const [summary, setSummary] = useState({ hadir: 0, izin: 0, alpha: 0, total: 0, percentage: 0 })
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAttendance = useCallback(async () => {
    if (!studentId || !extracurricularId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // 1. Get student's class to check target_class
      const { data: studentData } = await supabase
        .from('students')
        .select('class')
        .eq('id', studentId)
        .single()

      const studentClass = studentData?.class || ''

      // 2. Get all sessions for the extracurricular
      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select('id, session_date, topic, is_special_training, target_class, attendance_submitted')
        .eq('extracurricular_id', extracurricularId)
        .order('session_date', { ascending: false })

      if (sErr) throw sErr

      if (!sessions || sessions.length === 0) {
        setSummary({ hadir: 0, izin: 0, alpha: 0, total: 0, percentage: 0 })
        setAttendances([])
        setLoading(false)
        return
      }

      const sessionIds = sessions.map(s => s.id)
      const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]))

      // 3. Get attendances and special participants for those sessions
      const [attRes, spRes] = await Promise.all([
        supabase
          .from('attendances')
          .select('id, session_id, status, notes, recorded_at')
          .eq('student_id', studentId)
          .in('session_id', sessionIds),
        supabase
          .from('special_session_participants')
          .select('session_id')
          .eq('student_id', studentId)
          .in('session_id', sessionIds)
      ])

      if (attRes.error) throw attRes.error

      const specialSessionIds = new Set((spRes.data || []).map(sp => sp.session_id))
      const attMap = Object.fromEntries((attRes.data || []).map(a => [a.session_id, a]))

      // Sesi yang valid untuk siswa ini
      const validSessions = sessions.filter(s => {
        const hasAtt = attMap[s.id] !== undefined
        if (!s.attendance_submitted && !hasAtt) return false
        if (s.is_special_training && !specialSessionIds.has(s.id)) return false
        if (s.target_class && s.target_class !== 'all') {
          const targetClasses = s.target_class.split(',')
          if (!studentClass || !targetClasses.some(tc => studentClass.trim().startsWith(tc.trim()))) return false
        }
        return true
      })

      const enriched = validSessions.map(s => {
        const att = attMap[s.id]
        return {
          id: att?.id || `virtual-${s.id}`,
          session_id: s.id,
          student_id: studentId,
          status: att ? att.status : 'alpha',
          notes: att?.notes || '',
          recorded_at: att?.recorded_at || null,
          session: s
        }
      })

      // Sort by session_date descending
      enriched.sort((a, b) => new Date(b.session?.session_date) - new Date(a.session?.session_date))

      setAttendances(enriched)

      const hadir = enriched.filter(a => a.status === 'hadir').length
      const izin = enriched.filter(a => a.status === 'izin').length
      const alpha = enriched.filter(a => a.status === 'alpha').length
      const total = enriched.length
      const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0

      setSummary({ hadir, izin, alpha, total, percentage })
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
