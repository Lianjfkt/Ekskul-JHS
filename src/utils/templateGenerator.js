import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function applyHeaderStyle(ws, headerRow, cols) {
  headerRow.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx })
    if (!ws[cellAddr]) return
    ws[cellAddr].s = {
      font: { bold: true, color: { rgb: '1E293B' } },
      fill: { fgColor: { rgb: 'FEF08A' } }, // yellow-200
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        bottom: { style: 'medium', color: { rgb: '94A3B8' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    }
  })
}

function setColumnWidths(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }))
}

function addInstructionSheet(wb, instructions) {
  const wsInst = XLSX.utils.aoa_to_sheet(instructions)
  wsInst['!cols'] = [{ wch: 30 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Petunjuk Pengisian')
}

// ─── STUDENT TEMPLATE ─────────────────────────────────────────────────────────

/**
 * Generate and download the student import template.
 */
export function downloadStudentTemplate() {
  const wb = XLSX.utils.book_new()

  // Sheet 1 – Data
  const headers = ['nis *', 'full_name *', 'class *', 'gender *', 'phone']
  const examples = [
    ['10001', 'Budi Santoso', 'VII-A', 'L', '081234567890'],
    ['10002', 'Siti Rahayu', 'VII-B', 'P', '081234567891'],
    ['10003', 'Ahmad Fauzi', 'VIII-A', 'L', '081234567892'],
  ]

  const sheetData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  applyHeaderStyle(ws, headers, headers.length)
  setColumnWidths(ws, [14, 30, 10, 10, 18])

  ws['!rows'] = [{ hpt: 24 }] // header row height

  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')

  // Sheet 2 – Instructions
  const instructions = [
    ['Field', 'Penjelasan'],
    ['nis *', 'Nomor Induk Siswa — hanya angka, 5-10 digit. Wajib diisi. (*)'],
    ['full_name *', 'Nama lengkap siswa. Wajib diisi. (*)'],
    ['class *', 'Kelas siswa, contoh: VII-A, VIII-B, IX-C. Wajib diisi. (*)'],
    ['gender *', 'Gender: isi dengan huruf L (Laki-laki) atau P (Perempuan). Wajib diisi. (*)'],
    ['phone', 'Nomor telepon/HP. Tidak wajib.'],
    ['', ''],
    ['Catatan', 'Baris dengan (*) pada header adalah kolom wajib.'],
    ['', 'NIS yang sudah ada di database akan di-UPDATE, bukan error.'],
    ['', 'Hapus 3 baris contoh data sebelum diisi dengan data sebenarnya.'],
  ]
  addInstructionSheet(wb, instructions)

  // Export
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'template_siswa.xlsx')
}

/**
 * Generate and download the student master import template.
 */
export function downloadStudentMasterTemplate() {
  const wb = XLSX.utils.book_new()

  // Sheet 1 – Data
  const headers = ['nis *', 'full_name *', 'class *', 'gender *', 'phone']
  const examples = [
    ['10001', 'Budi Santoso', 'VII-A', 'L', '081234567890'],
    ['10002', 'Siti Rahayu', 'VII-B', 'P', '081234567891'],
    ['10003', 'Ahmad Fauzi', 'VIII-A', 'L', '081234567892'],
  ]

  const sheetData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  applyHeaderStyle(ws, headers, headers.length)
  setColumnWidths(ws, [14, 30, 10, 10, 18])

  ws['!rows'] = [{ hpt: 24 }] // header row height

  XLSX.utils.book_append_sheet(wb, ws, 'Data Master Siswa')

  // Sheet 2 – Instructions
  const instructions = [
    ['Field', 'Penjelasan'],
    ['nis *', 'Nomor Induk Siswa — hanya angka, 5-10 digit. Wajib diisi. (*)'],
    ['full_name *', 'Nama lengkap siswa. Wajib diisi. (*)'],
    ['class *', 'Kelas siswa, contoh: VII-A, VIII-B, IX-C. Wajib diisi. (*)'],
    ['gender *', 'Gender: isi dengan huruf L (Laki-laki) atau P (Perempuan). Wajib diisi. (*)'],
    ['phone', 'Nomor telepon/HP. Tidak wajib.'],
    ['', ''],
    ['Catatan', 'Baris dengan (*) pada header adalah kolom wajib.'],
    ['', 'NIS yang sudah ada di database master akan di-UPDATE (di-upsert), bukan error.'],
    ['', 'Hapus 3 baris contoh data sebelum diisi dengan data sebenarnya.'],
  ]
  addInstructionSheet(wb, instructions)

  // Export
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'template_master_siswa.xlsx')
}

