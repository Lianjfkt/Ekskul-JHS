import { useState, useEffect, useCallback } from 'react'
import { X, FileSpreadsheet, ChevronRight, ChevronLeft, Upload, Download, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

import { parseFile } from '../../utils/excelParser'
import { validateStudentRows, validateEnrollmentRows } from '../../utils/csvValidator'
import { downloadStudentTemplate, downloadEnrollmentTemplate, downloadErrorLog } from '../../utils/templateGenerator'
import { useImportStudents } from '../../hooks/useImportStudents'
import { useImportEnrollments } from '../../hooks/useImportEnrollments'

import FileDropzone from './FileDropzone'
import PreviewTable from './PreviewTable'
import ValidationErrors from './ValidationErrors'
import ImportProgress from './ImportProgress'

// Step constants
const STEP_UPLOAD   = 1
const STEP_PREVIEW  = 2
const STEP_IMPORT   = 3
const STEP_RESULT   = 4

const STEP_LABELS = {
  [STEP_UPLOAD]:  'Upload File',
  [STEP_PREVIEW]: 'Preview & Validasi',
  [STEP_IMPORT]:  'Proses Import',
  [STEP_RESULT]:  'Hasil Import',
}

/**
 * ImportCSVModal – Full-featured 4-step import modal.
 *
 * Props:
 *  isOpen   – boolean
 *  onClose  – () => void – called after import done or cancelled
 *  type     – 'students' | 'enrollments'
 *  onSuccess – () => void – called to refresh parent table
 */
export default function ImportCSVModal({ isOpen, onClose, type = 'students', onSuccess }) {
  const [step, setStep] = useState(STEP_UPLOAD)

  // File & parse state
  const [file, setFile] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [rawRows, setRawRows] = useState([])

  // Validation state
  const [validRows, setValidRows] = useState([])
  const [updateRows, setUpdateRows] = useState([])
  const [errorRows, setErrorRows] = useState([])
  const [missingCols, setMissingCols] = useState([])
  const [isValidating, setIsValidating] = useState(false)

  // DB reference data
  const [existingNis, setExistingNis] = useState([])
  const [ekskulList, setEkskulList] = useState([])
  const [nisToStudentId, setNisToStudentId] = useState({})
  const [isLoadingRef, setIsLoadingRef] = useState(false)

  // Hooks
  const studentImport   = useImportStudents()
  const enrollmentImport = useImportEnrollments()

  const activeImport = type === 'students' ? studentImport : enrollmentImport

  // ── Load reference data from DB ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    loadReferenceData()
  }, [isOpen, type])

  async function loadReferenceData() {
    setIsLoadingRef(true)
    try {
      // Always fetch students (for NIS lookup)
      const { data: students } = await supabase
        .from('students')
        .select('id, nis')
      const nis = (students || []).map((s) => s.nis)
      setExistingNis(nis)

      // Map NIS → student UUID for enrollment import
      const map = {}
      ;(students || []).forEach((s) => { map[s.nis] = s.id })
      setNisToStudentId(map)

      if (type === 'enrollments') {
        const { data: ekskuls } = await supabase
          .from('extracurriculars')
          .select('id, name')
          .order('name')
        setEkskulList(ekskuls || [])
      }
    } catch (_) { /* silently ignore */ }
    setIsLoadingRef(false)
  }

  // ── Reset on close ───────────────────────────────────────────────────────────
  function handleClose() {
    setStep(STEP_UPLOAD)
    setFile(null)
    setRawRows([])
    setValidRows([])
    setUpdateRows([])
    setErrorRows([])
    setMissingCols([])
    setParseError('')
    studentImport.reset()
    enrollmentImport.reset()
    onClose()
  }

  // ── Step 1 → 2: Parse file ───────────────────────────────────────────────────
  async function handleFileSelected(selectedFile) {
    setFile(selectedFile)
    setParseError('')
    setIsParsing(true)

    const { data, error } = await parseFile(selectedFile)
    setIsParsing(false)

    if (error) {
      setParseError(error)
      return
    }
    if (data.length === 0) {
      setParseError('File kosong atau tidak ada data yang dapat dibaca.')
      return
    }

    setRawRows(data)
    await runValidation(data)
    setStep(STEP_PREVIEW)
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  async function runValidation(rows) {
    setIsValidating(true)
    let result

    if (type === 'students') {
      result = await validateStudentRows(rows, existingNis)
    } else {
      result = validateEnrollmentRows(rows, existingNis, ekskulList)
    }

    setValidRows(result.valid || [])
    setUpdateRows(result.updates || [])
    setErrorRows(result.errors || [])
    setMissingCols(result.missingCols || [])
    setIsValidating(false)
  }

  // ── Step 3: Start import ─────────────────────────────────────────────────────
  async function handleStartImport() {
    setStep(STEP_IMPORT)

    if (type === 'students') {
      await studentImport.startImport({ valid: validRows, updates: updateRows }, () => {
        setStep(STEP_RESULT)
        onSuccess?.()
      })
    } else {
      await enrollmentImport.startImport({ valid: validRows }, nisToStudentId, () => {
        setStep(STEP_RESULT)
        onSuccess?.()
      })
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const errorIndices  = new Set(errorRows.map((e) => e._index))
  const updateIndices = new Set(updateRows.map((r) => r._index))
  const canImport     = (validRows.length + updateRows.length) > 0 && missingCols.length === 0
  const totalRows     = rawRows.length

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!isOpen) return null

  const isStudents    = type === 'students'
  const modalTitle    = isStudents ? 'Import Data Siswa' : 'Import Data Enrollment Ekskul'
  const modalSubtitle = isStudents
    ? 'Format: .csv / .xlsx dengan kolom nis, full_name, class, gender, phone'
    : 'Format: .csv / .xlsx dengan kolom nis, extracurricular_name, semester, academic_year'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">{modalTitle}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{modalSubtitle}</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step Indicator ─────────────────────────────────────────────────── */}
        <div className="flex items-center px-6 py-3 border-b border-slate-100 bg-slate-50/70 gap-1 flex-shrink-0">
          {[STEP_UPLOAD, STEP_PREVIEW, STEP_IMPORT, STEP_RESULT].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                step === s
                  ? 'bg-primary text-white shadow-sm'
                  : step > s
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-400'
              }`}>
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  step > s ? 'bg-emerald-500 text-white' : step === s ? 'bg-white/30' : 'bg-slate-200 text-slate-500'
                }`}>
                  {step > s ? '✓' : s}
                </span>
                {STEP_LABELS[s]}
              </div>
            </div>
          ))}
        </div>

        {/* ── Body (scrollable) ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* STEP 1 – Upload */}
          {step === STEP_UPLOAD && (
            <div className="space-y-4">
              {isLoadingRef && (
                <div className="flex items-center gap-2 text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat data referensi dari database...
                </div>
              )}
              <FileDropzone
                onFileSelected={handleFileSelected}
                disabled={isParsing || isLoadingRef}
                onTemplate={() =>
                  isStudents
                    ? downloadStudentTemplate()
                    : downloadEnrollmentTemplate(ekskulList)
                }
              />
              {isParsing && (
                <div className="flex items-center gap-2 text-sm text-slate-500 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  Membaca dan memproses file...
                </div>
              )}
              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  ❌ {parseError}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 – Preview & Validasi */}
          {step === STEP_PREVIEW && (
            <div className="space-y-4">
              {/* Missing columns error */}
              {missingCols.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-1">
                  <p className="font-bold">❌ Kolom wajib tidak ditemukan dalam file:</p>
                  <p className="font-mono bg-red-100 rounded px-2 py-1 text-red-800">
                    {missingCols.join(', ')}
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    Pastikan header file sesuai dengan template. Gunakan tombol "Download Template" untuk panduan.
                  </p>
                </div>
              )}

              {/* Summary badges */}
              {missingCols.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                    📊 Total data: <strong>{totalRows} baris</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    ✅ Siap diimport: <strong>{validRows.length} baris baru</strong>
                  </div>
                  {updateRows.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      🔄 Akan diperbarui: <strong>{updateRows.length} baris</strong>
                    </div>
                  )}
                  {errorRows.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-medium">
                      ❌ Error: <strong>{errorRows.length} baris</strong>
                    </div>
                  )}
                </div>
              )}

              {isValidating && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memvalidasi data...
                </div>
              )}

              {/* Validation errors */}
              <ValidationErrors errors={errorRows} />

              {/* Preview table */}
              {missingCols.length === 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Preview 10 Baris Pertama
                  </p>
                  <PreviewTable
                    rows={rawRows}
                    errorIndices={errorIndices}
                    updateIndices={updateIndices}
                    maxRows={10}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3 – Import in progress */}
          {step === STEP_IMPORT && (
            <div className="py-4">
              <ImportProgress
                isImporting={activeImport.isImporting}
                progress={activeImport.progress}
                result={activeImport.result}
              />
            </div>
          )}

          {/* STEP 4 – Result */}
          {step === STEP_RESULT && (
            <div className="py-2">
              <ImportProgress
                isImporting={false}
                progress={activeImport.progress}
                result={activeImport.result}
              />
            </div>
          )}
        </div>

        {/* ── Footer Actions ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex-shrink-0">
          {/* Left */}
          <div>
            {step === STEP_PREVIEW && (
              <button
                onClick={() => { setStep(STEP_UPLOAD); setFile(null); setRawRows([]) }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Ganti File
              </button>
            )}
            {step === STEP_RESULT && activeImport.result?.failed?.length > 0 && (
              <button
                onClick={() => downloadErrorLog(errorRows.concat(
                  (activeImport.result?.failed || []).map(f => ({ row: f.row, nis: f.nis, errors: [f.error], _raw: {} }))
                ), type)}
                className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Log Error
              </button>
            )}
          </div>

          {/* Right */}
          <div className="flex gap-2">
            {step !== STEP_IMPORT && (
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {step === STEP_RESULT ? 'Selesai' : 'Batal'}
              </button>
            )}

            {step === STEP_PREVIEW && (
              <button
                onClick={handleStartImport}
                disabled={!canImport || isValidating}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Import Sekarang ({validRows.length + updateRows.length} baris)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
