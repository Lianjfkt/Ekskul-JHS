import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 GraduationCap, ShieldAlert, Check, Users, Save, Info
} from 'lucide-react'

export default function CoachGrades() {
 const { user } = useAuthStore()
 const [loading, setLoading] = useState(false)
 const [saving, setSaving] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')

 // Selection States
 const [managedEkskuls, setManagedEkskuls] = useState([])
 const [selectedEkskul, setSelectedEkskul] = useState('')
 const [selectedSemester, setSelectedSemester] = useState('Pertengahan Semester Ganjil')
 const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026')

 // Data States
 const [students, setStudents] = useState([])
 
 // Grades sheet state: { [studentId]: { attitude_score: '', skill_score: '', activity_score: '', notes: '' } }
 const [gradesSheet, setGradesSheet] = useState({})

 useEffect(() => {
 if (user) {
 fetchEkskuls()
 }
 }, [user])

 const fetchEkskuls = async () => {
 try {
 const { data, error } = await supabase
 .from('extracurriculars')
 .select('id, name')
 .eq('coach_id', user.id)
 if (error) throw error
 setManagedEkskuls(data || [])
 
 if (data && data.length > 0) {
 setSelectedEkskul(data[0].id)
 }
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat ekskul: ' + err.message)
 }
 }

 // Reload students and existing grades when selection details change
 useEffect(() => {
 if (selectedEkskul && selectedSemester && selectedAcademicYear) {
 loadGradesData(selectedEkskul, selectedSemester, selectedAcademicYear)
 } else {
 setStudents([])
 setGradesSheet({})
 }
 }, [selectedEkskul, selectedSemester, selectedAcademicYear])

 const loadGradesData = async (ekskulId, semester, academicYear) => {
 setLoading(true)
 setErrorMsg('')
 setSuccessMsg('')
 try {
 // 1. Get all students active in the extracurricular
 const { data: enrollments, error: enErr } = await supabase
 .from('enrollments')
 .select(`
 student_id,
 student:student_id (id, nis, full_name, class)
 `)
 .eq('extracurricular_id', ekskulId)
 .eq('status', 'active')
 if (enErr) throw enErr
 
 const studentList = enrollments ? enrollments.map(e => e.student) : []

 // 1.1 Fetch sessions to calculate attendance percentage dynamically
 const { data: sessionsData } = await supabase
 .from('sessions')
 .select('id')
 .eq('extracurricular_id', ekskulId)

 const sessionIds = (sessionsData || []).map(s => s.id)
 let attendancesData = []
 if (sessionIds.length > 0) {
 const { data: atts } = await supabase
 .from('attendances')
 .select('student_id, status')
 .in('session_id', sessionIds)
 attendancesData = atts || []
 }

 // Map dynamic attendance to each student object
 const enrichedStudents = studentList.map(student => {
 const studentAtts = attendancesData.filter(a => a.student_id === student.id)
 const total = studentAtts.length
 const hadir = studentAtts.filter(a => a.status === 'hadir').length
 const attendancePercentage = total > 0 ? Math.round((hadir / total) * 100) : 0
 return {
 ...student,
 attendancePercentage
 }
 })
 setStudents(enrichedStudents)

 // 2. Get existing grades for this combination
 const { data: gradesData, error: gErr } = await supabase
 .from('grades')
 .select('*')
 .eq('extracurricular_id', ekskulId)
 .eq('semester', semester)
 .eq('academic_year', academicYear)
 if (gErr) throw gErr

 // Map existing records to the sheet, default empty scores
 const sheet = {}
 enrichedStudents.forEach(student => {
 const record = gradesData?.find(r => r.student_id === student.id)
 if (record) {
 sheet[student.id] = {
 attitude_score: record.attitude_score !== null ? record.attitude_score.toString() : '',
 skill_score: record.skill_score !== null ? record.skill_score.toString() : '',
 activity_score: record.activity_score !== null ? record.activity_score.toString() : '',
 notes: record.notes || ''
 }
 } else {
 sheet[student.id] = {
 attitude_score: '',
 skill_score: '',
 activity_score: '',
 notes: ''
 }
 }
 })
 setGradesSheet(sheet)

 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat nilai: ' + err.message)
 } finally {
 setLoading(false)
 }
 }

 const handleScoreChange = (studentId, field, value) => {
 // Client-side score validation: must be a number between 0 and 100 or empty
 if (value !== '') {
 const num = parseInt(value)
 if (isNaN(num) || num < 0 || num > 100) return
 }
 
 setGradesSheet(sheet => ({
 ...sheet,
 [studentId]: {
 ...sheet[studentId],
 [field]: value
 }
 }))
 }

 const handleNotesChange = (studentId, notes) => {
 setGradesSheet(sheet => ({
 ...sheet,
 [studentId]: {
 ...sheet[studentId],
 notes
 }
 }))
 }

 const handleSaveGrades = async () => {
 if (!selectedEkskul) return
 setSaving(true)
 setErrorMsg('')
 setSuccessMsg('')

 try {
 // 1. Delete all existing grades for this combination (to avoid duplicate inserts)
 const { error: delError } = await supabase
 .from('grades')
 .delete()
 .eq('extracurricular_id', selectedEkskul)
 .eq('semester', selectedSemester)
 .eq('academic_year', selectedAcademicYear)
 
 if (delError) throw delError

 // 2. Format new grades records to insert (only map students where at least one score is entered)
 const recordsToInsert = students
 .map(student => {
 const sheet = gradesSheet[student.id] || {}
 
 // Parse score strings to integers or set to null
 const att = sheet.attitude_score !== '' ? parseInt(sheet.attitude_score) : null
 const sk = sheet.skill_score !== '' ? parseInt(sheet.skill_score) : null
 const act = sheet.activity_score !== '' ? parseInt(sheet.activity_score) : null
 
 return {
 student_id: student.id,
 extracurricular_id: selectedEkskul,
 semester: selectedSemester,
 academic_year: selectedAcademicYear,
 attitude_score: att,
 skill_score: sk,
 activity_score: act,
 notes: sheet.notes || '',
 graded_by: user.id,
 graded_at: new Date().toISOString()
 }
 })

 if (recordsToInsert.length > 0) {
 const { error: insError } = await supabase
 .from('grades')
 .insert(recordsToInsert)
 if (insError) throw insError
 }

 setSuccessMsg('Nilai perkembangan siswa berhasil disimpan.')
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal menyimpan nilai: ' + err.message)
 } finally {
 setSaving(false)
 }
 }

 return (
 <div className="space-y-6">
 {/* Alert Status */}
 {errorMsg && (
 <div className="p-4 bg-pixel-red/10 border-3 border-pixel-red rounded-none text-pixel-red text-sm flex items-start gap-3">
 <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
 <div>{errorMsg}</div>
 </div>
 )}
 {successMsg && (
 <div className="p-4 bg-pixel-green/15 border-3 border-pixel-green rounded-none text-pixel-green text-sm flex items-start gap-3">
 <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
 <div>{successMsg}</div>
 </div>
 )}

 {/* Header Panel */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pixel-panel p-6 rounded-none border border-pixel-gray/30 shadow-pixel-sm">
 <div>
 <h1 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white">Penilaian Perkembangan Siswa</h1>
 <p className="text-pixel-lavender text-sm">Input nilai sikap, keterampilan, dan aktivitas siswa binaan Anda per semester.</p>
 </div>
 {selectedEkskul && students.length > 0 && (
 <Button onClick={handleSaveGrades} disabled={saving} className="gap-2 w-full sm:w-auto">
 <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Nilai'}
 </Button>
 )}
 </div>

 {/* Selector Filters */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-pixel-panel p-6 rounded-none border border-pixel-gray/30 shadow-pixel-sm">
 <div className="space-y-1.5">
 <Label htmlFor="e_select">Pilih Ekstrakurikuler</Label>
 <select
 id="e_select"
 value={selectedEkskul}
 onChange={(e) => setSelectedEkskul(e.target.value)}
 className="flex h-11 w-full rounded-none border border-input bg-pixel-panel px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 >
 {managedEkskuls.map(e => (
 <option key={e.id} value={e.id}>{e.name}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="sem_select">Sesi Penilaian</Label>
 <select
 id="sem_select"
 value={selectedSemester}
 onChange={(e) => setSelectedSemester(e.target.value)}
 className="flex h-11 w-full rounded-none border border-input bg-pixel-panel px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 >
 <option value="Pertengahan Semester Ganjil">Pertengahan Semester Ganjil</option>
 <option value="Akhir Semester Ganjil">Akhir Semester Ganjil</option>
 <option value="Pertengahan Semester Genap">Pertengahan Semester Genap</option>
 <option value="Akhir Semester Genap">Akhir Semester Genap</option>
 </select>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="ta_select">Tahun Ajaran</Label>
 <Input
 id="ta_select"
 value={selectedAcademicYear}
 onChange={(e) => setSelectedAcademicYear(e.target.value)}
 placeholder="Contoh: 2025/2026"
 className="h-11 rounded-none"
 />
 </div>
 </div>

 {/* Grades Input Table */}
 {selectedEkskul ? (
 loading ? (
 <div className="p-8 text-center text-pixel-lavender font-medium">Memuat data nilai siswa...</div>
 ) : students.length === 0 ? (
 <div className="p-8 text-center text-pixel-lavender bg-pixel-panel rounded-none border border-pixel-gray/30 shadow-pixel-sm flex flex-col items-center gap-2">
 <Users className="w-10 h-10 text-pixel-peach" />
 <span>Belum ada siswa yang mendaftar di ekskul ini.</span>
 </div>
 ) : (
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
 <CardContent className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">Nama Siswa</th>
 <th className="px-6 py-4 w-12 text-center">Kelas</th>
 <th className="px-4 py-4 w-24 text-center">Absensi</th>
 <th className="px-4 py-4 w-28 text-center">Nilai Sikap</th>
 <th className="px-4 py-4 w-28 text-center">Nilai Keterampilan</th>
 <th className="px-4 py-4 w-28 text-center">Nilai Aktivitas</th>
 <th className="px-6 py-4 w-1/3">Catatan / Rekomendasi Pelatih</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {students.map(student => {
 const studentGr = gradesSheet[student.id] || { attitude_score: '', skill_score: '', activity_score: '', notes: '' }
 return (
 <tr key={student.id} className="hover:bg-pixel-navy/30">
 <td className="px-6 py-4 font-semibold text-pixel-white">
 <span className="block">{student.full_name}</span>
 <span className="text-xs text-pixel-lavender font-mono">NIS: {student.nis}</span>
 </td>
 <td className="px-6 py-4 text-center">
 <span className="px-2.5 py-1 font-retro text-base bg-slate-100 text-pixel-black rounded-none">{student.class}</span>
 </td>
 <td className="px-4 py-4 text-center font-bold font-mono text-pixel-peach">
 {student.attendancePercentage}%
 </td>
 <td className="px-4 py-4">
 <Input
 type="text"
 value={studentGr.attitude_score}
 onChange={(e) => handleScoreChange(student.id, 'attitude_score', e.target.value)}
 placeholder="0-100"
 className="text-center font-mono font-bold text-pixel-white"
 />
 </td>
 <td className="px-4 py-4">
 <Input
 type="text"
 value={studentGr.skill_score}
 onChange={(e) => handleScoreChange(student.id, 'skill_score', e.target.value)}
 placeholder="0-100"
 className="text-center font-mono font-bold text-pixel-white"
 />
 </td>
 <td className="px-4 py-4">
 <Input
 type="text"
 value={studentGr.activity_score}
 onChange={(e) => handleScoreChange(student.id, 'activity_score', e.target.value)}
 placeholder="0-100"
 className="text-center font-mono font-bold text-pixel-white"
 />
 </td>
 <td className="px-6 py-4">
 <Input
 type="text"
 placeholder="Rekomendasi / catatan perkembangan..."
 value={studentGr.notes}
 onChange={(e) => handleNotesChange(student.id, e.target.value)}
 className="w-full"
 />
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 )
 ) : (
 <div className="p-8 text-center text-pixel-lavender bg-pixel-panel rounded-none border border-pixel-gray/30 shadow-pixel-sm flex flex-col items-center gap-2">
 <Info className="w-8 h-8 text-pixel-peach" />
 <span>Silakan hubungi admin untuk mendaftarkan Anda ke ekstrakurikuler terlebih dahulu.</span>
 </div>
 )}
 </div>
 )
}
