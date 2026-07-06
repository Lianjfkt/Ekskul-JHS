import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 Search, Plus, Trash2, BookOpen, GraduationCap, 
 X, Check, ShieldAlert, Calendar, Filter, Award, Upload
} from 'lucide-react'
import ImportCSVModal from '../../components/import/ImportCSVModal'

export default function EnrollmentManagement() {
 const [loading, setLoading] = useState(false)
 const [searchQuery, setSearchQuery] = useState('')
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')

 // Tab State ('aktif' / 'pending')
 const [activeTab, setActiveTab] = useState('aktif')

 // Filter States
 const [filterEkskul, setFilterEkskul] = useState('')
 const [filterSemester, setFilterSemester] = useState('')

 // Data States
 const [enrollments, setEnrollments] = useState([])
 const [students, setStudents] = useState([])
 const [extracurriculars, setExtracurriculars] = useState([])

 // Modal States
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [isImportModalOpen, setIsImportModalOpen] = useState(false)
 
 // Form States
 const [form, setForm] = useState({
 student_id: '',
 extracurricular_id: '',
 semester: 'Ganjil',
 academic_year: '2025/2026',
 status: 'active'
 })

 // Search/Filter for Student inside Form (Autocomplete)
 const [formStudentSearch, setFormStudentSearch] = useState('')
 const [showStudentDropdown, setShowStudentDropdown] = useState(false)

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
 .select('id, nis, full_name, class')
 .order('full_name', { ascending: true })
 if (sErr) throw sErr
 setStudents(studentsData || [])

 // 2. Fetch Extracurriculars
 const { data: ekskulData, error: eErr } = await supabase
 .from('extracurriculars')
 .select('id, name, is_active')
 .eq('is_active', true)
 .order('name', { ascending: true })
 if (eErr) throw eErr
 setExtracurriculars(ekskulData || [])

 // 3. Fetch Enrollments
 const { data: enrollmentsData, error: enErr } = await supabase
 .from('enrollments')
 .select(`
 *,
 student:student_id (nis, full_name, class, gender, phone),
 extracurricular:extracurricular_id (name)
 `)
 .order('enrolled_at', { ascending: false })
 if (enErr) throw enErr
 setEnrollments(enrollmentsData || [])
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat data pendaftaran: ' + err.message)
 } finally {
 setLoading(false)
 }
 }

 const handleOpenModal = () => {
 setForm({
 student_id: '',
 extracurricular_id: extracurriculars[0]?.id || '',
 semester: 'Ganjil',
 academic_year: '2025/2026',
 status: 'active'
 })
 setFormStudentSearch('')
 setShowStudentDropdown(false)
 setIsModalOpen(true)
 }

 const handleSubmit = async (e) => {
 e.preventDefault()
 setErrorMsg('')
 setSuccessMsg('')

 if (!form.student_id) {
 setErrorMsg('Harap pilih siswa terlebih dahulu.')
 return
 }

 try {
 // Periksa apakah pendaftaran yang sama sudah terdaftar
 const alreadyExists = enrollments.some(
 en => en.student_id === form.student_id && 
 en.extracurricular_id === form.extracurricular_id && 
 en.semester === form.semester && 
 en.academic_year === form.academic_year
 )

 if (alreadyExists) {
 throw new Error('Siswa tersebut sudah terdaftar di ekskul ini pada semester dan tahun ajaran yang dipilih.')
 }

 const { error } = await supabase
 .from('enrollments')
 .insert([form])
 if (error) throw error

 setSuccessMsg('Siswa berhasil didaftarkan ke ekstrakurikuler.')
 setIsModalOpen(false)
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }

 const handleDelete = async (id) => {
 if (!confirm('Apakah Anda yakin ingin menghapus/menolak data pendaftaran ini?')) return
 setErrorMsg('')
 try {
 const { error } = await supabase
 .from('enrollments')
 .delete()
 .eq('id', id)
 if (error) throw error
 setSuccessMsg('Pendaftaran berhasil dihapus/ditolak.')
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }

 const handleStatusChange = async (id, newStatus) => {
 setErrorMsg('')
 try {
 const { error } = await supabase
 .from('enrollments')
 .update({ status: newStatus })
 .eq('id', id)
 if (error) throw error
 setSuccessMsg(newStatus === 'active' ? 'Pendaftaran berhasil disetujui!' : 'Status pendaftaran berhasil diubah.')
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }

 // Filter Autocomplete Siswa di Form
 const filteredFormStudents = formStudentSearch.trim() === ''
 ? []
 : students.filter(s => 
 s.full_name.toLowerCase().includes(formStudentSearch.toLowerCase()) ||
 s.nis.includes(formStudentSearch)
 ).slice(0, 5) // Batasi 5 hasil

 const handleSelectStudent = (student) => {
 setForm({...form, student_id: student.id})
 setFormStudentSearch(`${student.full_name} (${student.class})`)
 setShowStudentDropdown(false)
 }

 // Filter List Pendaftaran
 const filteredEnrollments = enrollments.filter(en => {
 // Filter berdasarkan tab aktif
 if (activeTab === 'aktif' && en.status === 'pending') return false
 if (activeTab === 'pending' && en.status !== 'pending') return false

 const matchSearch = 
 en.student?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 en.student?.nis.includes(searchQuery) ||
 en.extracurricular?.name.toLowerCase().includes(searchQuery.toLowerCase())
 
 const matchEkskul = filterEkskul === '' || en.extracurricular_id === filterEkskul
 const matchSemester = filterSemester === '' || en.semester === filterSemester

 return matchSearch && matchEkskul && matchSemester
 })

 // Hitung jumlah pending approvals
 const pendingCount = enrollments.filter(en => en.status === 'pending').length

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
 <h1 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white">Manajemen Pendaftaran Ekskul</h1>
 <p className="text-pixel-lavender text-sm">Daftarkan siswa ke kelas ekstrakurikuler serta kelola status keaktifan mereka.</p>
 </div>
 <div className="flex gap-2 w-full sm:w-auto">
 <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2 flex-1 sm:flex-none">
 <Upload className="w-4 h-4" /> Import Excel
 </Button>
 <Button onClick={handleOpenModal} className="gap-2 flex-1 sm:flex-none">
 <Plus className="w-4 h-4" /> Daftarkan Siswa
 </Button>
 </div>
 </div>

 {/* Tabs Navigasi */}
 <div className="flex border-b border-pixel-gray gap-2">
 <button
 onClick={() => setActiveTab('aktif')}
 className={`flex items-center gap-2 px-4 py-3 font-retro text-lg border-b-2 -mb-px ${
 activeTab === 'aktif'
 ? 'border-primary text-primary'
 : 'border-transparent text-pixel-lavender hover:text-pixel-peach hover:border-slate-300'
 }`}
 >
 <Check className="w-4 h-4" />
 Pendaftaran Aktif
 </button>
 <button
 onClick={() => setActiveTab('pending')}
 className={`flex items-center gap-2 px-4 py-3 font-retro text-lg border-b-2 -mb-px relative ${
 activeTab === 'pending'
 ? 'border-primary text-primary'
 : 'border-transparent text-pixel-lavender hover:text-pixel-peach hover:border-slate-300'
 }`}
 >
 <Calendar className="w-4 h-4" />
 Permintaan Persetujuan
 {pendingCount > 0 && (
 <span className="ml-1.5 px-2 py-0.5 rounded-none bg-pixel-red/100 text-[10px] font-bold text-white">
 {pendingCount}
 </span>
 )}
 </button>
 </div>

 {/* Filter and Search Bar */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {/* Search */}
 <div className="relative md:col-span-2">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pixel-lavender w-5 h-5" />
 <Input
 type="text"
 placeholder="Cari pendaftaran berdasarkan nama siswa, NIS, atau ekskul..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10 h-11 bg-pixel-panel border-pixel-gray focus-visible:ring-primary rounded-none"
 />
 </div>

 {/* Filter Ekskul */}
 <div className="relative">
 <select
 value={filterEkskul}
 onChange={(e) => setFilterEkskul(e.target.value)}
 className="flex h-11 w-full rounded-none border border-input bg-pixel-panel px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 >
 <option value="">Semua Ekskul</option>
 {extracurriculars.map(e => (
 <option key={e.id} value={e.id}>{e.name}</option>
 ))}
 </select>
 </div>

 {/* Filter Semester */}
 <div>
 <select
 value={filterSemester}
 onChange={(e) => setFilterSemester(e.target.value)}
 className="flex h-11 w-full rounded-none border border-input bg-pixel-panel px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 >
 <option value="">Semua Semester</option>
 <option value="Ganjil">Semester Ganjil</option>
 <option value="Genap">Semester Genap</option>
 </select>
 </div>
 </div>

 {/* Enrollments Table */}
 <Card className="border-pixel-gray/30 shadow-pixel-sm overflow-hidden bg-pixel-panel">
 <CardContent className="p-0">
 {loading ? (
 <div className="p-8 text-center text-pixel-lavender">Memuat data pendaftaran...</div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">NIS</th>
 <th className="px-6 py-4">Nama Siswa</th>
 <th className="px-6 py-4">Kelas</th>
 {activeTab === 'pending' && <th className="px-6 py-4">No. Telp</th>}
 <th className="px-6 py-4">Ekstrakurikuler</th>
 <th className="px-6 py-4">Semester</th>
 <th className="px-6 py-4">Tahun Ajaran</th>
 {activeTab === 'aktif' && <th className="px-6 py-4">Status</th>}
 <th className="px-6 py-4 text-right">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {filteredEnrollments.length === 0 ? (
 <tr>
 <td colSpan={activeTab === 'pending' ? 8 : 8} className="px-6 py-8 text-center text-pixel-lavender">
 Tidak ada pendaftaran ditemukan.
 </td>
 </tr>
 ) : (
 filteredEnrollments.map(en => {
 let statusStyle = 'bg-slate-100 text-pixel-peach'
 if (en.status === 'active') statusStyle = 'bg-emerald-100 text-pixel-green font-bold'
 if (en.status === 'inactive') statusStyle = 'bg-amber-100 text-amber-700'
 if (en.status === 'completed') statusStyle = 'bg-blue-100 text-blue-700 font-bold'

 return (
 <tr key={en.id} className="hover:bg-pixel-navy/55">
 <td className="px-6 py-4 font-mono text-pixel-peach">{en.student?.nis}</td>
 <td className="px-6 py-4 font-medium text-pixel-white">{en.student?.full_name}</td>
 <td className="px-6 py-4">
 <span className="px-2.5 py-1 font-retro text-base bg-slate-100 text-pixel-black rounded-none">{en.student?.class}</span>
 </td>
 {activeTab === 'pending' && (
 <td className="px-6 py-4 text-pixel-lavender font-mono text-xs">{en.student?.phone || '-'}</td>
 )}
 <td className="px-6 py-4 font-bold text-slate-950 flex items-center gap-1.5 mt-2.5">
 <Award className="w-4 h-4 text-primary" />
 {en.extracurricular?.name}
 </td>
 <td className="px-6 py-4">{en.semester}</td>
 <td className="px-6 py-4 text-pixel-lavender font-mono text-xs">{en.academic_year}</td>
 {activeTab === 'aktif' && (
 <td className="px-6 py-4">
 <select
 value={en.status}
 onChange={(e) => handleStatusChange(en.id, e.target.value)}
 className={`px-2.5 py-1 rounded-none font-retro text-base border-0 cursor-pointer focus:ring-2 focus:ring-primary ${statusStyle}`}
 >
 <option value="active" className="bg-pixel-panel text-pixel-white">Aktif</option>
 <option value="inactive" className="bg-pixel-panel text-pixel-white">Non-aktif</option>
 <option value="completed" className="bg-pixel-panel text-pixel-white">Selesai</option>
 </select>
 </td>
 )}
 <td className="px-6 py-4 text-right">
 {activeTab === 'aktif' ? (
 <Button onClick={() => handleDelete(en.id)} variant="ghost" size="icon" className="h-8 w-8 text-pixel-red hover:bg-pixel-red/10 hover:text-pixel-red">
 <Trash2 className="w-4 h-4" />
 </Button>
 ) : (
 <div className="flex justify-end gap-2">
 <Button 
 onClick={() => handleStatusChange(en.id, 'active')}
 size="sm"
 className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8 text-xs"
 >
 <Check className="w-3.5 h-3.5" /> Setujui
 </Button>
 <Button 
 onClick={() => handleDelete(en.id)}
 variant="outline"
 size="sm"
 className="text-pixel-red border-destructive/20 hover:bg-pixel-red/10 gap-1 h-8 text-xs"
 >
 <X className="w-3.5 h-3.5" /> Tolak
 </Button>
 </div>
 )}
 </td>
 </tr>
 )
 })
 )}
 </tbody>
 </table>
 </div>
 )}
 </CardContent>
 </Card>

 {/* --- MODAL DAFTARKAN SISWA --- */}
 {isModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-md overflow-hidden pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy">
 <h3 className="font-bold text-pixel-white text-lg flex items-center gap-2">
 <BookOpen className="w-5 h-5 text-primary" />
 Pendaftaran Baru
 </h3>
 <Button onClick={() => setIsModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 <form onSubmit={handleSubmit} className="p-6 space-y-4">
 
 {/* Autocomplete Input untuk Cari Siswa */}
 <div className="space-y-1.5 relative">
 <Label htmlFor="s_search">Cari Siswa (Ketik Nama / NIS)</Label>
 <div className="relative">
 <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-pixel-lavender w-4 h-4" />
 <Input
 id="s_search"
 required
 placeholder="Contoh: Budi, 2026..."
 value={formStudentSearch}
 onChange={(e) => {
 setFormStudentSearch(e.target.value)
 setShowStudentDropdown(true)
 if (!e.target.value) {
 setForm({...form, student_id: ''})
 }
 }}
 onFocus={() => setShowStudentDropdown(true)}
 className="pl-9"
 />
 </div>
 
 {/* Autocomplete Dropdown List */}
 {showStudentDropdown && filteredFormStudents.length > 0 && (
 <div className="absolute z-10 w-full mt-1 bg-pixel-panel border border-pixel-gray rounded-none shadow-pixel max-h-40 overflow-y-auto divide-y-2 divide-pixel-gray/30">
 {filteredFormStudents.map(student => (
 <button
 type="button"
 key={student.id}
 onClick={() => handleSelectStudent(student)}
 className="w-full text-left px-4 py-2 text-sm hover:bg-pixel-navy flex flex-col"
 >
 <span className="font-medium text-pixel-white">{student.full_name}</span>
 <span className="text-xs text-pixel-lavender font-mono">NIS: {student.nis} • Kelas: {student.class}</span>
 </button>
 ))}
 </div>
 )}
 {showStudentDropdown && formStudentSearch.length > 0 && filteredFormStudents.length === 0 && !form.student_id && (
 <div className="absolute z-10 w-full mt-1 bg-pixel-panel border border-pixel-gray rounded-none shadow-pixel p-3 text-center text-xs text-pixel-lavender">
 Siswa tidak ditemukan.
 </div>
 )}
 </div>

 {/* Pilih Ekskul */}
 <div className="space-y-1.5">
 <Label htmlFor="e_select">Pilih Ekstrakurikuler</Label>
 <select
 id="e_select"
 required
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 value={form.extracurricular_id}
 onChange={e => setForm({...form, extracurricular_id: e.target.value})}
 >
 {extracurriculars.map(e => (
 <option key={e.id} value={e.id}>{e.name}</option>
 ))}
 </select>
 </div>

 <div className="grid grid-cols-2 gap-4">
 {/* Semester */}
 <div className="space-y-1.5">
 <Label htmlFor="sem_select">Semester</Label>
 <select
 id="sem_select"
 required
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
 value={form.semester}
 onChange={e => setForm({...form, semester: e.target.value})}
 >
 <option value="Ganjil">Ganjil</option>
 <option value="Genap">Genap</option>
 </select>
 </div>

 {/* Tahun Ajaran */}
 <div className="space-y-1.5">
 <Label htmlFor="ta_select">Tahun Ajaran</Label>
 <Input
 id="ta_select"
 required
 placeholder="Contoh: 2025/2026"
 value={form.academic_year}
 onChange={e => setForm({...form, academic_year: e.target.value})}
 />
 </div>
 </div>

 <div className="pt-4 border-t border-pixel-gray/30 flex justify-end gap-2">
 <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">Batal</Button>
 <Button type="submit">Daftarkan</Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* --- MODAL IMPORT ENROLLMENT --- */}
 <ImportCSVModal
 isOpen={isImportModalOpen}
 onClose={() => setIsImportModalOpen(false)}
 type="enrollments"
 onSuccess={() => { fetchData(); setSuccessMsg('Import enrollment selesai! Data pendaftaran telah diperbarui.') }}
 />
 </div>
 )
}
