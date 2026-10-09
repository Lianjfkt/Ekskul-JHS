import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

let inFlightFetchPromise = null

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  studentId: null,
  fullName: null,
  isLoading: true,
  _isFetching: false,

  fetchUser: async (silent = false, sessionOverride = undefined) => {
    // If a fetch is already in flight, reuse the same promise to prevent race conditions
    if (inFlightFetchPromise) {
      return inFlightFetchPromise
    }

    if (!silent) set({ isLoading: true })
    set({ _isFetching: true })

    inFlightFetchPromise = (async () => {
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
          set({ user: null, role: null, studentId: null, fullName: null, isLoading: false, _isFetching: false })
          return null
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, student_id, full_name')
          .eq('id', session.user.id)
          .single()

        if (userError) {
          console.error('Error fetching user data:', userError)
          set({ user: null, role: null, studentId: null, fullName: null, isLoading: false, _isFetching: false })
          return null
        }

        const nextState = { 
          user: session.user, 
          role: userData.role, 
          studentId: userData.student_id,
          fullName: userData.full_name,
          isLoading: false,
          _isFetching: false
        }

        set(nextState)
        return nextState
      } catch (err) {
        console.error('fetchUser error:', err)
        set({ isLoading: false, _isFetching: false })
        return null
      } finally {
        inFlightFetchPromise = null
      }
    })()

    return inFlightFetchPromise
  },

  login: async (email, password) => {
    set({ isLoading: true })
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      set({ isLoading: false })
      throw error
    }

    // Explicitly pass session to fetchUser so user data is instantly loaded without waiting
    const userResult = await get().fetchUser(false, authData?.session)
    return userResult || { user: authData?.user, role: get().role }
  },

  logout: async () => {
    set({ isLoading: true })
    inFlightFetchPromise = null
    await supabase.auth.signOut()
    set({ user: null, role: null, studentId: null, fullName: null, isLoading: false })
  },

  // Initialize auth state listener (call once on app mount)
  initAuthListener: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Defer execution to next tick to avoid blocking Supabase internal events
        setTimeout(async () => {
          if (event === 'SIGNED_OUT' || !session) {
            inFlightFetchPromise = null
            set({ user: null, role: null, studentId: null, fullName: null, isLoading: false, _isFetching: false })
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
