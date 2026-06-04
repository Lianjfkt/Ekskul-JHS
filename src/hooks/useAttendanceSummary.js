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
      // 1. Get all sessions for the extracurricular
      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select('id, session_date, topic')
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

      // 2. Get attendances for those sessions for this student
      const { data: attData, error: aErr } = await supabase
        .from('attendances')
        .select('id, session_id, status, notes, recorded_at')
        .eq('student_id', studentId)
        .in('session_id', sessionIds)

      if (aErr) throw aErr

      // Merge session info into attendance records
      const enriched = (attData || []).map(a => ({
        ...a,
        session: sessionMap[a.session_id]
      }))

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
