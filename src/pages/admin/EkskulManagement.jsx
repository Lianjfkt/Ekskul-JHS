import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Search, Plus, Trash2, Edit2, Activity, Calendar, User, 
  X, Check, ShieldAlert, Power, PowerOff
} from 'lucide-react'

export default function EkskulManagement() {
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Data States
  const [extracurriculars, setExtracurriculars] = useState([])
  const [coaches, setCoaches] = useState([])

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEkskul, setSelectedEkskul] = useState(null)

  // Form States
  const [form, setForm] = useState({
    name: '',
    description: '',
    schedule: '',
    coach_id: '',
    is_active: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. Fetch Coaches to populate dropdown
      const { data: coachesData, error: cErr } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'coach')
      if (cErr) throw cErr
      setCoaches(coachesData || [])

      // 2. Fetch Extracurriculars and join Coach info
      const { data: ekskulData, error: eErr } = await supabase
        .from('extracurriculars')
        .select(`
          *,
          coach:coach_id (id, full_name, email)
        `)
        .order('name', { ascending: true })
      if (eErr) throw eErr
      setExtracurriculars(ekskulData || [])
    } catch (err) {
      console.error(err)
      setErrorMsg('Gagal memuat data ekskul: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (ekskul = null) => {
    if (ekskul) {
      setSelectedEkskul(ekskul)
      setForm({
        name: ekskul.name,
        description: ekskul.description || '',
        schedule: ekskul.schedule || '',
        coach_id: ekskul.coach_id || '',
        is_active: ekskul.is_active !== undefined ? ekskul.is_active : true
      })
    } else {
      setSelectedEkskul(null)
      setForm({
        name: '',
        description: '',
        schedule: '',
        coach_id: coaches[0]?.id || '',
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    try {
      if (selectedEkskul) {
        // Edit Mode
        const { error } = await supabase
          .from('extracurriculars')
          .update({
            name: form.name,
            description: form.description,
            schedule: form.schedule,
            coach_id: form.coach_id || null,
            is_active: form.is_active
          })
          .eq('id', selectedEkskul.id)
        if (error) throw error
        setSuccessMsg('Ekskul berhasil diperbarui.')
      } else {
        // Create Mode
        const { error } = await supabase
          .from('extracurriculars')
          .insert([
            {
              name: form.name,
              description: form.description,
              schedule: form.schedule,
              coach_id: form.coach_id || null,
              is_active: form.is_active
            }
          ])
        if (error) throw error
        setSuccessMsg('Ekskul baru berhasil dibuat.')
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus ekstrakurikuler ini? Data kehadiran, sesi, dan nilai terkait akan dihapus secara cascade.')) return
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('extracurriculars')
        .delete()
        .eq('id', id)
      if (error) throw error
      setSuccessMsg('Ekskul berhasil dihapus.')
      fetchData()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleToggleStatus = async (ekskul) => {
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('extracurriculars')
        .update({ is_active: !ekskul.is_active })
        .eq('id', ekskul.id)
      if (error) throw error
      setSuccessMsg(`Status ekskul ${ekskul.name} berhasil diubah.`)
      fetchData()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const filteredEkskul = extracurriculars.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.coach && e.coach.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Alert Status */}
      {errorMsg && (
        <div className="p-4 bg-destructive/15 border border-destructive/30 rounded-lg text-destructive text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-600 text-sm flex items-start gap-3">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manajemen Ekstrakurikuler</h1>
          <p className="text-slate-500 text-sm">Kelola daftar ekstrakurikuler, jadwal latihan, dan penunjukan pelatih.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Ekskul Baru
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Cari ekskul berdasarkan nama, deskripsi, atau nama pelatih..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-white border-slate-200 focus-visible:ring-primary rounded-xl"
        />
      </div>

      {/* Ekskul Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-500">Memuat data ekskul...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEkskul.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-xl border border-dashed border-slate-200">
              Tidak ada ekstrakurikuler ditemukan.
            </div>
          ) : (
            filteredEkskul.map(ekskul => (
              <Card key={ekskul.id} className={`border-t-4 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md ${
                ekskul.is_active ? 'border-t-primary' : 'border-t-slate-300 bg-slate-50/70'
              }`}>
                <CardContent className="p-6 space-y-4">
                  {/* Status Badge */}
                  <div className="flex justify-between items-start">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      ekskul.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Activity className="w-3.5 h-3.5" />
                      {ekskul.is_active ? 'Aktif' : 'Non-aktif'}
                    </span>
                    
                    {/* Action buttons */}
                    <div className="flex gap-1">
                      <Button onClick={() => handleToggleStatus(ekskul)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                        {ekskul.is_active ? <PowerOff className="w-4 h-4 text-amber-600" /> : <Power className="w-4 h-4 text-emerald-600" />}
                      </Button>
                      <Button onClick={() => handleOpenModal(ekskul)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 hover:text-primary">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => handleDelete(ekskul.id)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-primary transition-colors">{ekskul.name}</h3>
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2 min-h-[2.5rem]">
                      {ekskul.description || 'Tidak ada deskripsi.'}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-2.5 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{ekskul.schedule || 'Jadwal belum ditentukan'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Pelatih: <strong className="text-slate-800">{ekskul.coach?.full_name || 'Belum ditunjuk'}</strong></span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* --- MODAL TAMBAH/EDIT EKSKUL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-lg">
                {selectedEkskul ? 'Ubah Data Ekskul' : 'Tambah Ekskul Baru'}
              </h3>
              <Button onClick={() => setIsModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="e_name">Nama Ekstrakurikuler</Label>
                <Input
                  id="e_name"
                  required
                  placeholder="Contoh: Futsal, Pramuka, Musik"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="e_desc">Deskripsi Singkat</Label>
                <textarea
                  id="e_desc"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Masukkan deskripsi ekskul..."
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e_sched">Jadwal Latihan</Label>
                <Input
                  id="e_sched"
                  required
                  placeholder="Contoh: Setiap Sabtu, 08.00 - 10.00"
                  value={form.schedule}
                  onChange={e => setForm({...form, schedule: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e_coach">Pilih Pelatih</Label>
                <select
                  id="e_coach"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.coach_id}
                  onChange={e => setForm({...form, coach_id: e.target.value})}
                >
                  <option value="">-- Pilih Pelatih --</option>
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="e_active"
                  checked={form.is_active}
                  onChange={e => setForm({...form, is_active: e.target.checked})}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="e_active" className="cursor-pointer select-none">Ekstrakurikuler Aktif</Label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">Batal</Button>
                <Button type="submit">Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
