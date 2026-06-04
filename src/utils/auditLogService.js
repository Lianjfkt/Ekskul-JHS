import { supabase } from '../lib/supabaseClient'

const LOCAL_STORAGE_KEY = 'ekskul_audit_logs'

export const auditLogService = {
  async logEvent(userId, email, action, details) {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          user_id: userId || null,
          user_email: email || 'system@sekolah.com',
          action,
          details: typeof details === 'object' ? JSON.stringify(details) : details,
          ip_address: '127.0.0.1' // client side placeholder
        }])
      
      if (error) throw error
    } catch (err) {
      console.warn('Logging event to LocalStorage:', err.message)
      const logs = this.getLocalLogs()
      const newLog = {
        id: `log-${Date.now()}`,
        user_id: userId || null,
        user_email: email || 'system@sekolah.com',
        action,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        created_at: new Date().toISOString()
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newLog, ...logs].slice(0, 100))) // Cap at 100 logs
    }
  },

  getLocalLogs() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (data) {
      try {
        return JSON.parse(data)
      } catch {
        return []
      }
    }
    return []
  },

  async getLogs() {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data
    } catch (err) {
      console.warn('Reading audit logs from LocalStorage:', err.message)
      return this.getLocalLogs()
    }
  }
}
