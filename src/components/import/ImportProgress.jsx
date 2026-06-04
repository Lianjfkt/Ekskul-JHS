import { CheckCircle2, XCircle, RefreshCcw, Loader2 } from 'lucide-react'

/**
 * ImportProgress – animated progress bar + final result summary.
 *
 * Props:
 *  isImporting – boolean
 *  progress    – { current: number, total: number, label: string }
 *  result      – { inserted: number, updated: number, failed: { row, nis, error }[] } | null
 */
export default function ImportProgress({ isImporting, progress, result }) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      {(isImporting || (result && progress.total > 0)) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600 font-medium">
              {isImporting && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {progress.label || 'Memproses...'}
            </span>
            <span className="font-mono font-bold text-primary">{pct}%</span>
          </div>

          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-xs text-slate-400 text-right">
            {progress.current} / {progress.total} data
          </p>
        </div>
      )}

      {/* Result Summary */}
      {result && !isImporting && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {/* Inserted */}
            <div className="flex flex-col items-center justify-center gap-1 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-700">{result.inserted}</span>
              <span className="text-xs text-emerald-600 font-medium">Siswa Baru</span>
            </div>

            {/* Updated */}
            <div className="flex flex-col items-center justify-center gap-1 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <RefreshCcw className="w-6 h-6 text-amber-500" />
              <span className="text-2xl font-bold text-amber-700">{result.updated}</span>
              <span className="text-xs text-amber-600 font-medium">Diperbarui</span>
            </div>

            {/* Failed */}
            <div className={`flex flex-col items-center justify-center gap-1 p-4 rounded-xl text-center border ${
              result.failed.length > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <XCircle className={`w-6 h-6 ${result.failed.length > 0 ? 'text-red-500' : 'text-slate-300'}`} />
              <span className={`text-2xl font-bold ${result.failed.length > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                {result.failed.length}
              </span>
              <span className={`text-xs font-medium ${result.failed.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                Gagal
              </span>
            </div>
          </div>

          {/* Failed detail */}
          {result.failed.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-red-200 text-xs font-semibold text-red-700">
                Detail kegagalan:
              </div>
              <ul className="divide-y divide-red-100 max-h-32 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <li key={i} className="px-3 py-1.5 text-xs text-red-600 flex gap-2">
                    <span className="font-mono font-bold text-red-800">Baris {f.row}</span>
                    <span className="text-slate-500">NIS {f.nis}:</span>
                    <span>{f.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success message */}
          {result.inserted + result.updated > 0 && result.failed.length === 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 text-center font-medium">
              🎉 Semua data berhasil diimport tanpa error!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
