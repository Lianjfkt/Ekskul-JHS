import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const BATCH_SIZE = 50

/**
 * Hook for importing enrollment data in batches via Supabase insert.
 * Duplicate enrollments (same student+ekskul+semester+year) are skipped gracefully.
 *
 * Returns:
 *  { startImport, progress, result, isImporting, reset }
 */
export function useImportEnrollments() {
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [result, setResult] = useState(null)

  const reset = useCallback(() => {
    setIsImporting(false)
    setProgress({ current: 0, total: 0, label: '' })
    setResult(null)
  }, [])

  /**
   * @param {{ valid: object[] }} validatedData
   * @param {{ [nis: string]: string }} nisToStudentId  – map from NIS → student UUID
   * @param {Function} [onComplete]
   */
  const startImport = useCallback(async ({ valid }, nisToStudentId, onComplete) => {
    if (valid.length === 0) return

    setIsImporting(true)
    setResult(null)

    const total = valid.length
    let current = 0
    let inserted = 0
    const failed = []

    // Resolve student IDs from NIS map and build insert payload
    const rows = valid.map(({ _index, _rowNum, nis, extracurricular_id, semester, academic_year, status }) => ({
      student_id: nisToStudentId[nis] || null,
      extracurricular_id,
      semester,
      academic_year,
      status: status || 'active',
      _rowNum,
      nis,
    }))

    const validRows = rows.filter((r) => r.student_id && r.extracurricular_id)
    const invalidRows = rows.filter((r) => !r.student_id || !r.extracurricular_id)
    invalidRows.forEach((r) => {
      failed.push({ row: r._rowNum, nis: r.nis, error: 'student_id atau extracurricular_id tidak valid.' })
    })

    const batches = []
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      batches.push(validRows.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      setProgress({
        current,
        total,
        label: `Mengimport ${Math.min(current + BATCH_SIZE, total)} dari ${total} data...`,
      })

      const payload = batch.map(({ _rowNum, nis, ...rest }) => rest)

      const { error } = await supabase
        .from('enrollments')
        .upsert(payload, {
          onConflict: 'student_id,extracurricular_id,semester,academic_year',
          ignoreDuplicates: true,
        })

      if (error) {
        batch.forEach((row) => {
          failed.push({ row: row._rowNum, nis: row.nis, error: error.message })
        })
      } else {
        inserted += batch.length
      }

      current = Math.min(current + BATCH_SIZE, total)
    }

    setProgress({ current: total, total, label: 'Selesai!' })
    const finalResult = { inserted, updated: 0, failed }
    setResult(finalResult)
    setIsImporting(false)
    onComplete?.(finalResult)
  }, [])

  return { startImport, progress, result, isImporting, reset }
}
