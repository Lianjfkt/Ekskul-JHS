/**
 * Class Helper Utility
 * Menangani normalisasi dan pencocokan format kelas sekolah (Angka Arab & Romawi).
 * Mendukung variasi seperti:
 * - 7A, 7-A, 7.A, 7 A, Kelas 7A, VII-A, VII A, VII.1, VIIA
 * - 8A, 8-B, 8.1, Kelas 8A, VIII-A, VIII B, VIIIA
 * - 9A, 9-C, 9.2, Kelas 9A, IX-A, IX B, IXA
 */

/**
 * Normalisasi string kelas ke format standar: [Tingkat: 7|8|9][Rombel: A|B|C|1|2...]
 * Contoh:
 * - "VIII-A" -> "8A"
 * - "VII A" -> "7A"
 * - "Kelas 8.1" -> "81"
 * - "IX-C" -> "9C"
 * - "8" -> "8"
 * 
 * @param {string|number} classStr
 * @returns {string}
 */
export function normalizeClass(classStr) {
  if (!classStr && classStr !== 0) return ''
  let s = String(classStr).trim().toLowerCase()
  
  // Hapus awalan 'kelas', 'kls', 'class'
  s = s.replace(/^(kelas|kls|class)\s*/i, '')
  // Hapus tanda hubung, titik, spasi, garis bawah
  s = s.replace(/[-._\s]/g, '')
  
  if (!s) return ''

  // Periksa angka Romawi (VIII harus dicek sebelum VII)
  if (s.startsWith('viii')) {
    return '8' + s.slice(4).toUpperCase()
  } else if (s.startsWith('vii')) {
    return '7' + s.slice(3).toUpperCase()
  } else if (s.startsWith('ix')) {
    return '9' + s.slice(2).toUpperCase()
  } else if (s.startsWith('8')) {
    return '8' + s.slice(1).toUpperCase()
  } else if (s.startsWith('7')) {
    return '7' + s.slice(1).toUpperCase()
  } else if (s.startsWith('9')) {
    return '9' + s.slice(1).toUpperCase()
  }

  return s.toUpperCase()
}

/**
 * Ekstrak tingkat kelas (7, 8, 9) dari format kelas apapun.
 * @param {string|number} classStr
 * @returns {'7'|'8'|'9'|''}
 */
export function getGradeFromClass(classStr) {
  const norm = normalizeClass(classStr)
  if (norm.startsWith('7')) return '7'
  if (norm.startsWith('8')) return '8'
  if (norm.startsWith('9')) return '9'
  return ''
}

/**
 * Cek apakah kelas siswa cocok dengan target kelas sesi / filter.
 * 
 * Aturan:
 * 1. Jika targetClass kosong, null, 'all', 'semua', 'semua kelas' -> COCOK (true).
 * 2. Jika targetClass berisi tingkat ('7', '8', '9'), maka mencocokkan semua rombel tingkat tersebut (misal: target '8' cocok untuk '8A', 'VIII-A', '8-B', dll.).
 * 3. Jika targetClass berisi rombel spesifik ('8A', 'VIII-A'), maka hanya mencocokkan rombel yang sama.
 * 4. Mendukung multi-target dengan pemisah koma (contoh: '7, 8' atau '8A, 8B').
 * 
 * @param {string} studentClass - Kelas siswa (misal: "VIII-A", "8A", "7B")
 * @param {string} targetClass - Target kelas (misal: "8", "8A", "7, 8", "all")
 * @returns {boolean}
 */
export function matchesClass(studentClass, targetClass) {
  if (!targetClass || ['all', '', 'semua', 'semua kelas', '*'].includes(String(targetClass).trim().toLowerCase())) {
    return true
  }
  if (!studentClass) {
    return false
  }

  const normStudent = normalizeClass(studentClass)
  if (!normStudent) return false

  const targets = String(targetClass).split(',').map(t => t.trim()).filter(Boolean)
  if (targets.length === 0) return true

  for (const t of targets) {
    const normTarget = normalizeClass(t)
    if (!normTarget || normTarget === 'ALL') return true

    // Jika target hanya tingkat (panjang 1: '7', '8', '9')
    if (normTarget.length === 1) {
      if (normStudent.startsWith(normTarget)) {
        return true
      }
    } else {
      // Jika target spesifik misal '8A', gunakan exact match saja.
      // Hindari startsWith agar siswa kelas '8' tidak lolos ke sesi target '8A',
      // dan siswa '8AB' tidak lolos ke sesi target '8A'.
      if (normStudent === normTarget) {
        return true
      }
    }
  }

  return false
}
