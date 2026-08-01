import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  studentId: null,
  isLoading: true,
  _isFetching: false,

  fetchUser: async (silent = false) => {
    if (get()._isFetching) return
    if (!silent) set({ isLoading: true })
    set({ _isFetching: true })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      set({ user: null, role: null, studentId: null, isLoading: false, _isFetching: false })
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, student_id')
      .eq('id', session.user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      set({ user: null, role: null, studentId: null, isLoading: false, _isFetching: false })
      return
    }

    set({ 
      user: session.user, 
      role: userData.role, 
      studentId: userData.student_id, 
      isLoading: false,
      _isFetching: false
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
  },

  // Initialize auth state listener (call once on app mount)
  initAuthListener: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          set({ user: null, role: null, studentId: null, isLoading: false })
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token silently refreshed in background.
          // Just update the user object from the new session — no DB call,
          // no isLoading change, so the current page never blanks out.
          set(state => ({ ...state, user: session.user }))
        }
      }
    )
    return subscription
  },
}))