// ─── ENROLLMENT TEMPLATE ──────────────────────────────────────────────────────

/**
 * Generate and download the enrollment import template.
 * @param {{ id: string, name: string }[]} ekskulList – list of ekskul from DB
 */
export function downloadEnrollmentTemplate(ekskulList = []) {
  const wb = XLSX.utils.book_new()

  // Sheet 1 – Data
  const headers = ['nis *', 'extracurricular_name *', 'semester *', 'academic_year *']
  const examples = [
    ['10001', ekskulList[0]?.name || 'Futsal', 'Ganjil', '2026/2027'],
    ['10002', ekskulList[1]?.name || 'Pramuka', 'Ganjil', '2026/2027'],
    ['10003', ekskulList[0]?.name || 'Futsal', 'Genap', '2026/2027'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  applyHeaderStyle(ws, headers, headers.length)
  setColumnWidths(ws, [14, 35, 12, 16])
  XLSX.utils.book_append_sheet(wb, ws, 'Data Enrollment')

  // Sheet 2 – Available Ekskul
  const ekskulHeader = [['No', 'Nama Ekstrakurikuler (Salin Persis)']]
  const ekskulRows = ekskulList.map((e, i) => [i + 1, e.name])
  const wsEkskul = XLSX.utils.aoa_to_sheet([...ekskulHeader, ...ekskulRows])
  wsEkskul['!cols'] = [{ wch: 6 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsEkskul, 'Daftar Ekskul')

  // Sheet 3 – Instructions
  const instructions = [
    ['Field', 'Penjelasan'],
    ['nis *', 'NIS siswa yang sudah terdaftar di sistem. Wajib diisi.'],
    ['extracurricular_name *', 'Nama ekskul — HARUS SAMA PERSIS dengan Sheet "Daftar Ekskul". Wajib diisi.'],
    ['semester *', 'Isi dengan: Ganjil atau Genap. Wajib diisi.'],
    ['academic_year *', 'Format: YYYY/YYYY, contoh: 2026/2027. Wajib diisi.'],
    ['', ''],
    ['Tips', 'Copy nama ekskul dari Sheet "Daftar Ekskul" untuk menghindari typo.'],
    ['', 'NIS harus sudah terdaftar sebagai siswa terlebih dahulu.'],
  ]
  addInstructionSheet(wb, instructions)

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'template_enrollment.xlsx')
}

// ─── ERROR LOG EXPORT ─────────────────────────────────────────────────────────

/**
 * Export failed rows to an Excel error log file.
 * @param {{ row: number, nis: string, errors: string[], _raw: object }[]} errorRows
 * @param {'students'|'student_master'|'enrollments'} type
 */
export function downloadErrorLog(errorRows, type = 'students') {
  const wb = XLSX.utils.book_new()

  const rows = errorRows.map((e) => ({
    'Baris': e.row,
    'NIS': e.nis || '',
    'Alasan Error': e.errors.join('; '),
    ...e._raw,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 50 }, { wch: 30 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Error Log')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const fname = type === 'students' ? 'error_log_siswa.xlsx' : 
                type === 'student_master' ? 'error_log_master_siswa.xlsx' : 'error_log_enrollment.xlsx'
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fname)
}
