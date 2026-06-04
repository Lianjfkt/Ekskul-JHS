import { supabase } from '../lib/supabaseClient'

const LOCAL_STORAGE_KEY = 'ekskul_announcements'

// Fallback local memory storage for the current session if localstorage is unavailable
let memoryAnnouncements = [
  {
    id: 'local-welcome',
    title: 'Selamat Datang di Aplikasi Ekskul JHS GM!',
    content: 'Selamat bergabung di portal ekstrakurikuler sekolah. Temukan pengumuman terbaru dan jadwal kegiatan ekskul Anda di sini.',
    is_active: true,
    created_at: new Date().toISOString(),
  }
]

export const announcementService = {
  async getAnnouncements() {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          users:created_by (full_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    } catch (err) {
      console.warn('Using LocalStorage fallback for announcements:', err.message)
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (localData) {
        try {
          return JSON.parse(localData)
        } catch {
          return memoryAnnouncements
        }
      }
      return memoryAnnouncements
    }
  },

  async getAllAnnouncements() {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          users:created_by (full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    } catch (err) {
      console.warn('Using LocalStorage fallback for admin announcements:', err.message)
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (localData) {
        try {
          return JSON.parse(localData)
        } catch {
          return memoryAnnouncements
        }
      }
      return memoryAnnouncements
    }
  },

  async createAnnouncement(title, content, userId) {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert([{ title, content, is_active: true, created_by: userId }])
        .select()

      if (error) throw error
      return data[0]
    } catch (err) {
      console.warn('Saving announcement to LocalStorage:', err.message)
      const newAnn = {
        id: `local-${Date.now()}`,
        title,
        content,
        is_active: true,
        created_by: userId,
        created_at: new Date().toISOString()
      }
      const activeList = await this.getAllAnnouncements()
      const updatedList = [newAnn, ...activeList]
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList))
      return newAnn
    }
  },

  async toggleAnnouncementStatus(id, isActive) {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()

      if (error) throw error
      return data[0]
    } catch (err) {
      console.warn('Updating announcement in LocalStorage:', err.message)
      const activeList = await this.getAllAnnouncements()
      const updatedList = activeList.map(ann => {
        if (ann.id === id) {
          return { ...ann, is_active: isActive }
        }
        return ann
      })
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList))
      return { id, is_active: isActive }
    }
  },

  async deleteAnnouncement(id) {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    } catch (err) {
      console.warn('Deleting announcement from LocalStorage:', err.message)
      const activeList = await this.getAllAnnouncements()
      const updatedList = activeList.filter(ann => ann.id !== id)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList))
      return true
    }
  }
}
