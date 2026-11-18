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
    <div className="rounded-none border-2 border-pixel-gray bg-pixel-panel overflow-hidden text-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-pixel-navy text-pixel-white font-retro text-base border-b-2 border-pixel-gray">
              <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-b-2 border-pixel-gray text-pixel-lavender w-10">
                #
              </th>
              {cols.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-b-2 border-pixel-gray text-pixel-lavender whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider border-b-2 border-pixel-gray text-pixel-lavender w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-pixel-gray/30 font-retro text-base text-pixel-peach">
            {preview.map((row, idx) => {
              const isError = errorIndices.has(idx)
              const isUpdate = updateIndices.has(idx)

              return (
                <tr
                  key={idx}
                  className={`
                    transition-colors
                    ${isError ? 'bg-pixel-red/20 hover:bg-pixel-red/30' : ''}
                    ${isUpdate && !isError ? 'bg-pixel-yellow/15 hover:bg-pixel-yellow/25' : ''}
                    ${!isError && !isUpdate ? 'hover:bg-pixel-navy/60' : ''}
                  `}
                >
                  <td className="px-3 py-2 text-pixel-lavender/70 font-mono text-xs">{idx + 2}</td>
                  {cols.map((col) => (
                    <td key={col} className={`px-3 py-2 ${isError ? 'text-pixel-red' : 'text-pixel-white'}`}>
                      <span className="max-w-[180px] block truncate" title={row[col]}>
                        {row[col] !== undefined && row[col] !== '' ? String(row[col]) : (
                          <span className="text-pixel-lavender/40 italic">—</span>
                        )}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {isError ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[8px] font-pixel bg-pixel-red/20 border border-pixel-red text-pixel-red">
                        ERR
                      </span>
                    ) : isUpdate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[8px] font-pixel bg-pixel-yellow/20 border border-pixel-yellow text-pixel-yellow">
                        UPD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[8px] font-pixel bg-pixel-green/20 border border-pixel-green text-pixel-green">
                        BARU
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
        <div className="px-4 py-2.5 bg-pixel-navy/80 border-t-2 border-pixel-gray text-xs font-retro text-pixel-lavender text-center">
          Menampilkan {maxRows} dari {rows.length} baris. Semua baris akan divalidasi dan diproses.
        </div>
      )}
    </div>
  )
}
