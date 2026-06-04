import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/authStore'

export const useParentChildren = create((set, get) => ({
  children: [],
  selectedChild: null,
  loading: false,
  
  setSelectedChild: (child) => set({ selectedChild: child }),
  
  fetchChildren: async (userId, userFullName, fallbackStudentId) => {
    set({ loading: true })
    try {
      let studentIds = []

      // Try parents table: find all records where full_name matches this user
      const { data: parentRecords } = await supabase
        .from('parents')
        .select('student_id, relationship')
        .ilike('full_name', userFullName || '')

      if (parentRecords && parentRecords.length > 0) {
        studentIds = parentRecords.map(p => p.student_id)
      } else if (fallbackStudentId) {
        // Fallback: use the student_id linked directly in users table
        studentIds = [fallbackStudentId]
      }

      if (studentIds.length === 0) {
        set({ children: [], loading: false })
        return
      }

      // Fetch student profiles
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds)

      if (error) throw error

      const childList = students || []
      set({ children: childList })
      
      // If we don't have a selected child or it's not in the new list, pick the first
      const currentSelected = get().selectedChild
      if (childList.length > 0 && (!currentSelected || !childList.find(c => c.id === currentSelected.id))) {
        set({ selectedChild: childList[0] })
      }
    } catch (err) {
      console.error('useParentChildren error:', err)
    } finally {
      set({ loading: false })
    }
  }
}))
