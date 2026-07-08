import { useState, useEffect } from 'react'
import { X, FileSpreadsheet, ChevronRight, ChevronLeft, Upload, Download } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

import { parseFile } from '../../utils/excelParser'
import { validateStudentRows, validateStudentMasterRows, validateEnrollmentRows } from '../../utils/csvValidator'
import { downloadStudentTemplate, downloadStudentMasterTemplate, downloadEnrollmentTemplate, downloadErrorLog } from '../../utils/templateGenerator'
import { useImportStudents } from '../../hooks/useImportStudents'
import { useImportStudentMaster } from '../../hooks/useImportStudentMaster'
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
  [STEP_UPLOAD]:  'Upload',
  [STEP_PREVIEW]: 'Validasi',
  [STEP_IMPORT]:  'Proses',
  [STEP_RESULT]:  'Hasil',
}

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
  const studentMasterImport = useImportStudentMaster()
  const enrollmentImport = useImportEnrollments()

  const activeImport = type === 'students'
    ? studentImport
    : type === 'student_master'
      ? studentMasterImport
      : enrollmentImport

  // Load reference data from DB
  useEffect(() => {
    if (!isOpen) return
    loadReferenceData()
  }, [isOpen, type])

  async function loadReferenceData() {
    setIsLoadingRef(true)
    try {
      const tableToLoad = type === 'student_master' ? 'student_master' : 'students'
      const { data: students } = await supabase
        .from(tableToLoad)
        .select('id, nis')
      const nis = (students || []).map((s) => s.nis)
      setExistingNis(nis)

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

  // Reset on close
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
    studentMasterImport.reset()
    enrollmentImport.reset()
    onClose()
  }

  // Step 1 → 2: Parse file
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

  // Validation
  async function runValidation(rows) {
    setIsValidating(true)
    let result

    if (type === 'students') {
      result = await validateStudentRows(rows, existingNis)
    } else if (type === 'student_master') {
      result = await validateStudentMasterRows(rows, existingNis)
    } else {
      result = validateEnrollmentRows(rows, existingNis, ekskulList)
    }

    setValidRows(result.valid || [])
    setUpdateRows(result.updates || [])
    setErrorRows(result.errors || [])
    setMissingCols(result.missingCols || [])
    setIsValidating(false)
  }

  // Step 3: Start import
  async function handleStartImport() {
    setStep(STEP_IMPORT)

    if (type === 'students') {
      await studentImport.startImport({ valid: validRows, updates: updateRows }, () => {
        setStep(STEP_RESULT)
        onSuccess?.()
      })
    } else if (type === 'student_master') {
      await studentMasterImport.startImport({ valid: validRows, updates: updateRows }, () => {
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

  const errorIndices  = new Set(errorRows.map((e) => e._index))
  const updateIndices = new Set(updateRows.map((r) => r._index))
  const canImport     = (validRows.length + updateRows.length) > 0 && missingCols.length === 0
  const totalRows     = rawRows.length

  if (!isOpen) return null

  const isStudents    = type === 'students'
  const isStudentMaster = type === 'student_master'
  const modalTitle    = isStudents ? 'IMPORT DATA SISWA' : isStudentMaster ? 'IMPORT DATA MASTER SISWA' : 'IMPORT PENDAFTARAN'
  const modalSubtitle = isStudents
    ? 'Format: .csv / .xlsx dengan kolom nis, full_name, class, gender, phone'
    : isStudentMaster
    ? 'Format: .csv / .xlsx dengan kolom nis, full_name, class, gender, phone'
    : 'Format: .csv / .xlsx dengan kolom nis, extracurricular_name, semester, academic_year'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="pixel-box bg-pixel-panel w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden pixel-slide-in">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b-3 border-pixel-gray bg-pixel-navy flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pixel-blue/15 border-2 border-pixel-blue flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-pixel-blue" />
            </div>
            <div>
              <h2 className="font-pixel text-[10px] text-pixel-white pixel-text-shadow leading-relaxed">{modalTitle}</h2>
              <p className="font-retro text-base text-pixel-lavender mt-1">{modalSubtitle}</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-pixel-lavender hover:text-pixel-red border-2 border-transparent hover:border-pixel-red">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-6 py-3 border-b-3 border-pixel-gray bg-pixel-navy/40 gap-2 flex-shrink-0 font-pixel text-[8px]">
          {[STEP_UPLOAD, STEP_PREVIEW, STEP_IMPORT, STEP_RESULT].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-pixel-lavender" />}
              <div className={`flex items-center gap-1.5 px-2 py-1 border-2 ${
                step === s
                  ? 'border-pixel-blue text-pixel-blue bg-pixel-blue/10'
                  : step > s
                  ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                  : 'border-transparent text-pixel-lavender'
              }`}>
                {STEP_LABELS[s]}
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 font-retro text-lg">

          {/* STEP 1 */}
          {step === STEP_UPLOAD && (
            <div className="space-y-4">
              {isLoadingRef && (
                <div className="flex items-center gap-2 text-pixel-lavender p-3 bg-pixel-navy border-2 border-pixel-gray">
                  <span className="pixel-blink">MEMUAT DATA REFERENSI...</span>
                </div>
              )}
              <FileDropzone
                onFileSelected={handleFileSelected}
                disabled={isParsing || isLoadingRef}
                onTemplate={() =>
                  type === 'students'
                    ? downloadStudentTemplate()
                    : type === 'student_master'
                    ? downloadStudentMasterTemplate()
                    : downloadEnrollmentTemplate(ekskulList)
                }
              />
              {isParsing && (
                <div className="flex items-center gap-2 text-pixel-blue p-3 bg-pixel-blue/10 border-2 border-pixel-blue">
                  <span className="pixel-blink">MEMPROSES FILE...</span>
                </div>
              )}
              {parseError && (
                <div className="p-3 bg-pixel-red/10 border-2 border-pixel-red text-pixel-red">
                  ❌ {parseError}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === STEP_PREVIEW && (
            <div className="space-y-4">
              {missingCols.length > 0 && (
                <div className="p-4 bg-pixel-red/10 border-3 border-pixel-red text-pixel-red space-y-1">
                  <p className="font-pixel text-[8px] uppercase">❌ KOLOM WAJIB TIDAK DITEMUKAN:</p>
                  <p className="font-mono bg-pixel-navy p-2 border border-pixel-red">
                    {missingCols.join(', ')}
                  </p>
                  <p className="text-sm mt-1">
                    Gunakan tombol "Download Template" untuk panduan struktur kolom.
                  </p>
                </div>
              )}

              {missingCols.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  <div className="pixel-badge border-pixel-gray text-pixel-peach">
                    TOTAL: {totalRows}
                  </div>
                  <div className="pixel-badge border-pixel-green text-pixel-green bg-pixel-green/5">
                    BARU: {validRows.length}
                  </div>
                  {updateRows.length > 0 && (
                    <div className="pixel-badge border-pixel-orange text-pixel-orange bg-pixel-orange/5">
                      UPDATE: {updateRows.length}
                    </div>
                  )}
                  {errorRows.length > 0 && (
                    <div className="pixel-badge border-pixel-red text-pixel-red bg-pixel-red/5">
                      ERROR: {errorRows.length}
                    </div>
                  )}
                </div>
              )}

              {isValidating && (
                <div className="flex items-center gap-2 text-pixel-lavender">
                  <span className="pixel-blink">MEMVALIDASI DATA...</span>
                </div>
              )}

              <ValidationErrors errors={errorRows} />

              {missingCols.length === 0 && (
                <div>
                  <p className="font-pixel text-[8px] text-pixel-lavender uppercase mb-2">
                    PREVIEW 10 BARIS PERTAMA
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

          {/* STEP 3 */}
          {step === STEP_IMPORT && (
            <div className="py-4">
              <ImportProgress
                isImporting={activeImport.isImporting}
                progress={activeImport.progress}
                result={activeImport.result}
              />
            </div>
          )}

          {/* STEP 4 */}
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t-3 border-pixel-gray bg-pixel-navy/40 flex-shrink-0">
          <div>
            {step === STEP_PREVIEW && (
              <button
                onClick={() => { setStep(STEP_UPLOAD); setFile(null); setRawRows([]) }}
                className="flex items-center gap-1 text-pixel-lavender hover:text-pixel-peach border-2 border-transparent hover:border-pixel-gray px-3 py-1 font-retro text-lg"
              >
                <ChevronLeft className="w-4 h-4" /> GANTI FILE
              </button>
            )}
            {step === STEP_RESULT && activeImport.result?.failed?.length > 0 && (
              <button
                onClick={() => downloadErrorLog(errorRows.concat(
                  (activeImport.result?.failed || []).map(f => ({ row: f.row, nis: f.nis, errors: [f.error], _raw: {} }))
                ), type)}
                className="flex items-center gap-1.5 border-2 border-pixel-orange bg-pixel-orange/10 text-pixel-orange px-3 py-1.5 font-retro text-lg"
              >
                <Download className="w-4 h-4" /> DOWNLOAD LOG ERROR
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {step !== STEP_IMPORT && (
              <Button
                variant="outline"
                onClick={handleClose}
              >
                {step === STEP_RESULT ? 'SELESAI' : 'BATAL'}
              </Button>
            )}

            {step === STEP_PREVIEW && (
              <Button
                onClick={handleStartImport}
                disabled={!canImport || isValidating}
              >
                <Upload className="w-4 h-4 mr-2" /> IMPORT SEKARANG
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
