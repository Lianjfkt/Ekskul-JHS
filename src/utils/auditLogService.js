import { supabase } from '../lib/supabaseClient'

const LOCAL_STORAGE_KEY = 'ekskul_audit_logs'

export const auditLogService = {
  /**
   * Catat event ke audit_logs.
   * @param {string} userId
   * @param {string} email
   * @param {string} action - misal 'CREATE_EKSKUL', 'DELETE_USER'
   * @param {string} details - teks deskripsi
   * @param {{ targetTable?: string, targetId?: string, beforeState?: object, afterState?: object }} context - opsional
   */
  async logEvent(userId, email, action, details, context = {}) {
    const { targetTable, targetId, beforeState, afterState } = context
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          user_id: userId || null,
          user_email: email || 'system@sekolah.com',
          action,
          details: typeof details === 'object' ? JSON.stringify(details) : details,
          ip_address: '127.0.0.1',
          before_state: beforeState || null,
          after_state: afterState || null,
          target_table: targetTable || null,
          target_id: targetId || null,
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
        before_state: beforeState || null,
        after_state: afterState || null,
        target_table: targetTable || null,
        target_id: targetId || null,
        is_reverted: false,
        created_at: new Date().toISOString()
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newLog, ...logs].slice(0, 100)))
    }
  },

  getLocalLogs() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (data) {
      try { return JSON.parse(data) } catch { return [] }
    }
    return []
  },

  async getLogs() {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    } catch (err) {
      console.warn('Reading audit logs from LocalStorage:', err.message)
      return this.getLocalLogs()
    }
  },

  /**
   * Batalkan tindakan yang sudah dicatat di log.
   * CREATE_*  -> DELETE row
   * UPDATE_* / EDIT_* / TOGGLE_* -> UPDATE ke before_state
   * DELETE_*  -> INSERT before_state kembali
   * DELETE_USER / DELETE_STUDENT -> tidak didukung
   *
   * @param {string} logId - UUID dari baris audit_log
   * @param {string} adminUserId - UUID admin yang melakukan revert
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async revertLog(logId, adminUserId) {
    try {
      // 1. Ambil data log
      const { data: log, error: fetchErr } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', logId)
        .single()

      if (fetchErr) throw new Error('Gagal mengambil data log: ' + fetchErr.message)
      if (!log) throw new Error('Log tidak ditemukan.')
      if (log.is_reverted) throw new Error('Tindakan ini sudah pernah dibatalkan sebelumnya.')

      const { action, target_table, target_id, before_state } = log

      // 2. Cek apakah aksi ini didukung untuk revert otomatis
      const isDeleteUser = action === 'DELETE_USER' || action === 'DELETE_STUDENT'
      if (isDeleteUser) {
        return {
          success: false,
          message: 'Aksi penghapusan akun pengguna tidak dapat dibatalkan secara otomatis karena melibatkan sistem autentikasi. Harap buat ulang akun secara manual.'
        }
      }

      if (!target_table || !target_id) {
        return {
          success: false,
          message: 'Log ini tidak memiliki informasi target yang cukup untuk melakukan revert otomatis.'
        }
      }

      // 3. Eksekusi operasi invers
      if (action.startsWith('CREATE_')) {
        const { error } = await supabase
          .from(target_table)
          .delete()
          .eq('id', target_id)
        if (error) throw new Error('Gagal menghapus data: ' + error.message)

      } else if (action.startsWith('UPDATE_') || action.startsWith('EDIT_') || action.startsWith('TOGGLE_')) {
        if (!before_state) throw new Error('Data sebelumnya (before_state) tidak tersedia untuk aksi ini.')
        const { error } = await supabase
          .from(target_table)
          .update(before_state)
          .eq('id', target_id)
        if (error) throw new Error('Gagal memulihkan data: ' + error.message)

      } else if (action.startsWith('DELETE_')) {
        if (!before_state) throw new Error('Data asli (before_state) tidak tersedia untuk aksi ini.')
        const { error } = await supabase
          .from(target_table)
          .insert([before_state])
        if (error) throw new Error('Gagal memulihkan data yang dihapus: ' + error.message)

      } else {
        return {
          success: false,
          message: `Tipe aksi "${action}" tidak didukung untuk revert otomatis.`
        }
      }

      // 4. Tandai log sebagai sudah di-revert
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from('audit_logs')
        .update({
          is_reverted: true,
          reverted_by: adminUserId,
          reverted_at: now
        })
        .eq('id', logId)
      if (updateErr) console.warn('Gagal update status revert di log:', updateErr.message)

      // 5. Catat log baru untuk aksi revert
      await this.logEvent(
        adminUserId,
        null,
        `REVERT_${action}`,
        `Membatalkan tindakan: ${log.details || action}`,
        { targetTable: target_table, targetId: target_id }
      )

      return { success: true, message: 'Tindakan berhasil dibatalkan dan data telah dipulihkan.' }

    } catch (err) {
      return { success: false, message: err.message }
    }
  }
}
