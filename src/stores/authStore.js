import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  studentId: null,
  isLoading: true,

  fetchUser: async () => {
    set({ isLoading: true })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      set({ user: null, role: null, studentId: null, isLoading: false })
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, student_id')
      .eq('id', session.user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      set({ user: null, role: null, studentId: null, isLoading: false })
      return
    }

    set({ 
      user: session.user, 
      role: userData.role, 
      studentId: userData.student_id, 
      isLoading: false 
    })
  },

  login: async (email, password) => {
    set({ isLoading: true })
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      set({ isLoading: false })
      throw error
    }

    // After successful login, fetch the extended user data
    await get().fetchUser()
  },

  logout: async () => {
    set({ isLoading: true })
    await supabase.auth.signOut()
    set({ user: null, role: null, studentId: null, isLoading: false })
  }
}))
