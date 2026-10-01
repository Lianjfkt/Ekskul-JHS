import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  studentId: null,
  isLoading: true,
  _isFetching: false,

  fetchUser: async (silent = false, sessionOverride = undefined) => {
    if (get()._isFetching) return
    if (!silent) set({ isLoading: true })
    set({ _isFetching: true })

    try {
      let session = sessionOverride
      if (session === undefined) {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Session error:', sessionError)
        }
        session = data?.session || null
      }

      if (!session) {
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
    } catch (err) {
      console.error('fetchUser error:', err)
      set({ isLoading: false, _isFetching: false })
    }
  },

  login: async (email, password) => {
    set({ isLoading: true })
    const { error } = await supabase.auth.signInWithPassword({
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
      (event, session) => {
        // Defer execution to next tick to avoid blocking Supabase internal events
        setTimeout(async () => {
          if (event === 'SIGNED_OUT' || !session) {
            set({ user: null, role: null, studentId: null, isLoading: false })
          } else if (event === 'SIGNED_IN') {
            await get().fetchUser(true, session)
          } else if (event === 'TOKEN_REFRESHED' && session) {
            set(state => ({ ...state, user: session.user }))
          }
        }, 0)
      }
    )
    return subscription
  },
}))
