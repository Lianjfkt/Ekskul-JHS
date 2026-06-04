import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * ValidationErrors – collapsible list of per-row validation errors.
 *
 * Props:
 *  errors – [{ row: number, nis: string, errors: string[] }]
 */
export default function ValidationErrors({ errors = [] }) {
  const [expanded, setExpanded] = useState(errors.length <= 5)

  if (errors.length === 0) return null

  const visible = expanded ? errors : errors.slice(0, 3)

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold text-sm">
            {errors.length} baris memiliki error dan tidak akan diimport
          </span>
        </div>
        {errors.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Sembunyikan</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Lihat semua ({errors.length})</>
            )}
          </button>
        )}
      </div>

      {/* Error List */}
      <ul className="divide-y divide-red-100 max-h-64 overflow-y-auto">
        {visible.map((err, i) => (
          <li key={i} className="px-4 py-2.5 flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
              <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-800">
                Baris {err.row}
              </span>
              {err.nis && (
                <span className="text-slate-500">NIS: {err.nis}</span>
              )}
            </div>
            <ul className="pl-2 space-y-0.5">
              {err.errors.map((msg, mi) => (
                <li key={mi} className="text-xs text-red-600 flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5">•</span>
                  {msg}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {!expanded && errors.length > 3 && (
        <div className="px-4 py-2 bg-red-100/60 text-center text-xs text-red-500">
          +{errors.length - 3} baris lainnya...
          <button onClick={() => setExpanded(true)} className="ml-1 underline hover:text-red-700">
            Tampilkan semua
          </button>
        </div>
      )}
    </div>
  )
}
