import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const BATCH_SIZE = 50

/**
 * Hook for importing student master reference data in batches via Supabase upsert.
 */
export function useImportStudentMaster() {
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [result, setResult] = useState(null)

  const reset = useCallback(() => {
    setIsImporting(false)
    setProgress({ current: 0, total: 0, label: '' })
    setResult(null)
  }, [])

  /**
   * @param {{ valid: object[], updates: object[] }} validatedData
   * @param {Function} [onComplete]
   */
  const startImport = useCallback(async ({ valid, updates }, onComplete) => {
    const allRows = [...valid, ...updates]
    if (allRows.length === 0) return

    setIsImporting(true)
    setResult(null)

    const total = allRows.length
    let current = 0
    let inserted = 0
    let updated = 0
    const failed = []

    // Determine NIS values that will update (already in DB)
    const updateNisSet = new Set(updates.map((r) => r.nis))

    const batches = []
    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      batches.push(allRows.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      setProgress({
        current,
        total,
        label: `Mengimport ${Math.min(current + BATCH_SIZE, total)} dari ${total} data master...`,
      })

      // Strip internal tracking keys before upserting
      const cleaned = batch.map(({ _index, _rowNum, ...rest }) => rest)

      const { error } = await supabase
        .from('student_master')
        .upsert(cleaned, { onConflict: 'nis' })

      if (error) {
        // Mark entire batch as failed
        batch.forEach((row) => {
          failed.push({ row: row._rowNum, nis: row.nis, error: error.message })
        })
      } else {
        // Count inserted vs updated
        batch.forEach((row) => {
          if (updateNisSet.has(row.nis)) updated++
          else inserted++
        })
      }

      current = Math.min(current + BATCH_SIZE, total)
    }

    setProgress({ current: total, total, label: 'Selesai!' })
    const finalResult = { inserted, updated, failed }
    setResult(finalResult)
    setIsImporting(false)
    onComplete?.(finalResult)
  }, [])

  return { startImport, progress, result, isImporting, reset }
}
