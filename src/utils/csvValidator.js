import { supabase } from '../lib/supabaseClient'

// ─── REQUIRED COLUMNS ─────────────────────────────────────────────────────────
export const STUDENT_REQUIRED_COLS = ['nis', 'full_name', 'class', 'gender', 'phone']
export const ENROLLMENT_REQUIRED_COLS = ['nis', 'extracurricular_name', 'semester', 'academic_year']

// Gender shorthand → full value stored in DB
const GENDER_MAP = {
  l: 'Laki-laki',
  p: 'Perempuan',
  'laki-laki': 'Laki-laki',
  perempuan: 'Perempuan',
}

/** Check that all required columns exist in the data (case-insensitive normalized keys). */
export function checkRequiredColumns(row, required) {
  const keys = Object.keys(row).map((k) => k.toLowerCase())
  const missing = required.filter((col) => !keys.includes(col))
  return missing
}

// ─── STUDENT VALIDATOR ────────────────────────────────────────────────────────

/**
 * Validate rows for student import.
 *
 * Returns:
 *  {
 *    valid: [{ ...rowData, _index }],          // rows ready to INSERT
 *    updates: [{ ...rowData, _index }],         // rows that will UPDATE (NIS already in DB)
 *    errors: [{ row: number, nis, errors[] }],  // rows with validation errors
 *    missingCols: string[]                      // missing required columns (stops all validation)
 *  }
 *
 * @param {object[]} rows  – raw parsed data array
 * @param {string[]} existingNis – NIS values already in the DB (fetched before calling)
 */
export async function validateStudentRows(rows, existingNis = []) {
  // 1. Check required columns from first non-empty row
  if (rows.length === 0) return { valid: [], updates: [], errors: [], missingCols: [] }

  const missingCols = checkRequiredColumns(rows[0], STUDENT_REQUIRED_COLS)
  if (missingCols.length > 0) {
    return { valid: [], updates: [], errors: [], missingCols }
  }

  const existingSet = new Set(existingNis.map(String))
  const seenNisInFile = new Set()

  const valid = []
  const updates = []
  const errors = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // +2: 1-indexed + skip header row
    const rowErrors = []

    const nis = String(row.nis ?? '').trim()
    const full_name = String(row.full_name ?? '').trim()
    const klass = String(row.class ?? '').trim()
    const genderRaw = String(row.gender ?? '').trim().toLowerCase()
    const phone = String(row.phone ?? '').trim()

    // Validate NIS
    if (!nis) {
      rowErrors.push('NIS tidak boleh kosong')
    } else if (!/^\d{5,10}$/.test(nis)) {
      rowErrors.push('NIS harus berupa angka 5-10 digit')
    } else if (seenNisInFile.has(nis)) {
      rowErrors.push(`NIS ${nis} duplikat dalam file ini`)
    }

    // Validate full_name
    if (!full_name) rowErrors.push('Nama lengkap tidak boleh kosong')

    // Validate class
    if (!klass) rowErrors.push('Kelas tidak boleh kosong')

    // Validate gender
    const genderMapped = GENDER_MAP[genderRaw]
    if (!genderMapped) {
      rowErrors.push('Gender harus diisi L atau P (atau Laki-laki / Perempuan)')
    }

    if (nis) seenNisInFile.add(nis)

    const cleanRow = {
      nis,
      full_name,
      class: klass,
      gender: genderMapped || genderRaw,
      phone,
      _index: idx,
      _rowNum: rowNum,
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, nis, errors: rowErrors, _raw: row, _index: idx })
    } else if (existingSet.has(nis)) {
      updates.push(cleanRow)
    } else {
      valid.push(cleanRow)
    }
  })

  return { valid, updates, errors, missingCols: [] }
}

/**
 * Validate rows for student master import.
 */
