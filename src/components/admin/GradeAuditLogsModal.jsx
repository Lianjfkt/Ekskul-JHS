import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { X, ShieldAlert, Clock, Search, Download, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GradeAuditLogsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAuditLogs()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const loadAuditLogs = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await supabase
        .from('grade_audit_logs')
        .select(`
          *,
          student:student_id (id, full_name, nis, class),
          extracurricular:extracurricular_id (id, name),
          changed_by_user:changed_by (id, full_name, role)
        `)
        .order('changed_at', { ascending: false })
        .limit(500)

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Error loading audit logs:', err)
      setErrorMsg('Gagal memuat log audit: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action filter
      if (actionFilter && log.action !== actionFilter) return false

      // Search query filter
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      const studentName = (log.student?.full_name || '').toLowerCase()
      const nis = (log.student?.nis || '').toLowerCase()
      const ekskul = (log.extracurricular?.name || '').toLowerCase()
      const changedBy = (log.changed_by_user?.full_name || '').toLowerCase()

      return (
        studentName.includes(q) ||
        nis.includes(q) ||
        ekskul.includes(q) ||
        changedBy.includes(q)
      )
    })
  }, [logs, actionFilter, searchQuery])

  const exportToExcel = async () => {
    if (filteredLogs.length === 0 || exporting) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = filteredLogs.map((log) => ({
        'Waktu': new Date(log.changed_at).toLocaleString('id-ID'),
        'Nama Siswa': log.student?.full_name || '-',
        'NIS': log.student?.nis || '-',
        'Kelas': log.student?.class || '-',
        'Ekstrakurikuler': log.extracurricular?.name || '-',
        'Semester': log.semester || '-',
        'Tahun Ajaran': log.academic_year || '-',
        'Aksi': log.action,
        'Diubah Oleh': log.changed_by_user?.full_name || 'Sistem / Pelatih',
        'Role Pengubah': log.changed_by_user?.role || '-',
        'Sikap Lama': log.old_scores?.attitude_score ?? '-',
        'Keterampilan Lama': log.old_scores?.skill_score ?? '-',
        'Aktivitas Lama': log.old_scores?.activity_score ?? '-',
        'Catatan Lama': log.old_scores?.notes || '-',
        'Sikap Baru': log.new_scores?.attitude_score ?? '-',
        'Keterampilan Baru': log.new_scores?.skill_score ?? '-',
        'Aktivitas Baru': log.new_scores?.activity_score ?? '-',
        'Catatan Baru': log.new_scores?.notes || '-',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Log Audit Nilai')
      XLSX.writeFile(wb, `Log_Audit_Nilai_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('Error exporting audit logs to Excel:', err)
      setErrorMsg('Gagal mengekspor data ke Excel.')
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pixel-navy/80 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-5xl bg-pixel-panel border-4 border-pixel-gray shadow-pixel-modal flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 border-b-2 border-pixel-gray/40 bg-pixel-navy">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-pixel-peach" />
            <div>
              <h2 className="font-pixel text-xs text-pixel-white pixel-text-shadow">
                Log Audit Perubahan Nilai
              </h2>
              <p className="text-xs text-pixel-lavender font-mono">
                Rekam jejak seluruh penambahan, revisi, dan penghapusan nilai (500 log terakhir)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-pixel-red/20 text-pixel-lavender hover:text-pixel-red transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Filter & Action */}
        <div className="p-3 bg-pixel-panel/80 border-b border-pixel-gray/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-pixel-lavender absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama siswa, NIS, ekskul, atau pelatih..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-pixel-navy border border-pixel-gray text-pixel-white placeholder-pixel-lavender/50 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs border border-pixel-gray rounded-none px-3 py-1.5 text-pixel-peach bg-pixel-navy focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="">Semua Aksi</option>
              <option value="INSERT">INSERT (Input Baru)</option>
              <option value="UPDATE">UPDATE (Revisi)</option>
              <option value="DELETE">DELETE (Dihapus)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadAuditLogs}
              disabled={loading}
              className="gap-1 text-xs text-pixel-lavender border-pixel-gray/40 hover:text-pixel-white"
              title="Segarkan data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={exportToExcel}
              disabled={filteredLogs.length === 0 || exporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs font-retro"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengekspor...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Ekspor Excel ({filteredLogs.length})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {errorMsg && (
            <div className="p-3 bg-pixel-red/10 border-2 border-pixel-red text-pixel-red text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-pixel-lavender font-retro text-sm animate-pixel-blink">
              MEMUAT LOG AUDIT NILAI...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-pixel-lavender">
              <Clock className="w-10 h-10 text-pixel-gray mx-auto mb-2 opacity-40" />
              <p>Tidak ada catatan log audit yang sesuai filter.</p>
            </div>
          ) : (
            <div className="border border-pixel-gray/30 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-pixel-navy/90 border-b border-pixel-gray/30 text-pixel-lavender font-semibold uppercase tracking-wider">
                    <th className="p-3 pl-4">Waktu</th>
                    <th className="p-3">Siswa</th>
                    <th className="p-3">Ekstrakurikuler</th>
                    <th className="p-3">Periode</th>
                    <th className="p-3 text-center">Aksi</th>
                    <th className="p-3">Diubah Oleh</th>
                    <th className="p-3 pr-4">Rincian Perubahan (Sikap / Terampil / Aktivitas)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pixel-gray/20 font-mono">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-pixel-navy/40 transition-colors">
                      <td className="p-3 pl-4 text-pixel-lavender text-[11px] whitespace-nowrap">
                        {new Date(log.changed_at).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'medium'
                        })}
                      </td>
                      <td className="p-3">
                        <div className="font-sans font-semibold text-pixel-white">
                          {log.student?.full_name || '-'}
                        </div>
                        <div className="text-[10px] text-pixel-lavender">
                          NIS: {log.student?.nis || '-'} &bull; {log.student?.class || '-'}
                        </div>
                      </td>
                      <td className="p-3 font-sans text-pixel-peach">
                        {log.extracurricular?.name || '-'}
                      </td>
                      <td className="p-3 text-pixel-lavender text-[11px] whitespace-nowrap">
                        {log.semester} <br />
                        <span className="text-[10px] text-pixel-lavender/70">{log.academic_year}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-none ${
                            log.action === 'INSERT'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                              : log.action === 'UPDATE'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-sans font-medium text-pixel-white">
                          {log.changed_by_user?.full_name || 'Pelatih / Sistem'}
                        </div>
                        <div className="text-[10px] text-pixel-peach uppercase">
                          {log.changed_by_user?.role || '-'}
                        </div>
                      </td>
                      <td className="p-3 pr-4 text-[11px]">
                        {log.action === 'UPDATE' && log.old_scores && log.new_scores ? (
                          <div className="space-y-1">
                            <div className="text-pixel-red/90">
                              <span className="text-[10px] uppercase font-bold text-pixel-lavender">Lama: </span>
                              [{log.old_scores.attitude_score ?? '-'} / {log.old_scores.skill_score ?? '-'} / {log.old_scores.activity_score ?? '-'}]
                              {log.old_scores.notes && (
                                <span className="text-[10px] italic text-pixel-lavender/80 ml-1">
                                  &ldquo;{log.old_scores.notes}&rdquo;
                                </span>
                              )}
                            </div>
                            <div className="text-emerald-400">
                              <span className="text-[10px] uppercase font-bold text-pixel-lavender">Baru: </span>
                              [{log.new_scores.attitude_score ?? '-'} / {log.new_scores.skill_score ?? '-'} / {log.new_scores.activity_score ?? '-'}]
                              {log.new_scores.notes && (
                                <span className="text-[10px] italic text-pixel-peach ml-1">
                                  &ldquo;{log.new_scores.notes}&rdquo;
                                </span>
                              )}
                            </div>
                          </div>
                        ) : log.action === 'DELETE' && log.old_scores ? (
                          <div className="text-rose-400">
                            Dihapus: [{log.old_scores.attitude_score ?? '-'} / {log.old_scores.skill_score ?? '-'} / {log.old_scores.activity_score ?? '-'}]
                            {log.old_scores.notes && (
                              <span className="text-[10px] italic text-pixel-lavender/80 ml-1">
                                &ldquo;{log.old_scores.notes}&rdquo;
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-pixel-white">
                            Skor: [{log.new_scores?.attitude_score ?? '-'} / {log.new_scores?.skill_score ?? '-'} / {log.new_scores?.activity_score ?? '-'}]
                            {log.new_scores?.notes && (
                              <span className="text-[10px] italic text-pixel-peach ml-1">
                                &ldquo;{log.new_scores.notes}&rdquo;
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-pixel-gray/30 bg-pixel-navy flex items-center justify-between">
          <div className="text-xs text-pixel-lavender font-mono">
            Menampilkan <span className="font-bold text-pixel-peach">{filteredLogs.length}</span> dari {logs.length} log
          </div>
          <Button variant="secondary" onClick={onClose} className="text-xs">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}

