import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useGrades(studentId, semesterFilter = null) {
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGrades = useCallback(async () => {
    if (!studentId) { setLoading(false); return }
    setLoading(true)
    try {
      let query = supabase
        .from('grades')
        .select(`
          id, semester, academic_year,
          attitude_score, skill_score, activity_score, notes, graded_at,
          extracurriculars(id, name, schedule, description)
        `)
        .eq('student_id', studentId)
        .order('graded_at', { ascending: false })

      if (semesterFilter) {
        query = query.eq('semester', semesterFilter)
      }

      const { data, error } = await query
      if (error) throw error

      const enriched = (data || []).map(g => {
        const avg = Math.round(
          ((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3
        )
        let predikat = 'D'
        if (avg >= 90) predikat = 'A'
        else if (avg >= 75) predikat = 'B'
        else if (avg >= 60) predikat = 'C'
        return { ...g, avg, predikat }
      })

      setGrades(enriched)
    } catch (err) {
      console.error('useGrades error:', err)
    } finally {
      setLoading(false)
    }
  }, [studentId, semesterFilter])

  useEffect(() => {
    fetchGrades()

    if (!studentId) return

    const channel = supabase
      .channel(`grades-${studentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'grades',
        filter: `student_id=eq.${studentId}`
      }, () => fetchGrades())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchGrades, studentId])

  return { grades, loading, refetch: fetchGrades }
}
