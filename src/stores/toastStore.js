import { create } from 'zustand'
import { soundManager } from '../utils/soundEffects'

let toastCounter = 0

export const useToastStore = create((set, get) => ({
  toasts: [],

  addToast: ({ title, message, type = 'info', duration = 3500 }) => {
    const id = ++toastCounter
    const newToast = { id, title, message, type, duration }

    // Play retro sound based on type
    if (type === 'success') {
      soundManager.playSuccess()
    } else if (type === 'error') {
      soundManager.playError()
    } else {
      soundManager.playBlip()
    }

    set((state) => ({
      toasts: [...state.toasts, newToast]
    }))

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }

    return id
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },

  clearAll: () => set({ toasts: [] })
}))

// Convenient global helper
export const toast = {
  success: (message, title = 'Sukses!') => {
    return useToastStore.getState().addToast({ title, message, type: 'success' })
  },
  error: (message, title = 'Terjadi Kesalahan!') => {
    return useToastStore.getState().addToast({ title, message, type: 'error' })
  },
  info: (message, title = 'Informasi') => {
    return useToastStore.getState().addToast({ title, message, type: 'info' })
  },
  warning: (message, title = 'Peringatan!') => {
    return useToastStore.getState().addToast({ title, message, type: 'warning' })
  }
}

