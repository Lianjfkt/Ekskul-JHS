import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'

export function useStudentProfile() {
  const { studentId, user } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (studentId) {
      fetchProfile(studentId)
    } else {
      setLoading(false)
    }
  }, [studentId])

  const fetchProfile = async (sid) => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('students')
        .select('*')
        .eq('id', sid)
        .single()
      if (err) throw err
      setProfile(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { profile, loading, error }
}
