import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
 Search, Plus, Trash2, Edit2, CalendarDays, BookOpen, 
 X, Check, ShieldAlert, FileText, ChevronRight, Trophy
} from 'lucide-react'

export default function CoachSessions() {
 const { user } = useAuthStore()
 const [loading, setLoading] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')

 // Data States
 const [sessions, setSessions] = useState([])
 const [managedEkskuls, setManagedEkskuls] = useState([])
 const [enrolledStudents, setEnrolledStudents] = useState([])

 // Modal States
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [selectedSession, setSelectedSession] = useState(null)

 // Form States
 const [form, setForm] = useState({
 extracurricular_id: '',
 session_date: new Date().toISOString().split('T')[0],
 topic: '',
 notes: '',
 coaches_present: [],
 is_special_training: false,
 event_name: '',
 selected_students: []
 })

 useEffect(() => {
 if (user) {
 fetchData()
 }
 }, [user])

 useEffect(() => {
   if (form.extracurricular_id && form.is_special_training) {
     fetchEnrolledStudents(form.extracurricular_id)
   }
 }, [form.extracurricular_id, form.is_special_training])

 const fetchData = async () => {
 setLoading(true)
 setErrorMsg('')
 try {
 // 1. Fetch managed extracurriculars
 const { data: ekskuls, error: eErr } = await supabase
 .from('extracurriculars')
 .select('id, name, coach_id, coach_id_2, coach_id_3, coach:coach_id(id, full_name), coach2:coach_id_2(id, full_name), coach3:coach_id_3(id, full_name)')
 .or(`coach_id.eq.${user.id},coach_id_2.eq.${user.id},coach_id_3.eq.${user.id}`)
 if (eErr) throw eErr
 setManagedEkskuls(ekskuls || [])

 if (ekskuls && ekskuls.length > 0) {
 const ekskulIds = ekskuls.map(e => e.id)
 
 // 2. Fetch sessions under these extracurriculars
 const { data: sessionsData, error: sErr } = await supabase
 .from('sessions')
 .select(`
 *,
 extracurricular:extracurricular_id (name, coach_id, coach_id_2, coach_id_3, coach:coach_id(id, full_name), coach2:coach_id_2(id, full_name), coach3:coach_id_3(id, full_name)),
 session_coaches (
   id,
   coach:coach_id (id, full_name)
 )
 `)
 .in('extracurricular_id', ekskulIds)
 .order('session_date', { ascending: false })
 if (sErr) throw sErr
 setSessions(sessionsData || [])

 // Set default extracurricular in form if not set
 setForm(f => ({...f, extracurricular_id: ekskuls[0].id, coaches_present: [user.id]}))
 }
 } catch (err) {
 console.error(err)
 setErrorMsg('Gagal memuat data sesi: ' + err.message)
 } finally {
 setLoading(false)
 }
 }

 const fetchEnrolledStudents = async (ekskulId) => {
   try {
     const { data, error } = await supabase
       .from('enrollments')
       .select('student_id, student:student_id (id, nis, full_name, class)')
       .eq('extracurricular_id', ekskulId)
       .eq('status', 'active')
       .order('student(full_name)', { ascending: true })
     
     if (error) throw error
     setEnrolledStudents(data ? data.map(d => d.student) : [])
   } catch (err) {
     console.error('Failed to load students', err)
   }
 }

  const handleOpenModal = async (session = null) => {
  if (session) {
  setSelectedSession(session)
  const presentCoaches = session.session_coaches ? session.session_coaches.map(sc => sc.coach?.id).filter(Boolean) : []
  
  let preSelectedStudents = []
  if (session.is_special_training) {
    const { data: participants } = await supabase
      .from('special_session_participants')
      .select('student_id')
      .eq('session_id', session.id)
    if (participants) preSelectedStudents = participants.map(p => p.student_id)
  }

  setForm({
  extracurricular_id: session.extracurricular_id,
  session_date: session.session_date,
  topic: session.topic || '',
  notes: session.notes || '',
  coaches_present: presentCoaches.length > 0 ? presentCoaches : [user.id],
  is_special_training: session.is_special_training || false,
  event_name: session.event_name || '',
  selected_students: preSelectedStudents
  })
  } else {
  setSelectedSession(null)
  setForm({
  extracurricular_id: managedEkskuls[0]?.id || '',
  session_date: new Date().toISOString().split('T')[0],
  topic: '',
  notes: '',
  coaches_present: [user.id],
  is_special_training: false,
  event_name: '',
  selected_students: []
  })
  }
  setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
  e.preventDefault()
  setErrorMsg('')
  setSuccessMsg('')

  if (form.coaches_present.length === 0) {
    setErrorMsg('Harap pilih minimal 1 pelatih yang memimpin sesi latihan.')
    return
  }

  if (form.is_special_training) {
    if (!form.event_name.trim()) {
      setErrorMsg('Nama event perlombaan wajib diisi untuk sesi latihan khusus.')
      return
    }
    if (form.selected_students.length === 0) {
      setErrorMsg('Harap pilih minimal 1 siswa untuk sesi latihan khusus ini.')
      return
    }
  }

  try {
  let sessionId = selectedSession?.id

  // CEK LIMIT 3 SESI KHUSUS UNTUK EVENT BARU
  if (form.is_special_training && (!selectedSession || selectedSession.event_name !== form.event_name)) {
    const { count, error: countErr } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('extracurricular_id', form.extracurricular_id)
      .eq('is_special_training', true)
      .ilike('event_name', form.event_name.trim())
    
    if (countErr) throw countErr
    if (count >= 3) {
      throw new Error(`Batas maksimal 3 sesi latihan khusus untuk event "${form.event_name}" sudah tercapai.`)
    }
  }

  if (selectedSession) {
  // Edit Mode
  const { error } = await supabase
  .from('sessions')
  .update({
  extracurricular_id: form.extracurricular_id,
  session_date: form.session_date,
  topic: form.topic,
  notes: form.notes,
  is_special_training: form.is_special_training,
  event_name: form.is_special_training ? form.event_name : null
  })
  .eq('id', selectedSession.id)
  if (error) throw error

  // Hapus relasi pelatih & siswa lama
  await supabase.from('session_coaches').delete().eq('session_id', selectedSession.id)
  await supabase.from('special_session_participants').delete().eq('session_id', selectedSession.id)

  setSuccessMsg('Sesi latihan berhasil diperbarui.')
  } else {
  // Create Mode
  const { data: newSession, error } = await supabase
  .from('sessions')
  .insert([
  {
  extracurricular_id: form.extracurricular_id,
  session_date: form.session_date,
  topic: form.topic,
  notes: form.notes,
  created_by: user.id,
  is_special_training: form.is_special_training,
  event_name: form.is_special_training ? form.event_name : null
  }
  ])
  .select()
  .single()
  if (error) throw error
  sessionId = newSession.id
  setSuccessMsg('Sesi latihan baru berhasil dibuat.')
  }

  // Insert relasi pelatih baru
  const coachesToInsert = form.coaches_present.map(cId => ({
    session_id: sessionId,
    coach_id: cId
  }))
  const { error: insErr } = await supabase.from('session_coaches').insert(coachesToInsert)
  if (insErr) throw insErr

  // Insert special students jika ada
  if (form.is_special_training && form.selected_students.length > 0) {
    const studentsToInsert = form.selected_students.map(sId => ({
      session_id: sessionId,
      student_id: sId
    }))
    const { error: spErr } = await supabase.from('special_session_participants').insert(studentsToInsert)
    if (spErr) throw spErr
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

 const handleStudentCheckbox = (studentId, checked) => {
   if (checked) {
     setForm(f => ({...f, selected_students: [...f.selected_students, studentId]}))
   } else {
     setForm(f => ({...f, selected_students: f.selected_students.filter(id => id !== studentId)}))
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
  <th className="px-6 py-4">Pelatih Memimpin</th>
  <th className="px-6 py-4">Topik / Materi Latihan</th>
  <th className="px-6 py-4">Catatan Sesi</th>
  <th className="px-6 py-4 text-right">Aksi</th>
  </tr>
  </thead>
  <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
  {sessions.length === 0 ? (
  <tr>
  <td colSpan={6} className="px-6 py-8 text-center text-pixel-lavender">Belum ada sesi latihan yang dibuat.</td>
  </tr>
  ) : (
  sessions.map(session => (
  <tr key={session.id} className="hover:bg-pixel-panel-light">
  <td className="px-6 py-4 font-mono font-semibold text-pixel-white">
  <div className="flex flex-col gap-1 mt-2">
    <div className="flex items-center gap-1.5">
      <CalendarDays className="w-4 h-4 text-primary" />
      {new Date(session.session_date).toLocaleDateString('id-ID', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
      })}
    </div>
    {session.is_special_training && (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-retro bg-pixel-orange/20 text-pixel-orange px-1.5 py-0.5 rounded-sm self-start">
        <Trophy className="w-3 h-3" /> Latihan Khusus
      </span>
    )}
  </div>
  </td>
  <td className="px-6 py-4 font-bold text-pixel-white">{session.extracurricular?.name}</td>
  <td className="px-6 py-4 text-pixel-yellow font-semibold">{session.session_coaches && session.session_coaches.length > 0 ? session.session_coaches.map(sc => sc.coach?.full_name).filter(Boolean).join(', ') : 'Tidak diketahui'}</td>
  <td className="px-6 py-4 font-semibold text-pixel-white">
    {session.topic || 'Sesi Umum'}
    {session.is_special_training && session.event_name && (
      <div className="text-xs text-pixel-lavender mt-0.5 font-mono">Event: {session.event_name}</div>
    )}
  </td>
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
 <div className="bg-pixel-panel rounded-none shadow-pixel-lg border border-pixel-gray/30 w-full max-w-lg max-h-[90vh] overflow-y-auto pixel-slide-in">
 <div className="flex justify-between items-center px-6 py-4 border-b border-pixel-gray/30 bg-pixel-navy sticky top-0 z-10">
 <h3 className="font-bold text-pixel-white text-lg flex items-center gap-2">
 <FileText className="w-5 h-5 text-primary" />
 {selectedSession ? 'Ubah Sesi Latihan' : 'Buat Sesi Latihan Baru'}
 </h3>
 <Button onClick={() => setIsModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-none">
 <X className="w-4 h-4" />
 </Button>
 </div>
 <form onSubmit={handleSubmit} className="p-6 space-y-5">
 
  {/* Pilih Ekskul */}
  <div className="space-y-1.5">
  <Label htmlFor="s_ekskul">Ekstrakurikuler</Label>
  <select
  id="s_ekskul"
  required
  className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  value={form.extracurricular_id}
  onChange={e => {
    const selectedId = e.target.value
    const eksObj = managedEkskuls.find(ex => ex.id === selectedId)
    setForm({...form, extracurricular_id: selectedId, coaches_present: [eksObj?.coach?.id || user.id].filter(Boolean), selected_students: []})
  }}
  >
  {managedEkskuls.map(e => (
  <option key={e.id} value={e.id}>{e.name}</option>
  ))}
  </select>
  </div>

  {/* Checkbox Sesi Latihan Khusus */}
  <div className="flex items-start gap-2 p-3 bg-pixel-orange/10 border border-pixel-orange/30">
    <input 
      type="checkbox" 
      id="is_special" 
      checked={form.is_special_training}
      onChange={e => setForm({...form, is_special_training: e.target.checked})}
      className="mt-1 h-4 w-4 accent-pixel-orange"
    />
    <div>
      <label htmlFor="is_special" className="font-retro text-base text-pixel-orange cursor-pointer">Sesi Latihan Khusus (Persiapan Lomba)</label>
      <p className="text-xs text-pixel-lavender mt-1">Latihan khusus di luar jadwal reguler, dibatasi max 3x pertemuan per event.</p>
    </div>
  </div>

  {form.is_special_training && (
    <div className="space-y-4 p-4 border border-pixel-orange/30 bg-pixel-panel-light relative">
      <Trophy className="absolute top-4 right-4 w-12 h-12 text-pixel-orange/10 pointer-events-none" />
      <div className="space-y-1.5">
        <Label htmlFor="event_name">Nama Event / Perlombaan</Label>
        <Input
          id="event_name"
          placeholder="Contoh: O2SN 2026, Porseni Kota"
          value={form.event_name}
          onChange={e => setForm({...form, event_name: e.target.value})}
          className="border-pixel-orange/50 focus-visible:ring-pixel-orange"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Pilih Siswa Peserta Latihan Khusus</Label>
        <div className="max-h-48 overflow-y-auto border border-pixel-gray/30 bg-pixel-navy p-2 space-y-1">
          {enrolledStudents.length === 0 ? (
            <div className="p-2 text-xs text-pixel-lavender text-center">Belum ada siswa terdaftar / Sedang memuat...</div>
          ) : (
            enrolledStudents.map(student => (
              <label key={student.id} className="flex items-center gap-2 p-1.5 hover:bg-pixel-panel-light cursor-pointer text-sm text-pixel-peach">
                <input 
                  type="checkbox" 
                  checked={form.selected_students.includes(student.id)}
                  onChange={e => handleStudentCheckbox(student.id, e.target.checked)}
                  className="accent-pixel-blue"
                />
                <span className="font-mono text-pixel-lavender">{student.nis}</span> - 
                <span className="font-semibold text-pixel-white">{student.full_name}</span> 
                <span className="text-xs text-pixel-gray">({student.class})</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  )}

  {/* Pilih Pelatih yang Memimpin Sesi (Multi-select Checkbox) */}
  {(() => {
    const selectedEkskulObj = managedEkskuls.find(e => e.id === form.extracurricular_id)
    if (!selectedEkskulObj) return null

    const handleCheckboxChange = (coachId, checked) => {
      if (checked) {
        setForm(f => ({...f, coaches_present: [...f.coaches_present, coachId]}))
      } else {
        setForm(f => ({...f, coaches_present: f.coaches_present.filter(id => id !== coachId)}))
      }
    }

    return (
      <div className="space-y-2">
        <Label>Pelatih yang Memimpin Latihan (Dapat Pilih Lebih dari 1)</Label>
        <div className="flex flex-col gap-2 p-3 bg-pixel-navy border border-pixel-gray/30">
          {selectedEkskulObj.coach && (
            <label className="flex items-center gap-2 cursor-pointer font-retro text-base text-pixel-peach select-none">
              <input
                type="checkbox"
                checked={form.coaches_present.includes(selectedEkskulObj.coach.id)}
                onChange={e => handleCheckboxChange(selectedEkskulObj.coach.id, e.target.checked)}
                className="h-4 w-4 accent-pixel-blue"
              />
              <span>{selectedEkskulObj.coach.full_name} (Pelatih 1)</span>
            </label>
          )}
          {selectedEkskulObj.coach2 && (
            <label className="flex items-center gap-2 cursor-pointer font-retro text-base text-pixel-peach select-none">
              <input
                type="checkbox"
                checked={form.coaches_present.includes(selectedEkskulObj.coach2.id)}
                onChange={e => handleCheckboxChange(selectedEkskulObj.coach2.id, e.target.checked)}
                className="h-4 w-4 accent-pixel-blue"
              />
              <span>{selectedEkskulObj.coach2.full_name} (Pelatih 2)</span>
            </label>
          )}
          {selectedEkskulObj.coach3 && (
            <label className="flex items-center gap-2 cursor-pointer font-retro text-base text-pixel-peach select-none">
              <input
                type="checkbox"
                checked={form.coaches_present.includes(selectedEkskulObj.coach3.id)}
                onChange={e => handleCheckboxChange(selectedEkskulObj.coach3.id, e.target.checked)}
                className="h-4 w-4 accent-pixel-blue"
              />
              <span>{selectedEkskulObj.coach3.full_name} (Pelatih 3)</span>
            </label>
          )}
        </div>
      </div>
    )
  })()}

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

 <div className="pt-4 border-t border-pixel-gray/30 flex justify-end gap-2 sticky bottom-0 bg-pixel-panel mt-2 py-2">
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
