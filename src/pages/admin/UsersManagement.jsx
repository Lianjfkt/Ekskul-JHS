import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 Search, Plus, Upload, Trash2, Edit2, UserPlus, 
 Users as UsersIcon, ShieldAlert, GraduationCap, 
 UserCheck, Check, X
} from 'lucide-react'
import ImportCSVModal from '../../components/import/ImportCSVModal'



export default function UsersManagement() {
 const [activeTab, setActiveTab] = useState('siswa')
 const [searchQuery, setSearchQuery] = useState('')
 const [loading, setLoading] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')

 // Data States
 const [students, setStudents] = useState([])
 const [coaches, setCoaches] = useState([])
 const [parents, setParents] = useState([])
 const [allUsers, setAllUsers] = useState([])

 // Modal States
 const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
 const [isUserModalOpen, setIsUserModalOpen] = useState(false)
 const [isImportModalOpen, setIsImportModalOpen] = useState(false)
 const [selectedStudent, setSelectedStudent] = useState(null)
 const [selectedUser, setSelectedUser] = useState(null)

 // Form States - Student
 const [studentForm, setStudentForm] = useState({
 nis: '',
 full_name: '',
 class: '',
 gender: 'Laki-laki',
 phone: '',
 email: '',
 password: ''
 })

 // Form States - User (Coach/Parent/Admin)
 const [userForm, setUserForm] = useState({
 email: '',
 password: '',
 full_name: '',
 role: 'coach',
 student_id: ''
 })



 useEffect(() => {
 fetchData()
 }, [])

 const fetchData = async () => {
 setLoading(true)
 setErrorMsg('')
 try {
 // 1. Fetch Students
 const { data: studentsData, error: sErr } = await supabase
 .from('students')
 .select(`
 *,
 users:users!student_id (id, email)
 `)
 .order('full_name', { ascending: true })
 if (sErr) throw sErr
 setStudents(studentsData || [])

 // 2. Fetch Users (Coaches, Parents, Admins)
 const { data: usersData, error: uErr } = await supabase
 .from('users')
 .select(`
 *,
 students:student_id (full_name, class)
 `)
 .order('role', { ascending: true })
 if (uErr) throw uErr
 setAllUsers(usersData || [])
 setCoaches(usersData?.filter(u => u.role === 'coach') || [])
 setParents(usersData?.filter(u => u.role === 'parent') || [])
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal mengambil data dari database: ' + err.message)
 } finally {
 setLoading(false)
 }
 }

 // --- STUDENT CRUD FUNCTIONS ---
 const handleOpenStudentModal = (student = null) => {
 if (student) {
 const associatedUser = student.users?.[0]
 setSelectedStudent(student)
 setStudentForm({
 nis: student.nis,
 full_name: student.full_name,
 class: student.class,
 gender: student.gender || 'Laki-laki',
 phone: student.phone || '',
 email: associatedUser?.email || '',
 password: ''
 })
 } else {
 setSelectedStudent(null)
 setStudentForm({
 nis: '',
 full_name: '',
 class: '',
 gender: 'Laki-laki',
 phone: '',
 email: '',
 password: ''
 })
 }
 setIsStudentModalOpen(true)
 }

 const handleStudentSubmit = async (e) => {
 e.preventDefault()
 setErrorMsg('')
 setSuccessMsg('')
 try {
 const toTitleCase = (str) => {
 return str
 .toLowerCase()
 .split(' ')
 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
 .join(' ');
 }

 const cleanName = toTitleCase(studentForm.full_name.trim())
 const cleanEmail = studentForm.email.toLowerCase().trim()

 if (selectedStudent) {
 // Edit Mode
 const { error } = await supabase
 .from('students')
 .update({
 nis: studentForm.nis.trim(),
 full_name: cleanName,
 class: studentForm.class.trim(),
 gender: studentForm.gender,
 phone: studentForm.phone.trim()
 })
 .eq('id', selectedStudent.id)
 if (error) throw error

 const associatedUser = selectedStudent.users?.[0]
 if (associatedUser) {
 // Update credentials if email changed or password was typed
 if (associatedUser.email !== cleanEmail || (studentForm.password && studentForm.password.length >= 6)) {
 const { error: uErr } = await supabase.rpc('admin_update_user', {
 p_user_id: associatedUser.id,
 p_email: cleanEmail,
 p_password: studentForm.password || null,
 p_full_name: cleanName,
 p_student_id: selectedStudent.id
 })
 if (uErr) throw uErr
 }
 } else if (cleanEmail) {
 // Create login account if email was provided for the first time
 if (!studentForm.password || studentForm.password.length < 6) {
 throw new Error('Password minimal 6 karakter diperlukan untuk membuat akun baru.')
 }
 const { error: uErr } = await supabase.rpc('admin_create_user', {
 p_email: cleanEmail,
 p_password: studentForm.password,
 p_full_name: cleanName,
 p_role: 'student',
 p_student_id: selectedStudent.id
 })
 if (uErr) throw uErr
 }

 setSuccessMsg('Berhasil memperbarui data siswa.')
 } else {
 // Insert Mode
 const { data: newStudent, error: sErr } = await supabase
 .from('students')
 .insert([{
 nis: studentForm.nis.trim(),
 full_name: cleanName,
 class: studentForm.class.trim(),
 gender: studentForm.gender,
 phone: studentForm.phone.trim()
 }])
 .select()
 .single()
 if (sErr) throw sErr

 if (cleanEmail) {
 if (!studentForm.password || studentForm.password.length < 6) {
 throw new Error('Password minimal 6 karakter diperlukan untuk membuat akun baru.')
 }
 const { error: uErr } = await supabase.rpc('admin_create_user', {
 p_email: cleanEmail,
 p_password: studentForm.password,
 p_full_name: cleanName,
 p_role: 'student',
 p_student_id: newStudent.id
 })
 if (uErr) throw uErr
 }

 setSuccessMsg('Berhasil menambahkan siswa baru.')
 }
 setIsStudentModalOpen(false)
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }

 const handleStudentDelete = async (student) => {
 if (!confirm(`Apakah Anda yakin ingin menghapus siswa"${student.full_name}"? Ini juga akan menghapus akun login dan semua data absensi/nilai terkait.`)) return
 setErrorMsg('')
 try {
 const associatedUser = student.users?.[0]
 if (associatedUser) {
 // Clean delete from auth
 const { error: uErr } = await supabase.rpc('admin_delete_user', {
 p_user_id: associatedUser.id
 })
 if (uErr) throw uErr
 }

 const { error: sErr } = await supabase
 .from('students')
 .delete()
 .eq('id', student.id)
 if (sErr) throw sErr

 setSuccessMsg('Berhasil menghapus data siswa dan akun login terkait.')
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }

 // --- USER CRUD FUNCTIONS (Coaches, Parents, Admins) ---
 const handleOpenUserModal = (role = 'coach') => {
 setUserForm({
 email: '',
 password: '',
 full_name: '',
 role: role,
 student_id: ''
 })
 setIsUserModalOpen(true)
 }

 const handleUserSubmit = async (e) => {
 e.preventDefault()
 setErrorMsg('')
 setSuccessMsg('')
 try {
 // Call Postgres Function admin_create_user via RPC
 const { data, error } = await supabase.rpc('admin_create_user', {
 p_email: userForm.email,
 p_password: userForm.password,
 p_full_name: userForm.full_name,
 p_role: userForm.role,
 p_student_id: userForm.role === 'parent' || userForm.role === 'student' ? userForm.student_id || null : null
 })

 if (error) throw error

 // Jika role parent, kita juga sinkronisasi ke tabel public.parents
 if (userForm.role === 'parent' && userForm.student_id) {
 const { error: pErr } = await supabase
 .from('parents')
 .insert([{
 student_id: userForm.student_id,
 full_name: userForm.full_name,
 relationship: 'Orang Tua'
 }])
 if (pErr) console.warn('Gagal sinkron ke tabel parents:', pErr.message)
 }

 setSuccessMsg(`Berhasil membuat akun ${userForm.role} baru dengan ID: ${data}`)
 setIsUserModalOpen(false)
 fetchData()
 } catch (err) {
 setErrorMsg(`Gagal membuat user. Pastikan Anda telah menjalankan script SQL update_schema_admin_user_creation.sql di Supabase. Error: ${err.message}`)
 }
 }

 const handleUserDelete = async (id, email) => {
 if (email === 'admin@sekolah.com') {
 alert('Akun administrator utama tidak dapat dihapus.')
 return
 }
 if (!confirm('Apakah Anda yakin ingin menghapus akun pengguna ini? Data autentikasi Supabase terkait juga akan terpengaruh.')) return
 setErrorMsg('')
 try {
 const { error } = await supabase.rpc('admin_delete_user', {
 p_user_id: id
 })
 if (error) throw error
 setSuccessMsg('Berhasil menghapus akun pengguna.')
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }



 // Filter Data berdasarkan Search
 const filteredStudents = students.filter(s => 
 s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 s.nis.includes(searchQuery) ||
 s.class.toLowerCase().includes(searchQuery.toLowerCase())
 )

 const filteredCoaches = coaches.filter(c => 
 c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 c.email.toLowerCase().includes(searchQuery.toLowerCase())
 )

 const filteredParents = parents.filter(p => 
 p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 p.email.toLowerCase().includes(searchQuery.toLowerCase())
 )

 const filteredAllUsers = allUsers.filter(u => 
 u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
 u.role.toLowerCase().includes(searchQuery.toLowerCase())
 )

 return (
 <div className="space-y-6">
 {/* Alert Status */}
 {errorMsg && (
 <div className="p-4 bg-pixel-red/10 border-3 border-pixel-red rounded-none text-pixel-red text-sm flex items-start gap-3 animate-pulse">
 <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
 <div>
 <span className="font-semibold">Terjadi Kesalahan: </span>
 {errorMsg}
 </div>
 </div>
 )}
 {successMsg && (
 <div className="p-4 bg-pixel-green/15 border-3 border-pixel-green rounded-none text-pixel-green text-sm flex items-start gap-3">
 <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
 <div>
 <span className="font-semibold">Sukses: </span>
 {successMsg}
 </div>
 </div>
 )}

 {/* Header Panel */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pixel-panel p-6 rounded-none border border-pixel-gray/30 shadow-pixel-sm">
 <div>
 <h1 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white">Manajemen Pengguna</h1>
 <p className="text-pixel-lavender text-sm">Kelola data siswa, pelatih, wali murid, dan akun sistem Anda.</p>
 </div>
 <div className="flex gap-2 w-full sm:w-auto">
 {activeTab === 'siswa' && (
 <>
 <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2 flex-1 sm:flex-none">
 <Upload className="w-4 h-4" /> Import Excel/CSV
 </Button>
 <Button onClick={() => handleOpenStudentModal()} className="gap-2 flex-1 sm:flex-none">
 <Plus className="w-4 h-4" /> Siswa Baru
 </Button>
 <Button onClick={() => handleOpenUserModal('student')} className="gap-2 flex-1 sm:flex-none" variant="secondary">
 <UserPlus className="w-4 h-4" /> Buat Akun Login Siswa
 </Button>
 </>
 )}
 {activeTab === 'pelatih' && (
 <Button onClick={() => handleOpenUserModal('coach')} className="gap-2 w-full sm:w-auto">
 <UserPlus className="w-4 h-4" /> Pelatih Baru
 </Button>
 )}
 {activeTab === 'parent' && (
 <Button onClick={() => handleOpenUserModal('parent')} className="gap-2 w-full sm:w-auto">
 <UserPlus className="w-4 h-4" /> Wali Murid Baru
 </Button>
 )}
 </div>
 </div>

 {/* Tabs Navigasi */}
 <div className="flex border-b border-pixel-gray gap-2">
 {[
 { id: 'siswa', label: 'Data Siswa', icon: GraduationCap },
 { id: 'pelatih', label: 'Pelatih', icon: UserCheck },
 { id: 'parent', label: 'Wali Murid', icon: UsersIcon },
 { id: 'semua', label: 'Semua Akun', icon: ShieldAlert }
 ].map(tab => {
 const Icon = tab.icon
 const isActive = activeTab === tab.id
 return (
 <button
 key={tab.id}
 onClick={() => { setActiveTab(tab.id); setErrorMsg(''); setSuccessMsg(''); }}
 className={`flex items-center gap-2 px-4 py-3 font-retro text-lg border-b-2 -mb-px ${
 isActive 
 ? 'border-primary text-primary' 
 : 'border-transparent text-pixel-lavender hover:text-pixel-peach hover:border-slate-300'
 }`}
 >
 <Icon className="w-4 h-4" />
 {tab.label}
 </button>
 )
 })}
 </div>

 {/* Search Bar */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pixel-lavender w-5 h-5" />
 <Input
 type="text"
 placeholder={`Cari berdasarkan nama, email, atau kelas...`}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10 h-11 bg-pixel-panel border-pixel-gray focus-visible:ring-primary rounded-none"
 />
 </div>

 {/* Main Table / Grid Content */}
 <Card className="border-pixel-gray/30 shadow-pixel-sm overflow-hidden">
 <CardContent className="p-0">
 {loading ? (
 <div className="p-8 text-center text-pixel-lavender">Memuat data dari database...</div>
 ) : (
 <>
 {/* TAB SISWA */}
 {activeTab === 'siswa' && (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">NIS</th>
 <th className="px-6 py-4">Nama Lengkap</th>
 <th className="px-6 py-4">Kelas</th>
 <th className="px-6 py-4">Gender</th>
 <th className="px-6 py-4">No. Telepon</th>
 <th className="px-6 py-4">Email Akun</th>
 <th className="px-6 py-4 text-right">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {filteredStudents.length === 0 ? (
 <tr>
 <td colSpan={7} className="px-6 py-8 text-center text-pixel-lavender">Tidak ada data siswa ditemukan.</td>
 </tr>
 ) : (
 filteredStudents.map(student => (
 <tr key={student.id} className="hover:bg-pixel-navy/55">
 <td className="px-6 py-4 font-mono font-semibold text-pixel-white">{student.nis}</td>
 <td className="px-6 py-4 font-medium text-pixel-white">{student.full_name}</td>
 <td className="px-6 py-4">
 <span className="px-2.5 py-1 font-retro text-base bg-slate-100 text-pixel-black rounded-none">{student.class}</span>
 </td>
 <td className="px-6 py-4">{student.gender}</td>
 <td className="px-6 py-4 text-pixel-lavender">{student.phone || '-'}</td>
 <td className="px-6 py-4 text-pixel-peach font-mono text-xs">{student.users?.[0]?.email || <span className="text-pixel-lavender italic">Belum ada akun</span>}</td>
 <td className="px-6 py-4 text-right space-x-2">
 <Button onClick={() => handleOpenStudentModal(student)} variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
 <Edit2 className="w-4 h-4" />
 </Button>
 <Button onClick={() => handleStudentDelete(student)} variant="ghost" size="icon" className="h-8 w-8 text-pixel-red hover:bg-pixel-red/10 hover:text-pixel-red">
 <Trash2 className="w-4 h-4" />
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 )}

 {/* TAB PELATIH */}
 {activeTab === 'pelatih' && (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">Nama Pelatih</th>
 <th className="px-6 py-4">Email</th>
 <th className="px-6 py-4">Terdaftar Pada</th>
 <th className="px-6 py-4 text-right">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {filteredCoaches.length === 0 ? (
 <tr>
 <td colSpan={4} className="px-6 py-8 text-center text-pixel-lavender">Tidak ada data pelatih ditemukan.</td>
 </tr>
 ) : (
 filteredCoaches.map(coach => (
 <tr key={coach.id} className="hover:bg-pixel-navy/55">
 <td className="px-6 py-4 font-medium text-pixel-white">{coach.full_name}</td>
 <td className="px-6 py-4 text-pixel-lavender">{coach.email}</td>
 <td className="px-6 py-4 text-pixel-lavender">{new Date(coach.created_at).toLocaleDateString('id-ID')}</td>
 <td className="px-6 py-4 text-right">
 <Button onClick={() => handleUserDelete(coach.id, coach.email)} variant="ghost" size="icon" className="h-8 w-8 text-pixel-red hover:bg-pixel-red/10 hover:text-pixel-red">
 <Trash2 className="w-4 h-4" />
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 )}

 {/* TAB WALI MURID */}
 {activeTab === 'parent' && (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">Nama Wali Murid</th>
 <th className="px-6 py-4">Email</th>
 <th className="px-6 py-4">Siswa (Anak)</th>
 <th className="px-6 py-4">Kelas Anak</th>
 <th className="px-6 py-4 text-right">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {filteredParents.length === 0 ? (
 <tr>
 <td colSpan={5} className="px-6 py-8 text-center text-pixel-lavender">Tidak ada data wali murid ditemukan.</td>
 </tr>
 ) : (
 filteredParents.map(parent => (
 <tr key={parent.id} className="hover:bg-pixel-navy/55">
 <td className="px-6 py-4 font-medium text-pixel-white">{parent.full_name}</td>
 <td className="px-6 py-4 text-pixel-lavender">{parent.email}</td>
 <td className="px-6 py-4 font-semibold text-pixel-white">{parent.students?.full_name || '-'}</td>
 <td className="px-6 py-4">
 {parent.students?.class ? (
 <span className="px-2.5 py-1 font-retro text-base bg-primary/10 text-primary rounded-none">{parent.students.class}</span>
 ) : '-'}
 </td>
 <td className="px-6 py-4 text-right">
 <Button onClick={() => handleUserDelete(parent.id, parent.email)} variant="ghost" size="icon" className="h-8 w-8 text-pixel-red hover:bg-pixel-red/10 hover:text-pixel-red">
 <Trash2 className="w-4 h-4" />
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 )}

 {/* TAB SEMUA AKUN */}
 {activeTab === 'semua' && (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">Nama Pengguna</th>
 <th className="px-6 py-4">Email</th>
 <th className="px-6 py-4">Peran (Role)</th>
 <th className="px-6 py-4">Akun Terdaftar</th>
 <th className="px-6 py-4 text-right">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {filteredAllUsers.length === 0 ? (
 <tr>
 <td colSpan={5} className="px-6 py-8 text-center text-pixel-lavender">Tidak ada data akun ditemukan.</td>
 </tr>
 ) : (
 filteredAllUsers.map(user => {
 let roleColor = 'bg-slate-100 text-pixel-peach'
 if (user.role === 'admin') roleColor = 'bg-rose-100 text-rose-700'
 if (user.role === 'coach') roleColor = 'bg-sky-100 text-sky-700'
 if (user.role === 'parent') roleColor = 'bg-amber-100 text-amber-700'
 if (user.role === 'student') roleColor = 'bg-teal-100 text-teal-700'

 return (
 <tr key={user.id} className="hover:bg-pixel-navy/55">
 <td className="px-6 py-4 font-medium text-pixel-white">{user.full_name}</td>
 <td className="px-6 py-4 text-pixel-lavender">{user.email}</td>
 <td className="px-6 py-4">
 <span className={`px-2.5 py-1 font-retro text-base rounded-none capitalize ${roleColor}`}>
 {user.role}
 </span>
 </td>
 <td className="px-6 py-4 text-pixel-lavender">{new Date(user.created_at).toLocaleDateString('id-ID')}</td>
 <td className="px-6 py-4 text-right">
 <Button 
 onClick={() => handleUserDelete(user.id, user.email)} 
 disabled={user.email === 'admin@sekolah.com'}
 variant="ghost" 
 size="icon" 
 className="h-8 w-8 text-pixel-red hover:bg-pixel-red/10 hover:text-pixel-red disabled:opacity-30"
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </td>
 </tr>
 )
 })
 )}
 </tbody>
 </table>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>

 {/* --- MODAL TAMBAH/EDIT SISWA --- */}
 {isStudentModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-md overflow-hidden pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy">
 <h3 className="font-bold text-pixel-white text-lg">
 {selectedStudent ? 'Ubah Data Siswa' : 'Tambah Siswa Baru'}
 </h3>
 <Button onClick={() => setIsStudentModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 <form onSubmit={handleStudentSubmit} className="p-6 space-y-4">
 <div className="space-y-1.5">
 <Label htmlFor="nis">Nomor Induk Siswa (NIS)</Label>
 <Input
 id="nis"
 required
 disabled={!!selectedStudent}
 placeholder="Contoh: 202601001"
 value={studentForm.nis}
 onChange={e => setStudentForm({...studentForm, nis: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="full_name">Nama Lengkap</Label>
 <Input
 id="full_name"
 required
 placeholder="Contoh: Budi Santoso"
 value={studentForm.full_name}
 onChange={e => setStudentForm({...studentForm, full_name: e.target.value})}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <Label htmlFor="class">Kelas</Label>
 <Input
 id="class"
 required
 placeholder="Contoh: VII-A"
 value={studentForm.class}
 onChange={e => setStudentForm({...studentForm, class: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="gender">Gender</Label>
 <select
 id="gender"
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
 value={studentForm.gender}
 onChange={e => setStudentForm({...studentForm, gender: e.target.value})}
 >
 <option value="Laki-laki">Laki-laki</option>
 <option value="Perempuan">Perempuan</option>
 </select>
 </div>
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="phone">No. Telepon / HP</Label>
 <Input
 id="phone"
 placeholder="Contoh: 08123456789"
 value={studentForm.phone}
 onChange={e => setStudentForm({...studentForm, phone: e.target.value})}
 />
 </div>
 <div className="border-t border-pixel-gray/30 pt-3 mt-3">
 <p className="font-retro text-base text-pixel-lavender uppercase tracking-wider mb-2">Akun Login Siswa (Opsional)</p>
 <div className="space-y-3">
 <div className="space-y-1.5">
 <Label htmlFor="s_email">Email Akun</Label>
 <Input
 id="s_email"
 type="email"
 placeholder="Contoh: siswa@jhs.com"
 value={studentForm.email}
 onChange={e => setStudentForm({...studentForm, email: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="s_pass">{selectedStudent?.users?.[0] ? 'Ubah Password (Kosongkan jika tidak diubah)' : 'Password Awal'}</Label>
 <Input
 id="s_pass"
 type="password"
 placeholder={selectedStudent?.users?.[0] ? 'Masukkan password baru' : 'Min. 6 karakter'}
 value={studentForm.password}
 onChange={e => setStudentForm({...studentForm, password: e.target.value})}
 />
 </div>
 </div>
 </div>
 <div className="pt-4 border-t border-pixel-gray/30 flex justify-end gap-2">
 <Button type="button" onClick={() => setIsStudentModalOpen(false)} variant="outline">Batal</Button>
 <Button type="submit">Simpan</Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* --- MODAL TAMBAH AKUN (COACH/PARENT/STUDENT) --- */}
 {isUserModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-md overflow-hidden pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy">
 <h3 className="font-bold text-pixel-white text-lg">
 Daftar Akun {userForm.role === 'coach' ? 'Pelatih' : userForm.role === 'parent' ? 'Wali Murid' : 'Siswa'} Baru
 </h3>
 <Button onClick={() => setIsUserModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
 <div className="space-y-1.5">
 <Label htmlFor="u_name">Nama Lengkap</Label>
 <Input
 id="u_name"
 required
 placeholder="Nama Lengkap"
 value={userForm.full_name}
 onChange={e => setUserForm({...userForm, full_name: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="u_email">Email Login</Label>
 <Input
 id="u_email"
 type="email"
 required
 placeholder={userForm.role === 'student' ?"Contoh: siswa@sekolah.com" :"Contoh: email@sekolah.com"}
 value={userForm.email}
 onChange={e => setUserForm({...userForm, email: e.target.value})}
 />
 </div>
 <div className="space-y-1.5">
 <Label htmlFor="u_pass">Password Awal (Min. 6 Karakter)</Label>
 <Input
 id="u_pass"
 type="password"
 required
 placeholder="Password akun"
 value={userForm.password}
 onChange={e => setUserForm({...userForm, password: e.target.value})}
 />
 </div>
 
 {/* Dropdown Siswa jika mendaftarkan Wali Murid atau Siswa */}
 {(userForm.role === 'parent' || userForm.role === 'student') && (
 <div className="space-y-1.5">
 <Label htmlFor="u_student">Hubungkan ke Profil Siswa</Label>
 <select
 id="u_student"
 required
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 value={userForm.student_id}
 onChange={e => setUserForm({...userForm, student_id: e.target.value})}
 >
 <option value="">-- Pilih Siswa --</option>
 {students.map(st => (
 <option key={st.id} value={st.id}>{st.full_name} ({st.class})</option>
 ))}
 </select>
 </div>
 )}

 <div className="pt-4 border-t border-pixel-gray/30 flex justify-end gap-2">
 <Button type="button" onClick={() => setIsUserModalOpen(false)} variant="outline">Batal</Button>
 <Button type="submit">Daftarkan Akun</Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* --- MODAL IMPORT CSV SISWA (new robust modal) --- */}
 <ImportCSVModal
 isOpen={isImportModalOpen}
 onClose={() => setIsImportModalOpen(false)}
 type="students"
 onSuccess={() => { fetchData(); setSuccessMsg('Import selesai! Tabel siswa telah diperbarui.') }}
 />
 </div>
 )
}
