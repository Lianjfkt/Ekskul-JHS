import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

/**
 * Ekspor data kredensial login siswa ke file Excel (.xlsx)
 * Disusun per kelas agar Admin dapat langsung membagikan file/sheet ke setiap wali kelas.
 *
 * @param {Array} accounts - Daftar akun siswa [{ nis, full_name, class, email, default_password, status }]
 * @param {string} selectedClass - 'all' untuk semua kelas (dengan sheet per kelas) atau nama kelas tertentu (contoh: '7A')
 */
export function exportStudentAccountsToExcel(accounts = [], selectedClass = 'all') {
  if (!accounts || accounts.length === 0) {
    throw new Error('Tidak ada data akun siswa untuk diekspor.')
  }

  const wb = XLSX.utils.book_new()
  const timestamp = new Date().toISOString().split('T')[0]

  const formatRows = (list) => {
    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Email Login',
      'Password Default',
      'Status Akun',
      'Catatan Panduan Siswa'
    ]

    const dataRows = list.map((item, idx) => [
      idx + 1,
      item.nis || '-',
      item.full_name || '-',
      item.class || '-',
      item.email || '-',
      item.default_password || 'gm123456',
      item.status || 'Aktif',
      'Login di portal Ekskul SMP Global Madani. Jaga kerahasiaan akun.'
    ])

    return [
      ['DAFTAR AKUN LOGIN PORTAL EKSKUL - JUNIOR HIGH SCHOOL GLOBAL MADANI'],
      [`Tanggal Generate: ${timestamp} | Password Standar: gm123456`],
      [], // baris kosong
      headers,
      ...dataRows
    ]
  }

  const setColumnWidths = (ws) => {
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 14 }, // NIS
      { wch: 30 }, // Nama Siswa
      { wch: 12 }, // Kelas
      { wch: 36 }, // Email
      { wch: 18 }, // Password
      { wch: 14 }, // Status
      { wch: 50 }, // Catatan
    ]
  }

  if (selectedClass !== 'all') {
    // Ekspor 1 kelas spesifik
    const filtered = accounts.filter(
      (a) => String(a.class || '').trim().toLowerCase() === String(selectedClass).trim().toLowerCase()
    )
    const rows = formatRows(filtered.length > 0 ? filtered : accounts)
    const ws = XLSX.utils.aoa_to_sheet(rows)
    setColumnWidths(ws)
    const sheetName = `Kelas ${String(selectedClass).replace(/[\/\\?*:[\]]/g, '_')}`.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `Daftar_Akun_Siswa_Kelas_${String(selectedClass).replace(/\s+/g, '_')}_${timestamp}.xlsx`
    )
    return
  }

  // Jika 'all', buat sheet "Semua Siswa" + sheet per kelas
  // 1. Sheet "Semua Siswa"
  const allRows = formatRows(accounts)
  const wsAll = XLSX.utils.aoa_to_sheet(allRows)
  setColumnWidths(wsAll)
  XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Siswa')

  // 2. Kelompokkan per kelas
  const classGroups = {}
  accounts.forEach((acc) => {
    const cls = acc.class ? String(acc.class).trim() : 'Tanpa Kelas'
    if (!classGroups[cls]) {
      classGroups[cls] = []
    }
    classGroups[cls].push(acc)
  })

  // Urutkan nama kelas
  const sortedClasses = Object.keys(classGroups).sort()

  sortedClasses.forEach((cls) => {
    const classRows = formatRows(classGroups[cls])
    const wsClass = XLSX.utils.aoa_to_sheet(classRows)
    setColumnWidths(wsClass)
    // Nama sheet max 31 karakter dan tidak boleh ada karakter khusus Excel
    const safeSheetName = `Kelas ${cls}`.replace(/[\/\\?*:[\]]/g, '_').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, wsClass, safeSheetName)
  })

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([wbout], { type: 'application/octet-stream' }),
    `Daftar_Akun_Siswa_Semua_Kelas_${timestamp}.xlsx`
  )
}
