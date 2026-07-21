import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 ClipboardCheck, Calendar, ShieldAlert, Check, 
 Users, AlertCircle, Save, Info, Trophy
} from 'lucide-react'

export default function CoachAttendances() {
 const { user } = useAuthStore()
 const [loading, setLoading] = useState(false)
 const [saving, setSaving] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')

 // Data States
 const [managedEkskuls, setManagedEkskuls] = useState([])
 const [sessions, setSessions] = useState([])
 const [students, setStudents] = useState([])
 
 // Selection States
 const [selectedEkskul, setSelectedEkskul] = useState('')
 const [selectedSession, setSelectedSession] = useState('')

 // Attendance state: { [studentId]: { status: 'hadir'|'izin'|'alpha', notes: '' } }
 const [attendanceSheet, setAttendanceSheet] = useState({})

 useEffect(() => {
 if (user) {
 fetchEkskuls()
 }
 }, [user])

 // Fetch managed extracurriculars
 const fetchEkskuls = async () => {
 try {
 const { data, error } = await supabase
 .from('extracurriculars')
 .select('id, name')
 .or(`coach_id.eq.${user.id},coach_id_2.eq.${user.id},coach_id_3.eq.${user.id}`)
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

 // Fetch sessions when selected extracurricular changes
 useEffect(() => {
 if (selectedEkskul) {
 fetchSessions(selectedEkskul)
 } else {
 setSessions([])
 setSelectedSession('')
 }
 }, [selectedEkskul])

 const fetchSessions = async (ekskulId) => {
 try {
 const { data, error } = await supabase
 .from('sessions')
 .select('id, session_date, topic, is_special_training, event_name')
 .eq('extracurricular_id', ekskulId)
 .order('session_date', { ascending: false })
 if (error) throw error
 setSessions(data || [])
 
 if (data && data.length > 0) {
 setSelectedSession(data[0].id)
 } else {
 setSelectedSession('')
 }
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat sesi: ' + err.message)
 }
 }

 // Load students and their existing attendance when session changes
 useEffect(() => {
 if (selectedEkskul && selectedSession) {
 loadAttendanceData(selectedEkskul, selectedSession)
 } else {
 setStudents([])
 setAttendanceSheet({})
 }
 }, [selectedEkskul, selectedSession])

 const loadAttendanceData = async (ekskulId, sessionId) => {
 setLoading(true)
 setErrorMsg('')
 setSuccessMsg('')
 try {
 // Check if session is special
 const sessionObj = sessions.find(s => s.id === sessionId)
 let studentList = []

 if (sessionObj && sessionObj.is_special_training) {
   // 1a. Get ONLY students invited to this special training
   const { data: specialParticipants, error: spErr } = await supabase
     .from('special_session_participants')
     .select(`
       student_id,
       student:student_id (id, nis, full_name, class)
     `)
     .eq('session_id', sessionId)
   if (spErr) throw spErr
   studentList = specialParticipants ? specialParticipants.map(sp => sp.student) : []
 } else {
   // 1b. Get all students active in the extracurricular
   const { data: enrollments, error: enErr } = await supabase
   .from('enrollments')
   .select(`
   student_id,
   student:student_id (id, nis, full_name, class)
   `)
   .eq('extracurricular_id', ekskulId)
   .eq('status', 'active')
   if (enErr) throw enErr
   studentList = enrollments ? enrollments.map(e => e.student) : []
 }
 
 setStudents(studentList)

 // 2. Get existing attendance for this session
 const { data: attendanceRecords, error: attErr } = await supabase
 .from('attendances')
 .select('*')
 .eq('session_id', sessionId)
 if (attErr) throw attErr

 // Map existing records to the sheet, default other students to 'hadir'
 const sheet = {}
 studentList.forEach(student => {
 const record = attendanceRecords?.find(r => r.student_id === student.id)
 if (record) {
 sheet[student.id] = {
 status: record.status,
 notes: record.notes || ''
 }
 } else {
 sheet[student.id] = {
 status: 'hadir',
 notes: ''
 }
 }
 })
 setAttendanceSheet(sheet)

 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat absensi: ' + err.message)
 } finally {
 setLoading(false)
 }
 }

 const handleStatusChange = (studentId, status) => {
 setAttendanceSheet(sheet => ({
 ...sheet,
 [studentId]: {
 ...sheet[studentId],
 status
 }
 }))
 }

 const handleNotesChange = (studentId, notes) => {
 setAttendanceSheet(sheet => ({
 ...sheet,
 [studentId]: {
 ...sheet[studentId],
 notes
 }
 }))
 }

 const handleSaveAttendance = async () => {
 if (!selectedSession) return
 setSaving(true)
 setErrorMsg('')
 setSuccessMsg('')

 try {
 // 1. Delete all existing attendance records for this session (to avoid duplicate inserts)
 const { error: delError } = await supabase
 .from('attendances')
 .delete()
 .eq('session_id', selectedSession)
 
 if (delError) throw delError

 // 2. Format new attendance records to insert
 const recordsToInsert = students.map(student => ({
 session_id: selectedSession,
 student_id: student.id,
 status: attendanceSheet[student.id]?.status || 'hadir',
 notes: attendanceSheet[student.id]?.notes || '',
 recorded_at: new Date().toISOString()
 }))

 if (recordsToInsert.length > 0) {
 const { error: insError } = await supabase
 .from('attendances')
 .insert(recordsToInsert)
 if (insError) throw insError
 }

 setSuccessMsg('Absensi berhasil disimpan.')
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal menyimpan absensi: ' + err.message)
 } finally {
 setSaving(false)
 }
 }

 // Count attendance stats for current selection
 const stats = students.reduce((acc, student) => {
 const status = attendanceSheet[student.id]?.status || 'hadir'
 acc[status] = (acc[status] || 0) + 1
 return acc
 }, { hadir: 0, izin: 0, alpha: 0 })

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
 <h1 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white">Pencatatan Kehadiran Siswa</h1>
 <p className="text-pixel-lavender text-sm">Pilih kelas ekskul dan sesi latihan, kemudian tandai status kehadiran setiap siswa.</p>
 </div>
 {selectedSession && students.length > 0 && (
 <Button onClick={handleSaveAttendance} disabled={saving} className="gap-2 w-full sm:w-auto">
 <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Absensi'}
 </Button>
 )}
 </div>

 {/* Selector Area */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-pixel-panel p-6 rounded-none border border-pixel-gray/30 shadow-pixel-sm">
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
 <Label htmlFor="s_select">Pilih Sesi Latihan</Label>
 <select
 id="s_select"
 value={selectedSession}
 onChange={(e) => setSelectedSession(e.target.value)}
 disabled={sessions.length === 0}
 className="flex h-11 w-full rounded-none border border-input bg-pixel-panel px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-pixel-navy disabled:text-pixel-lavender"
 >
 {sessions.length === 0 ? (
 <option value="">-- Tidak ada sesi ditemukan --</option>
 ) : (
 sessions.map(s => (
 <option key={s.id} value={s.id}>
 {new Date(s.session_date).toLocaleDateString('id-ID')} - {s.is_special_training ? `[KHUSUS] ${s.event_name}` : s.topic || 'Sesi Umum'}
 </option>
 ))
 )}
 </select>
 </div>
 </div>

 {/* Summary Stats */}
 {selectedSession && students.length > 0 && (
 <div className="grid grid-cols-3 gap-4">
 <div className="p-4 rounded-none bg-pixel-green/10 border border-emerald-100 text-center">
 <span className="font-retro text-sm text-pixel-green uppercase">Hadir</span>
 <h4 className="text-2xl font-extrabold text-emerald-800 mt-1">{stats.hadir}</h4>
 </div>
 <div className="p-4 rounded-none bg-amber-50 border border-amber-100 text-center">
 <span className="font-retro text-sm text-pixel-orange uppercase">Izin</span>
 <h4 className="text-2xl font-extrabold text-amber-800 mt-1">{stats.izin}</h4>
 </div>
 <div className="p-4 rounded-none bg-pixel-red/10 border border-rose-100 text-center">
 <span className="font-retro text-sm text-pixel-red uppercase">Alpha</span>
 <h4 className="text-2xl font-extrabold text-rose-800 mt-1">{stats.alpha}</h4>
 </div>
 </div>
 )}

 {/* Attendance Form */}
 {selectedSession ? (
 loading ? (
 <div className="p-8 text-center text-pixel-lavender font-medium">Memuat absensi siswa...</div>
 ) : students.length === 0 ? (
 <div className="p-8 text-center text-pixel-lavender bg-pixel-panel rounded-none border border-pixel-gray/30 shadow-pixel-sm flex flex-col items-center gap-2">
 <Users className="w-10 h-10 text-pixel-peach" />
 <span>Belum ada siswa yang mendaftar di ekskul ini atau terpilih di sesi ini.</span>
 </div>
 ) : (
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
 <CardContent className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4 w-1/4">NIS</th>
 <th className="px-6 py-4 w-1/4">Nama Siswa</th>
 <th className="px-6 py-4 w-1/12">Kelas</th>
 <th className="px-6 py-4 w-1/4 text-center">Kehadiran</th>
 <th className="px-6 py-4 w-1/4">Catatan</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {students.map(student => {
 const studentAtt = attendanceSheet[student.id] || { status: 'hadir', notes: '' }
 return (
 <tr key={student.id} className="hover:bg-pixel-navy/30">
 <td className="px-6 py-4 font-mono text-pixel-lavender">{student.nis}</td>
 <td className="px-6 py-4 font-semibold text-pixel-white">{student.full_name}</td>
 <td className="px-6 py-4">
 <span className="px-2.5 py-1 font-retro text-base bg-slate-100 text-pixel-black rounded-none">{student.class}</span>
 </td>
 <td className="px-6 py-4">
 <div className="flex justify-center gap-6">
 {['hadir', 'izin', 'alpha'].map(status => (
 <label key={status} className="flex items-center gap-1.5 cursor-pointer capitalize select-none font-retro text-base text-pixel-peach">
 <input
 type="radio"
 name={`attendance_${student.id}`}
 checked={studentAtt.status === status}
 onChange={() => handleStatusChange(student.id, status)}
 className={`h-4 w-4 border-slate-300 focus:ring-primary ${
 status === 'hadir' ? 'text-pixel-green' :
 status === 'izin' ? 'text-pixel-orange' : 'text-pixel-red'
 }`}
 />
 <span>{status}</span>
 </label>
 ))}
 </div>
 </td>
 <td className="px-6 py-4">
 <Input
 type="text"
 placeholder="Catatan (opsional)"
 value={studentAtt.notes}
 onChange={(e) => handleNotesChange(student.id, e.target.value)}
 className="h-9 text-xs"
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
 <span>Buat sesi latihan terlebih dahulu pada menu"Jadwal Sesi" sebelum menginput kehadiran.</span>
 </div>
 )}
 </div>
 )
}
