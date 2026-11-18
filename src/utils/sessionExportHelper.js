// src/utils/sessionExportHelper.js
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { saveAs } from 'file-saver'
import { addKopSuratToPDF } from './pdfHelper'

export async function exportSessionAttendanceToExcel({
  session,
  extracurricular,
  coachName,
  rows = []
}) {
  const XLSX = await import('xlsx')
  
  const dateFormatted = session?.session_date
    ? new Date(session.session_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''

  const excelRows = (rows || []).map((r, i) => [
    i + 1,
    r.nis || '-',
    r.studentName || '-',
    r.class || '-',
    r.status === 'hadir' ? 'Hadir' : r.status === 'izin' ? 'Izin' : r.status === 'alpha' ? 'Alpa' : 'Belum Diabsen',
    r.notes || '-',
    r.status === 'alpha' ? `${r.consecutiveAlpha || 0}x` : '-',
    r.status === 'alpha' ? `${r.totalAlpha || 0}x` : '-',
    r.warningLevel || '-',
    r.actionRecommendation || '-'
  ])

  const headers = [
    'No',
    'NIS',
    'Nama Siswa',
    'Kelas',
    'Status Kehadiran',
    'Keterangan / Izin',
    'Alpa Berturut-turut',
    'Total Alpa Semester',
    'Status Sanksi',
    'Rekomendasi BK'
  ]

  const ws = XLSX.utils.aoa_to_sheet([
    [`REKAP KEHADIRAN SESI LATIHAN EKSTRAKURIKULER`],
    [`Ekskul: ${extracurricular?.name || '-'} | Tanggal: ${dateFormatted} | Pelatih: ${coachName || '-'}`],
    [`Materi: ${session?.topic || '-'} | Catatan: ${session?.notes || '-'}`],
    [],
    headers,
    ...excelRows
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi Sesi')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const filename = `rekap_sesi_${(extracurricular?.name || 'ekskul').toLowerCase().replace(/\s+/g, '_')}_${session?.session_date || 'tanggal'}.xlsx`
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename)
}

export async function exportSessionAttendanceToPDF({
  session,
  extracurricular,
  coachName,
  rows = [],
  stats = {}
}) {
  const doc = new jsPDF()
  const startY = (await addKopSuratToPDF(doc)) || 20

  const dateFormatted = session?.session_date
    ? new Date(session.session_date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '-'

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('BERITA ACARA & REKAP KEHADIRAN SESI LATIHAN', doc.internal.pageSize.getWidth() / 2, startY + 6, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const leftX = 14
  let currentY = startY + 14

  doc.text(`Ekstrakurikuler : ${extracurricular?.name || '-'}`, leftX, currentY)
  doc.text(`Pelatih           : ${coachName || '-'}`, leftX, currentY + 5)
  doc.text(`Hari / Tanggal  : ${dateFormatted}`, leftX, currentY + 10)
  doc.text(`Materi Sesi     : ${session?.topic || '-'}`, leftX, currentY + 15)

  const rightX = 125
  doc.text(`Total Peserta  : ${stats?.total || 0} Siswa`, rightX, currentY)
  doc.text(`Hadir              : ${stats?.hadir || 0} Siswa (${stats?.pct || 0}%)`, rightX, currentY + 5)
  doc.text(`Izin / Sakit      : ${stats?.izin || 0} Siswa`, rightX, currentY + 10)
  doc.text(`Alpa               : ${stats?.alpha || 0} Siswa`, rightX, currentY + 15)

  const tableData = (rows || []).map((r, idx) => [
    idx + 1,
    r.nis || '-',
    r.studentName || '-',
    r.class || '-',
    r.status === 'hadir' ? 'Hadir' : r.status === 'izin' ? 'Izin' : r.status === 'alpha' ? 'ALPA' : 'Belum Diabsen',
    r.status === 'alpha' && (r.consecutiveAlpha > 1) ? `⚠️ ${r.consecutiveAlpha}x streak` : (r.notes || '-'),
    r.warningLevel || '-'
  ])

  doc.autoTable({
    startY: currentY + 22,
    head: [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Kehadiran', 'Keterangan / Streak', 'Level Sanksi']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 50 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 25 },
      5: { cellWidth: 40 },
      6: { halign: 'center', cellWidth: 25 }
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 4) {
        if (data.cell.raw === 'ALPA') {
          data.cell.styles.textColor = [231, 76, 60]
          data.cell.styles.fontStyle = 'bold'
        } else if (data.cell.raw === 'Hadir') {
          data.cell.styles.textColor = [39, 174, 96]
        }
      }
    }
  })

  // Signatures
  let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY + 40) + 15
  if (finalY > 240) {
    doc.addPage()
    finalY = 25
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  doc.text(`Mengetahui,`, 20, finalY)
  doc.text(`Pelatih Ekstrakurikuler`, 20, finalY + 6)
  doc.text(`( ${coachName || '................................'} )`, 20, finalY + 30)

  doc.text(`Jakarta, ${todayStr}`, pageWidth - 70, finalY)
  doc.text(`Koordinator / Admin Ekskul`, pageWidth - 70, finalY + 6)
  doc.text(`( ................................ )`, pageWidth - 70, finalY + 30)

  const filename = `rekap_sesi_${(extracurricular?.name || 'ekskul').toLowerCase().replace(/\s+/g, '_')}_${session?.session_date || 'tanggal'}.pdf`
  doc.save(filename)
}
