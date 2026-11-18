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
    <div className="space-y-4 font-retro">
      {/* Progress Bar */}
      {(isImporting || (result && progress.total > 0)) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2 text-pixel-white">
              {isImporting && <Loader2 className="w-4 h-4 animate-spin text-pixel-blue" />}
              {progress.label || 'Memproses...'}
            </span>
            <span className="font-pixel text-xs text-pixel-blue">{pct}%</span>
          </div>

          <div className="h-3 bg-pixel-navy border border-pixel-gray/40 rounded-none overflow-hidden">
            <div
              className="h-full bg-pixel-blue rounded-none transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-sm text-pixel-lavender text-right">
            {progress.current} / {progress.total} data
          </p>
        </div>
      )}

      {/* Result Summary */}
      {result && !isImporting && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {/* Inserted */}
            <div className="flex flex-col items-center justify-center gap-1 p-4 bg-pixel-green/10 border-2 border-pixel-green rounded-none text-center">
              <CheckCircle2 className="w-6 h-6 text-pixel-green" />
              <span className="text-2xl font-pixel text-pixel-green">{result.inserted}</span>
              <span className="text-sm text-pixel-lavender font-medium">Siswa Baru</span>
            </div>

            {/* Updated */}
            <div className="flex flex-col items-center justify-center gap-1 p-4 bg-pixel-yellow/10 border-2 border-pixel-yellow rounded-none text-center">
              <RefreshCcw className="w-6 h-6 text-pixel-yellow" />
              <span className="text-2xl font-pixel text-pixel-yellow">{result.updated}</span>
              <span className="text-sm text-pixel-lavender font-medium">Diperbarui</span>
            </div>

            {/* Failed */}
            <div className={`flex flex-col items-center justify-center gap-1 p-4 rounded-none text-center border-2 ${
              result.failed.length > 0
                ? 'bg-pixel-red/10 border-pixel-red'
                : 'bg-pixel-navy border-pixel-gray/40'
            }`}>
              <XCircle className={`w-6 h-6 ${result.failed.length > 0 ? 'text-pixel-red' : 'text-pixel-gray'}`} />
              <span className={`text-2xl font-pixel ${result.failed.length > 0 ? 'text-pixel-red' : 'text-pixel-lavender'}`}>
                {result.failed.length}
              </span>
              <span className="text-sm text-pixel-lavender">
                Gagal
              </span>
            </div>
          </div>

          {/* Failed detail */}
          {result.failed.length > 0 && (
            <div className="rounded-none border-2 border-pixel-red bg-pixel-red/10 overflow-hidden">
              <div className="px-3 py-2 border-b-2 border-pixel-red text-xs font-pixel text-pixel-red">
                Detail kegagalan:
              </div>
              <ul className="divide-y-2 divide-pixel-red/20 max-h-32 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <li key={i} className="px-3 py-1.5 text-sm text-pixel-red flex gap-2">
                    <span className="font-bold text-pixel-peach">Baris {f.row}</span>
                    <span className="text-pixel-lavender">NIS {f.nis}:</span>
                    <span>{f.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success message */}
          {result.inserted + result.updated > 0 && result.failed.length === 0 && (
            <div className="p-3 bg-pixel-green/15 border-2 border-pixel-green rounded-none text-base text-pixel-green text-center font-medium">
              🎉 Semua data berhasil diimport tanpa error!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
