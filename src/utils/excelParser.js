import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const MAX_FILE_SIZE_MB = 5
const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

/**
 * Validate file type and size before parsing.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFileType(file) {
  if (!file) return { valid: false, error: 'Tidak ada file yang dipilih.' }

  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return { valid: false, error: `Ukuran file terlalu besar (${sizeMB.toFixed(1)} MB). Maksimal ${MAX_FILE_SIZE_MB} MB.` }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    return { valid: false, error: 'Format file tidak didukung. Hanya .csv dan .xlsx yang diterima.' }
  }

  return { valid: true }
}

/**
 * Parse a CSV or XLSX file and return an array of row objects with lowercase keys.
 * @param {File} file
 * @returns {Promise<{ data: object[], error?: string }>}
 */
export async function parseFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()

  try {
    if (ext === 'csv') {
      return await parseCSV(file)
    } else {
      return await parseXLSX(file)
    }
  } catch (err) {
    return { data: [], error: 'Gagal memproses file: ' + err.message }
  }
}

/**
 * Parse CSV using PapaParse
 */
function parseCSV(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      transform: (val) => (typeof val === 'string' ? val.trim() : val),
      complete: (results) => {
        if (results.errors?.length > 0 && results.data?.length === 0) {
          resolve({ data: [], error: 'File CSV tidak valid: ' + results.errors[0]?.message })
        } else {
          resolve({ data: results.data || [], error: null })
        }
      },
      error: (err) => {
        resolve({ data: [], error: 'Gagal membaca CSV: ' + err.message })
      }
    })
  })
}

/**
 * Parse XLSX using SheetJS
 */
function parseXLSX(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '',
          raw: false,
        })

        // Normalize headers to lowercase with underscores
        const normalized = jsonData.map((row) => {
          const newRow = {}
          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            newRow[cleanKey] = typeof row[key] === 'string' ? row[key].trim() : String(row[key] ?? '').trim()
          }
          return newRow
        })

        resolve({ data: normalized, error: null })
      } catch (err) {
        resolve({ data: [], error: 'Gagal membaca file Excel: ' + err.message })
      }
    }
    reader.onerror = () => resolve({ data: [], error: 'Gagal membaca file.' })
    reader.readAsArrayBuffer(file)
  })
}
