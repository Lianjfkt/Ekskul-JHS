import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 Search, Plus, Trash2, Edit2, CalendarDays, BookOpen, 
 X, Check, ShieldAlert, FileText, ChevronRight
} from 'lucide-react'

export default function CoachSessions() {
 const { user } = useAuthStore()
 const [loading, setLoading] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')

 // Data States
 const [sessions, setSessions] = useState([])
 const [managedEkskuls, setManagedEkskuls] = useState([])

 // Modal States
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [selectedSession, setSelectedSession] = useState(null)

 // Form States
 const [form, setForm] = useState({
 extracurricular_id: '',
 session_date: new Date().toISOString().split('T')[0],
 topic: '',
 notes: ''
 })

 useEffect(() => {
 if (user) {
 fetchData()
 }
 }, [user])

 const fetchData = async () => {
 setLoading(true)
 setErrorMsg('')
 try {
 // 1. Fetch managed extracurriculars
 const { data: ekskuls, error: eErr } = await supabase
 .from('extracurriculars')
 .select('id, name')
 .or(`coach_id.eq.${user.id},coach_id_2.eq.${user.id}`)
 if (eErr) throw eErr
 setManagedEkskuls(ekskuls || [])

 if (ekskuls && ekskuls.length > 0) {
 const ekskulIds = ekskuls.map(e => e.id)
 
 // 2. Fetch sessions under these extracurriculars
 const { data: sessionsData, error: sErr } = await supabase
 .from('sessions')
 .select(`
 *,
 extracurricular:extracurricular_id (name)
 `)
 .in('extracurricular_id', ekskulIds)
 .order('session_date', { ascending: false })
 if (sErr) throw sErr
 setSessions(sessionsData || [])

 // Set default extracurricular in form if not set
 setForm(f => ({...f, extracurricular_id: ekskuls[0].id}))
 }
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat data sesi: ' + err.message)
 } finally {
 setLoading(false)
 }
 }

 const handleOpenModal = (session = null) => {
 if (session) {
 setSelectedSession(session)
 setForm({
 extracurricular_id: session.extracurricular_id,
 session_date: session.session_date,
 topic: session.topic || '',
 notes: session.notes || ''
 })
 } else {
 setSelectedSession(null)
 setForm({
 extracurricular_id: managedEkskuls[0]?.id || '',
 session_date: new Date().toISOString().split('T')[0],
 topic: '',
 notes: ''
 })
 }
 setIsModalOpen(true)
 }

 const handleSubmit = async (e) => {
 e.preventDefault()
 setErrorMsg('')
 setSuccessMsg('')
 try {
 if (selectedSession) {
 // Edit Mode
 const { error } = await supabase
 .from('sessions')
 .update({
 extracurricular_id: form.extracurricular_id,
 session_date: form.session_date,
 topic: form.topic,
 notes: form.notes
 })
 .eq('id', selectedSession.id)
 if (error) throw error
 setSuccessMsg('Sesi latihan berhasil diperbarui.')
 } else {
 // Create Mode
 const { error } = await supabase
 .from('sessions')
 .insert([
 {
 extracurricular_id: form.extracurricular_id,
 session_date: form.session_date,
 topic: form.topic,
 notes: form.notes,
 created_by: user.id
 }
 ])
 if (error) throw error
 setSuccessMsg('Sesi latihan baru berhasil dibuat.')
 }
 setIsModalOpen(false)
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
 }
 }

 const handleDelete = async (id) => {
 if (!confirm('Apakah Anda yakin ingin menghapus sesi ini? Semua data absensi siswa pada sesi ini juga akan dihapus.')) return
 setErrorMsg('')
 try {
 const { error } = await supabase
 .from('sessions')
 .delete()
 .eq('id', id)
 if (error) throw error
 setSuccessMsg('Sesi latihan berhasil dihapus.')
 fetchData()
 } catch (err) {
 setErrorMsg(err.message)
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
 <h1 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white">Jadwal & Log Sesi Latihan</h1>
 <p className="text-pixel-lavender text-sm">Catat setiap pertemuan latihan, materi/topik yang dibahas, dan catatan khusus.</p>
 </div>
 {managedEkskuls.length > 0 && (
 <Button onClick={() => handleOpenModal()} className="gap-2 w-full sm:w-auto">
 <Plus className="w-4 h-4" /> Tambah Sesi
 </Button>
 )}
 </div>

 {/* Main Content */}
 {loading ? (
 <div className="p-8 text-center text-pixel-lavender font-medium">Memuat data sesi...</div>
 ) : managedEkskuls.length === 0 ? (
 <div className="bg-pixel-panel p-12 text-center text-pixel-lavender rounded-none border border-pixel-gray">
 Anda belum memiliki ekskul asuhan. Hubungi Admin untuk mendaftarkan Anda sebagai pelatih ekskul terlebih dahulu.
 </div>
 ) : (
 <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
 <CardContent className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
 <th className="px-6 py-4">Tanggal</th>
 <th className="px-6 py-4">Ekstrakurikuler</th>
 <th className="px-6 py-4">Topik / Materi Latihan</th>
 <th className="px-6 py-4">Catatan Sesi</th>
 <th className="px-6 py-4 text-right">Aksi</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
 {sessions.length === 0 ? (
 <tr>
 <td colSpan={5} className="px-6 py-8 text-center text-pixel-lavender">Belum ada sesi latihan yang dibuat.</td>
 </tr>
 ) : (
 sessions.map(session => (
 <tr key={session.id} className="hover:bg-pixel-panel-light">
 <td className="px-6 py-4 font-mono font-semibold text-pixel-white flex items-center gap-1.5 mt-2">
 <CalendarDays className="w-4 h-4 text-primary" />
 {new Date(session.session_date).toLocaleDateString('id-ID', {
 weekday: 'short',
 year: 'numeric',
 month: 'short',
 day: 'numeric'
 })}
 </td>
 <td className="px-6 py-4 font-bold text-pixel-white">{session.extracurricular?.name}</td>
 <td className="px-6 py-4 font-semibold text-pixel-white">{session.topic || 'Sesi Umum'}</td>
 <td className="px-6 py-4 text-pixel-lavender max-w-xs truncate">{session.notes || '-'}</td>
 <td className="px-6 py-4 text-right space-x-2">
 <Button onClick={() => handleOpenModal(session)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-pixel-panel-light hover:text-primary">
 <Edit2 className="w-4 h-4" />
 </Button>
 <Button onClick={() => handleDelete(session.id)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-pixel-red/10 text-pixel-red hover:text-pixel-red">
 <Trash2 className="w-4 h-4" />
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 )}

 {/* --- MODAL TAMBAH/EDIT SESI --- */}
 {isModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-md overflow-hidden pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy">
 <h3 className="font-bold text-pixel-white text-lg flex items-center gap-2">
 <FileText className="w-5 h-5 text-primary" />
 {selectedSession ? 'Ubah Sesi Latihan' : 'Buat Sesi Latihan Baru'}
 </h3>
 <Button onClick={() => setIsModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 <form onSubmit={handleSubmit} className="p-6 space-y-4">
 
 {/* Pilih Ekskul */}
 <div className="space-y-1.5">
 <Label htmlFor="s_ekskul">Ekstrakurikuler</Label>
 <select
 id="s_ekskul"
 required
 className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 value={form.extracurricular_id}
 onChange={e => setForm({...form, extracurricular_id: e.target.value})}
 >
 {managedEkskuls.map(e => (
 <option key={e.id} value={e.id}>{e.name}</option>
 ))}
 </select>
 </div>

 {/* Tanggal Sesi */}
 <div className="space-y-1.5">
 <Label htmlFor="s_date">Tanggal Latihan</Label>
 <Input
 id="s_date"
 type="date"
 required
 value={form.session_date}
 onChange={e => setForm({...form, session_date: e.target.value})}
 />
 </div>

 {/* Topik Latihan */}
 <div className="space-y-1.5">
 <Label htmlFor="s_topic">Materi / Topik Latihan</Label>
 <Input
 id="s_topic"
 required
 placeholder="Contoh: Teknik Dribbling, Latihan Fisik"
 value={form.topic}
 onChange={e => setForm({...form, topic: e.target.value})}
 />
 </div>

 {/* Catatan Sesi */}
 <div className="space-y-1.5">
 <Label htmlFor="s_notes">Catatan & Evaluasi Sesi</Label>
 <textarea
 id="s_notes"
 className="flex min-h-[80px] w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 placeholder="Masukkan evaluasi atau poin-poin latihan..."
 value={form.notes}
 onChange={e => setForm({...form, notes: e.target.value})}
 />
 </div>

 <div className="pt-4 border-t border-pixel-gray/30 flex justify-end gap-2">
 <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">Batal</Button>
 <Button type="submit">Simpan Sesi</Button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 )
}
