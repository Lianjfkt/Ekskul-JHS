import { useRef, useState } from 'react'
import { UploadCloud, X, Download } from 'lucide-react'
import { validateFileType } from '../../utils/excelParser'

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
          border-3 border-dashed p-10 cursor-pointer select-none rounded-none
          ${isDragging
            ? 'border-pixel-blue bg-pixel-blue/5'
            : 'border-pixel-gray bg-pixel-navy hover:border-pixel-blue hover:bg-pixel-panel-light'
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

        <div className={`w-16 h-16 bg-pixel-panel border-2 border-pixel-gray flex items-center justify-center ${
          isDragging ? 'text-pixel-blue border-pixel-blue' : 'text-pixel-lavender'
        }`}>
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="text-center font-retro text-lg">
          <p className="font-semibold text-pixel-white">
            {isDragging ? 'Lepaskan file di sini' : 'Drag & drop file di sini'}
          </p>
          <p className="text-pixel-lavender mt-0.5">atau klik untuk browse file</p>
        </div>

        <div className="flex items-center gap-2 font-pixel text-[8px] text-pixel-lavender">
          <span className="px-2 py-1 bg-pixel-panel border border-pixel-gray rounded-none">.CSV</span>
          <span className="px-2 py-1 bg-pixel-panel border border-pixel-gray rounded-none">.XLSX</span>
          <span>Maks. 5 MB</span>
        </div>
      </div>

      {/* File Error */}
      {fileError && (
        <div className="flex items-start gap-2 p-3 bg-pixel-red/10 border-2 border-pixel-red text-pixel-red font-retro text-lg">
          <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Download Template */}
      {onTemplate && (
        <button
          type="button"
          onClick={onTemplate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-none border-3 border-dashed border-pixel-green text-pixel-green font-retro text-lg hover:bg-pixel-green/10"
        >
          <Download className="w-4 h-4" />
          Download Template Excel
        </button>
      )}
    </div>
  )
}
