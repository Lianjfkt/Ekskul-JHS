import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 Activity, Clock, User, ChevronRight, Layers, 
 Loader2, Plus, X, Check, ShieldAlert, Award 
} from 'lucide-react'

function StatusBadge({ status }) {
 if (status === 'active') return (
 <span className="inline-flex items-center gap-1 font-retro text-base px-2 py-0.5 rounded-none bg-emerald-100 text-pixel-green">
 <span className="w-1.5 h-1.5 rounded-none bg-pixel-green/100"></span> Aktif
 </span>
 )
 if (status === 'pending') return (
 <span className="inline-flex items-center gap-1 font-retro text-base px-2 py-0.5 rounded-none bg-amber-100 text-amber-700">
 <span className="w-1.5 h-1.5 rounded-none bg-amber-500 animate-pulse"></span> Menunggu Persetujuan
 </span>
 )
 return (
 <span className="inline-flex items-center gap-1 font-retro text-base px-2 py-0.5 rounded-none bg-slate-100 text-pixel-lavender">
 <span className="w-1.5 h-1.5 rounded-none bg-slate-400"></span> Tidak Aktif
 </span>
 )
}

export default function StudentExtracurriculars() {
 const { studentId } = useAuthStore()
 const [enrollments, setEnrollments] = useState([])
 const [loading, setLoading] = useState(true)
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [availableEkskuls, setAvailableEkskuls] = useState([])
 const [selectedEkskulId, setSelectedEkskulId] = useState('')
 
 // Notification states
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')
 const [submitting, setSubmitting] = useState(false)

 // Student Profile Form State
 const [studentForm, setStudentForm] = useState({
 nis: '',
 full_name: '',
 class: '',
 gender: 'Laki-laki',
 phone: ''
 })

 // Enrollment Form State
 const [enrollForm, setEnrollForm] = useState({
 semester: 'Ganjil',
 academic_year: '2026/2027'
 })

 useEffect(() => {
 if (studentId) {
 fetchEnrollments()
 }
 }, [studentId])

 const fetchEnrollments = async () => {
 setLoading(true)
 try {
 const { data, error } = await supabase
 .from('enrollments')
 .select(`
 id, semester, academic_year, status,
 extracurriculars(
 id, name, description, schedule, is_active,
 coach:coach_id(full_name), coach2:coach_id_2(full_name), coach3:coach_id_3(full_name)
 )
 `)
 .eq('student_id', studentId)
 .order('enrolled_at', { ascending: false })

 if (error) throw error
 setEnrollments(data || [])
 } catch (err) {
 console.error('StudentExtracurriculars error:', err)
 } finally {
 setLoading(false)
 }
 }

 const fetchStudentProfile = async () => {
 if (!studentId) return
 try {
 const { data, error } = await supabase
 .from('students')
 .select('*')
 .eq('id', studentId)
 .single()
 if (error) throw error
 if (data) {
 setStudentForm({
 nis: data.nis || '',
 full_name: data.full_name || '',
 class: data.class || '',
 gender: data.gender || 'Laki-laki',
 phone: data.phone || ''
 })
 }
 } catch (err) {
 console.error('Error fetching student profile:', err)
 }
 }

 const fetchAvailableEkskuls = async (currentEnrollments) => {
 try {
 const { data, error } = await supabase
 .from('extracurriculars')
 .select('*')
 .eq('is_active', true)
 .order('name', { ascending: true })

 if (error) throw error

 const enrolledIds = currentEnrollments.map(e => e.extracurriculars?.id)
 const available = (data || []).filter(item => !enrolledIds.includes(item.id))
 setAvailableEkskuls(available)
 if (available.length > 0) {
 setSelectedEkskulId(available[0].id)
 } else {
 setSelectedEkskulId('')
 }
 } catch (err) {
 console.error('Error fetching available ekskuls:', err)
 }
 }

 const handleOpenRegisterModal = async () => {
 setErrorMsg('')
 setSuccessMsg('')
 await fetchStudentProfile()
 await fetchAvailableEkskuls(enrollments)
 setIsModalOpen(true)
 }

 const handleSubmitRegistration = async (e) => {
 e.preventDefault()
 setErrorMsg('')
 setSuccessMsg('')
 
 if (!selectedEkskulId) {
 setErrorMsg('Silakan pilih ekstrakurikuler terlebih dahulu.')
 return
 }

 const activeAndPendingCount = enrollments.filter(e => e.status === 'active' || e.status === 'pending').length
 if (activeAndPendingCount >= 3) {
 setErrorMsg('Gagal: Anda telah mencapai batas maksimal pendaftaran (3 Ekstrakurikuler).')
 return
 }

 setSubmitting(true)
 try {
 // 1. Update Student Profile Data
 const { error: studentErr } = await supabase
 .from('students')
 .update({
 nis: studentForm.nis,
 full_name: studentForm.full_name,
 class: studentForm.class,
 gender: studentForm.gender,
 phone: studentForm.phone
 })
 .eq('id', studentId)

 if (studentErr) throw studentErr

 // 2. Insert new Enrollment with status 'pending'
 const { error: enrollErr } = await supabase
 .from('enrollments')
 .insert([{
 student_id: studentId,
 extracurricular_id: selectedEkskulId,
 semester: enrollForm.semester,
 academic_year: enrollForm.academic_year,
 status: 'pending'
 }])

 if (enrollErr) throw enrollErr

 setSuccessMsg('Pendaftaran berhasil diajukan! Menunggu persetujuan admin.')
 setIsModalOpen(false)
 fetchEnrollments()
 } catch (err) {
 setErrorMsg(err.message)
 } finally {
 setSubmitting(false)
 }
 }

 const handleCancelPending = async (enrollmentId) => {
 if (!confirm('Apakah Anda yakin ingin membatalkan permohonan pendaftaran ini?')) return
 setErrorMsg('')
 setSuccessMsg('')
 try {
 const { error } = await supabase
 .from('enrollments')
 .delete()
 .eq('id', enrollmentId)
 .eq('status', 'pending')

 if (error) throw error
 setSuccessMsg('Permohonan pendaftaran berhasil dibatalkan.')
 fetchEnrollments()
 } catch (err) {
 setErrorMsg('Gagal membatalkan permohonan: ' + err.message)
 }
 }

 return (
 <div className="space-y-6">
 {/* Alert Notifications */}
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

 {/* Header */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pixel-panel p-6 rounded-none border border-violet-50 shadow-pixel-sm">
 <div>
 <h1 className="text-xl font-bold text-pixel-white">Ekskul Saya</h1>
 <p className="text-sm text-pixel-lavender mt-0.5">Semua ekstrakurikuler yang kamu ikuti atau daftarkan</p>
 </div>
 <Button onClick={handleOpenRegisterModal} className="gap-2 w-full sm:w-auto shadow-pixel-sm bg-violet-600 hover:bg-violet-700">
 <Plus className="w-4 h-4" /> Daftar Ekskul Baru
 </Button>
 </div>

 {loading ? (
 <div className="space-y-3">
 {[1, 2, 3].map(i => (
 <div key={i} className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 animate-pulse">
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-none bg-slate-200"></div>
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-slate-200 rounded w-1/2"></div>
 <div className="h-3 bg-slate-100 rounded w-3/4"></div>
 <div className="h-3 bg-slate-100 rounded w-1/3"></div>
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : enrollments.length === 0 ? (
 <div className="bg-pixel-panel rounded-none p-12 text-center border border-violet-50 shadow-pixel-sm">
 <Layers className="w-12 h-12 text-violet-200 mx-auto mb-4" />
 <h3 className="font-semibold text-pixel-peach mb-1">Belum Ada Ekskul</h3>
 <p className="text-sm text-pixel-lavender">Kamu belum terdaftar atau mengajukan ekskul apapun.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {enrollments.map(enr => {
 const ekskul = enr.extracurriculars
 const coachName = [
    ekskul?.coach?.full_name,
    ekskul?.coach2?.full_name,
    ekskul?.coach3?.full_name
  ].filter(Boolean).join(', ')

 return (
 <div
 key={enr.id}
 className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 hover:brightness-110 hover:border-violet-200 group"
 >
 <Link
 to={enr.status === 'active' ? `/student/extracurriculars/${ekskul?.id}` : '#'}
 onClick={(e) => enr.status !== 'active' && e.preventDefault()}
 className={`flex items-center gap-4 flex-1 min-w-0 ${enr.status === 'active' ? 'cursor-pointer' : 'cursor-default'}`}
 >
 {/* Icon */}
 <div className="w-12 h-12 rounded-none bg-pixel-purple/15 flex items-center justify-center shrink-0 group-hover:bg-pixel-purple/25">
 <Activity className="w-6 h-6 text-pixel-purple" />
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-bold text-pixel-white group-hover:text-violet-700">
 {ekskul?.name}
 </h3>
 <StatusBadge status={enr.status} />
 </div>
 <div className="flex items-center gap-4 mt-1.5 flex-wrap">
 {coachName && (
 <span className="flex items-center gap-1 text-xs text-pixel-lavender">
 <User className="w-3 h-3" />
 {coachName}
 </span>
 )}
 <span className="flex items-center gap-1 text-xs text-pixel-lavender">
 <Clock className="w-3 h-3" />
 {ekskul?.schedule || 'Jadwal belum diatur'}
 </span>
 </div>
 <p className="text-xs text-pixel-lavender mt-1 line-clamp-1">
 {ekskul?.description || 'Tidak ada deskripsi.'}
 </p>
 </div>
 </Link>

 <div className="flex items-center gap-3 self-end sm:self-center">
 {enr.status === 'pending' && (
 <Button 
 onClick={() => handleCancelPending(enr.id)} 
 variant="outline" 
 className="text-xs text-pixel-red border-destructive/20 hover:bg-pixel-red/10 h-8 px-3 rounded-none"
 >
 Batalkan
 </Button>
 )}
 {enr.status === 'active' && (
 <Link
 to={`/student/extracurriculars/${ekskul?.id}`}
 className="flex items-center justify-center w-8 h-8 rounded-none hover:bg-violet-50"
 >
 <ChevronRight className="w-5 h-5 text-pixel-peach group-hover:text-violet-500 group-hover:translate-x-1 shrink-0" />
 </Link>
 )}
 </div>
 </div>
 )
 })}
 </div>
 )}

 {/* --- MODAL DAFTAR EKSKUL & DATA DIRI --- */}
 {isModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-lg overflow-hidden my-8 pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy">
 <h3 className="font-bold text-pixel-white text-lg flex items-center gap-2">
 <Award className="w-5 h-5 text-pixel-purple" />
 Pendaftaran & Pembaruan Data Diri
 </h3>
 <Button onClick={() => setIsModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 
 <form onSubmit={handleSubmitRegistration} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
 
 {/* Form Data Diri Siswa */}
 <div className="space-y-4 bg-violet-50/40 p-4 rounded-none border border-violet-100">
 <h4 className="text-sm font-bold text-violet-800 uppercase tracking-wider">Lengkapi Data Diri Anda</h4>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <Label htmlFor="nis" className="text-pixel-peach">Nomor Induk Siswa (NIS)</Label>
 <Input
 id="nis"
 required
 placeholder="Masukkan NIS Anda"
 value={studentForm.nis}
 onChange={e => setStudentForm({...studentForm, nis: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="full_name" className="text-pixel-peach">Nama Lengkap</Label>
 <Input
 id="full_name"
 required
 placeholder="Nama Lengkap sesuai Rapor"
 value={studentForm.full_name}
 onChange={e => setStudentForm({...studentForm, full_name: e.target.value})}
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <Label htmlFor="class" className="text-pixel-peach">Kelas</Label>
 <Input
 id="class"
 required
 placeholder="Contoh: VIII-B"
 value={studentForm.class}
 onChange={e => setStudentForm({...studentForm, class: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="gender" className="text-pixel-peach">Gender</Label>
 <select
 id="gender"
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 value={studentForm.gender}
 onChange={e => setStudentForm({...studentForm, gender: e.target.value})}
 >
 <option value="Laki-laki">Laki-laki</option>
 <option value="Perempuan">Perempuan</option>
 </select>
 </div>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="phone" className="text-pixel-peach">Nomor Telepon / WhatsApp</Label>
 <Input
 id="phone"
 required
 placeholder="Contoh: 081234567890"
 value={studentForm.phone}
 onChange={e => setStudentForm({...studentForm, phone: e.target.value})}
 />
 </div>
 </div>

 {/* Form Pemilihan Ekskul */}
 <div className="space-y-4">
 <h4 className="text-sm font-bold text-pixel-white uppercase tracking-wider">Pilih Ekstrakurikuler</h4>
 
 <div className="space-y-1.5">
 <Label htmlFor="ekskul_select" className="text-pixel-peach">Ekstrakurikuler yang Diminati</Label>
 {availableEkskuls.length === 0 ? (
 <div className="p-3 bg-slate-100 rounded-none text-pixel-lavender text-sm text-center">
 Anda sudah terdaftar atau mengajukan semua ekstrakurikuler yang tersedia.
 </div>
 ) : (
 <select
 id="ekskul_select"
 required
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 value={selectedEkskulId}
 onChange={e => setSelectedEkskulId(e.target.value)}
 >
 {availableEkskuls.map(ekskul => (
 <option key={ekskul.id} value={ekskul.id}>
 {ekskul.name} ({ekskul.schedule || 'Jadwal belum diatur'})
 </option>
 ))}
 </select>
 )}
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <Label htmlFor="semester" className="text-pixel-peach">Semester</Label>
 <select
 id="semester"
 required
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
 value={enrollForm.semester}
 onChange={e => setEnrollForm({...enrollForm, semester: e.target.value})}
 >
 <option value="Ganjil">Ganjil</option>
 <option value="Genap">Genap</option>
 </select>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="academic_year" className="text-pixel-peach">Tahun Ajaran</Label>
 <Input
 id="academic_year"
 required
 placeholder="Contoh: 2026/2027"
 value={enrollForm.academic_year}
 onChange={e => setEnrollForm({...enrollForm, academic_year: e.target.value})}
 />
 </div>
 </div>
 </div>

 <div className="pt-4 border-t border-pixel-gray/30 flex justify-end gap-2">
 <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">
 Batal
 </Button>
 <Button 
 type="submit" 
 disabled={submitting || availableEkskuls.length === 0}
 className="bg-violet-600 hover:bg-violet-700 text-pixel-white"
 >
 {submitting ? 'Mengirim...' : 'Ajukan Pendaftaran'}
 </Button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 )
}