export async function validateStudentMasterRows(rows, existingNis = []) {
  if (rows.length === 0) return { valid: [], updates: [], errors: [], missingCols: [] }

  const missingCols = checkRequiredColumns(rows[0], STUDENT_REQUIRED_COLS)
  if (missingCols.length > 0) {
    return { valid: [], updates: [], errors: [], missingCols }
  }

  const existingSet = new Set(existingNis.map(String))
  const seenNisInFile = new Set()

  const valid = []
  const updates = []
  const errors = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const rowErrors = []

    const nis = String(row.nis ?? '').trim()
    const full_name = String(row.full_name ?? '').trim()
    const klass = String(row.class ?? '').trim()
    const genderRaw = String(row.gender ?? '').trim().toLowerCase()
    const phone = String(row.phone ?? '').trim()

    if (!nis) {
      rowErrors.push('NIS tidak boleh kosong')
    } else if (!/^\d{5,10}$/.test(nis)) {
      rowErrors.push('NIS harus berupa angka 5-10 digit')
    } else if (seenNisInFile.has(nis)) {
      rowErrors.push(`NIS ${nis} duplikat dalam file ini`)
    }

    if (!full_name) rowErrors.push('Nama lengkap tidak boleh kosong')
    if (!klass) rowErrors.push('Kelas tidak boleh kosong')

    const genderMapped = GENDER_MAP[genderRaw]
    if (!genderMapped) {
      rowErrors.push('Gender harus diisi L atau P (atau Laki-laki / Perempuan)')
    }

    if (nis) seenNisInFile.add(nis)

    const cleanRow = {
      nis,
      full_name,
      class: klass,
      gender: genderMapped || genderRaw,
      phone,
      _index: idx,
      _rowNum: rowNum,
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, nis, errors: rowErrors, _raw: row, _index: idx })
    } else if (existingSet.has(nis)) {
      updates.push(cleanRow)
    } else {
      valid.push(cleanRow)
    }
  })

  return { valid, updates, errors, missingCols: [] }
}

// ─── ENROLLMENT VALIDATOR ─────────────────────────────────────────────────────

/**
 * Simple Levenshtein distance for fuzzy match suggestions.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Find the closest ekskul name from the list.
 */
function findClosestEkskul(name, ekskulNames) {
  if (!ekskulNames.length) return null
  const lower = name.toLowerCase()
  let best = null, bestDist = Infinity
  for (const en of ekskulNames) {
    const d = levenshtein(lower, en.toLowerCase())
    if (d < bestDist) { bestDist = d; best = en }
  }
  // Only suggest if reasonably close (distance ≤ 5)
  return bestDist <= 5 ? best : null
}

/**
 * Validate rows for enrollment import.
 *
 * Returns same structure as validateStudentRows.
 *
 * @param {object[]} rows
 * @param {string[]} existingNis – NIS values from students table
 * @param {{ id: string, name: string }[]} ekskulList – list of extracurriculars
 */
export function validateEnrollmentRows(rows, existingNis = [], ekskulList = []) {
  if (rows.length === 0) return { valid: [], updates: [], errors: [], missingCols: [] }

  const missingCols = checkRequiredColumns(rows[0], ENROLLMENT_REQUIRED_COLS)
  if (missingCols.length > 0) {
    return { valid: [], updates: [], errors: [], missingCols }
  }

  const studentNisSet = new Set(existingNis.map(String))
  const ekskulNames = ekskulList.map((e) => e.name)
  const ekskulMap = Object.fromEntries(ekskulList.map((e) => [e.name.toLowerCase(), e.id]))

  const valid = []
  const updates = [] // Not used for enrollments but kept for API consistency
  const errors = []
  const warnings = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const rowErrors = []

    const nis = String(row.nis ?? '').trim()
    const ekskulNameRaw = String(row.extracurricular_name ?? '').trim()
    const semester = String(row.semester ?? '').trim()
    const academic_year = String(row.academic_year ?? '').trim()

    // Validate NIS
    if (!nis) {
      rowErrors.push('NIS tidak boleh kosong')
    } else if (!studentNisSet.has(nis)) {
      rowErrors.push(`NIS ${nis} tidak ditemukan di database siswa`)
    }

    // Validate ekskul
    const ekskulId = ekskulMap[ekskulNameRaw.toLowerCase()]
    if (!ekskulNameRaw) {
      rowErrors.push('Nama ekskul tidak boleh kosong')
    } else if (!ekskulId) {
      const suggestion = findClosestEkskul(ekskulNameRaw, ekskulNames)
      const hint = suggestion ? ` (Maksud Anda: "${suggestion}"?)` : ''
      rowErrors.push(`Ekskul "${ekskulNameRaw}" tidak ditemukan${hint}`)
    }

    // Validate semester
    if (!['ganjil', 'genap'].includes(semester.toLowerCase())) {
      rowErrors.push('Semester harus "Ganjil" atau "Genap"')
    }

    // Validate academic_year format
    if (!/^\d{4}\/\d{4}$/.test(academic_year)) {
      rowErrors.push('Tahun ajaran harus format YYYY/YYYY (contoh: 2025/2026)')
    }

    const cleanRow = {
      nis,
      extracurricular_name: ekskulNameRaw,
      extracurricular_id: ekskulId || null,
      semester: semester.charAt(0).toUpperCase() + semester.slice(1).toLowerCase(),
      academic_year,
      status: 'active',
      _index: idx,
      _rowNum: rowNum,
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, nis, errors: rowErrors, _raw: row, _index: idx })
    } else {
      valid.push(cleanRow)
    }
  })

  return { valid, updates, errors, missingCols: [], warnings }
}
