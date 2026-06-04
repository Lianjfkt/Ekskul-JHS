import { useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, X, Download } from 'lucide-react'
import { validateFileType } from '../../utils/excelParser'

/**
 * FileDropzone – drag-and-drop + click-to-browse file upload area.
 *
 * Props:
 *  onFileParsed(file) – called when a valid file is selected
 *  onTemplate()       – called when "Download Template" is clicked
 *  accept             – file accept string (default: csv & xlsx)
 */
export default function FileDropzone({ onFileSelected, onTemplate, disabled = false }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  function handleFile(file) {
    if (!file) return
    setFileError('')
    const { valid, error } = validateFileType(file)
    if (!valid) {
      setFileError(error)
      return
    }
    onFileSelected(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  function onDragOver(e) {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Dropzone Area */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-xl p-10 cursor-pointer
          transition-all duration-200 select-none
          ${isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-slate-200 bg-slate-50 hover:border-primary/60 hover:bg-primary/5'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
        />

        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
          isDragging ? 'bg-primary text-white' : 'bg-white text-primary shadow-sm border border-slate-100'
        }`}>
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="text-center">
          <p className="font-semibold text-slate-700">
            {isDragging ? 'Lepaskan file di sini' : 'Drag & drop file di sini'}
          </p>
          <p className="text-sm text-slate-400 mt-0.5">atau klik untuk browse file</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="px-2.5 py-1 bg-white border border-slate-100 rounded-full shadow-sm font-mono font-medium">.CSV</span>
          <span className="px-2.5 py-1 bg-white border border-slate-100 rounded-full shadow-sm font-mono font-medium">.XLSX</span>
          <span className="text-slate-300">•</span>
          <span>Maks. 5 MB</span>
        </div>
      </div>

      {/* File Error */}
      {fileError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Download Template */}
      {onTemplate && (
        <button
          type="button"
          onClick={onTemplate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Template Excel
        </button>
      )}
    </div>
  )
}
