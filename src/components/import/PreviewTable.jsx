/**
 * PreviewTable – shows the first N rows of parsed data with error row highlighting.
 *
 * Props:
 *  rows        – all parsed rows (raw)
 *  errorIndices – Set of row _index values that have errors
 *  updateIndices – Set of row _index values that are updates
 *  maxRows     – how many rows to preview (default 10)
 *  columns     – column keys to display (inferred from first row if not provided)
 */
export default function PreviewTable({ rows = [], errorIndices = new Set(), updateIndices = new Set(), maxRows = 10, columns }) {
  if (rows.length === 0) return null

  const cols = columns || Object.keys(rows[0]).filter((k) => !k.startsWith('_'))
  const preview = rows.slice(0, maxRows)

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-b border-slate-200 w-10">
                #
              </th>
              {cols.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-b border-slate-200 whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-b border-slate-200 w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.map((row, idx) => {
              const isError = errorIndices.has(idx)
              const isUpdate = updateIndices.has(idx)

              return (
                <tr
                  key={idx}
                  className={`
                    transition-colors
                    ${isError ? 'bg-red-50 hover:bg-red-100/70' : ''}
                    ${isUpdate && !isError ? 'bg-amber-50 hover:bg-amber-100/70' : ''}
                    ${!isError && !isUpdate ? 'hover:bg-slate-50' : ''}
                  `}
                >
                  <td className="px-3 py-2 text-slate-400 font-mono text-xs">{idx + 2}</td>
                  {cols.map((col) => (
                    <td key={col} className={`px-3 py-2 ${isError ? 'text-red-700' : 'text-slate-700'}`}>
                      <span className="max-w-[180px] block truncate" title={row[col]}>
                        {row[col] !== undefined && row[col] !== '' ? String(row[col]) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {isError ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        ❌ Error
                      </span>
                    ) : isUpdate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        🔄 Update
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        ✅ Baru
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > maxRows && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
          Menampilkan {maxRows} dari {rows.length} baris. Semua baris akan divalidasi dan diproses.
        </div>
      )}
    </div>
  )
}
