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
import { auditLogService } from '../../utils/auditLogService'
import { useAuthStore } from '../../stores/authStore'

export default function EkskulManagement() {
  const { user } = useAuthStore()
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
    coach_id_2: '',
    coach_id_3: '',
    is_active: true,
    is_mandatory: false,
    mandatory_class: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data: coachesData, error: cErr } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'coach')
      if (cErr) throw cErr
      setCoaches(coachesData || [])

      const { data: ekskulData, error: eErr } = await supabase
        .from('extracurriculars')
        .select(`
          *,
          coach:coach_id (id, full_name, email),
          coach2:coach_id_2 (id, full_name, email),
          coach3:coach_id_3 (id, full_name, email)
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
        coach_id_2: ekskul.coach_id_2 || '',
        coach_id_3: ekskul.coach_id_3 || '',
        is_active: ekskul.is_active !== undefined ? ekskul.is_active : true,
        is_mandatory: ekskul.is_mandatory || false,
        mandatory_class: ekskul.mandatory_class || ''
      })
    } else {
      setSelectedEkskul(null)
      setForm({
        name: '',
        description: '',
        schedule: '',
        coach_id: coaches[0]?.id || '',
        coach_id_2: '',
        coach_id_3: '',
        is_active: true,
        is_mandatory: false,
        mandatory_class: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    try {
      // Validasi: pelatih yang dipilih tidak boleh sama (duplikat)
      const selectedCoaches = [form.coach_id, form.coach_id_2, form.coach_id_3].filter(Boolean)
      const uniqueCoaches = new Set(selectedCoaches)
      if (selectedCoaches.length !== uniqueCoaches.size) {
        setErrorMsg('Setiap pelatih yang ditunjuk harus berbeda (tidak boleh duplikat).')
        return
      }

      if (selectedEkskul) {
        const { error } = await supabase
          .from('extracurriculars')
          .update({
            name: form.name,
            description: form.description,
            schedule: form.schedule,
            coach_id: form.coach_id || null,
            coach_id_2: form.coach_id_2 || null,
            coach_id_3: form.coach_id_3 || null,
            is_active: form.is_active,
            is_mandatory: form.is_mandatory,
            mandatory_class: form.is_mandatory ? (form.mandatory_class || null) : null
          })
          .eq('id', selectedEkskul.id)
        if (error) throw error

        await auditLogService.logEvent(
          user?.id, user?.email,
          'UPDATE_EKSKUL',
          `Memperbarui ekskul: ${form.name}`,
          {
            targetTable: 'extracurriculars',
            targetId: selectedEkskul.id,
            beforeState: {
              name: selectedEkskul.name,
              description: selectedEkskul.description,
              schedule: selectedEkskul.schedule,
              coach_id: selectedEkskul.coach_id,
              coach_id_2: selectedEkskul.coach_id_2,
              coach_id_3: selectedEkskul.coach_id_3,
              is_active: selectedEkskul.is_active,
              is_mandatory: selectedEkskul.is_mandatory,
              mandatory_class: selectedEkskul.mandatory_class
            },
            afterState: {
              name: form.name,
              description: form.description,
              schedule: form.schedule,
              coach_id: form.coach_id || null,
              coach_id_2: form.coach_id_2 || null,
              coach_id_3: form.coach_id_3 || null,
              is_active: form.is_active,
              is_mandatory: form.is_mandatory,
              mandatory_class: form.is_mandatory ? (form.mandatory_class || null) : null
            }
          }
        )
        setSuccessMsg('Ekskul berhasil diperbarui.')
      } else {
        const { data: newEkskul, error } = await supabase
          .from('extracurriculars')
          .insert([
            {
              name: form.name,
              description: form.description,
              schedule: form.schedule,
              coach_id: form.coach_id || null,
              coach_id_2: form.coach_id_2 || null,
              coach_id_3: form.coach_id_3 || null,
              is_active: form.is_active,
              is_mandatory: form.is_mandatory,
              mandatory_class: form.is_mandatory ? (form.mandatory_class || null) : null
            }
          ])
          .select()
          .single()
        if (error) throw error

        await auditLogService.logEvent(
          user?.id, user?.email,
          'CREATE_EKSKUL',
          `Membuat ekskul baru: ${form.name}`,
          { targetTable: 'extracurriculars', targetId: newEkskul.id, beforeState: null, afterState: newEkskul }
        )
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
      // Ambil data sebelum dihapus untuk before_state
      const { data: ekskulData } = await supabase
        .from('extracurriculars')
        .select('id, name, description, schedule, coach_id, coach_id_2, coach_id_3, is_active, is_mandatory, mandatory_class')
        .eq('id', id)
        .single()

      const { error } = await supabase
        .from('extracurriculars')
        .delete()
        .eq('id', id)
      if (error) throw error

      await auditLogService.logEvent(
        user?.id, user?.email,
        'DELETE_EKSKUL',
        `Menghapus ekskul: ${ekskulData?.name || id}`,
        { targetTable: 'extracurriculars', targetId: id, beforeState: ekskulData, afterState: null }
      )
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

      await auditLogService.logEvent(
        user?.id, user?.email,
        'TOGGLE_EKSKUL',
        `Mengubah status ekskul "${ekskul.name}" menjadi ${!ekskul.is_active ? 'Aktif' : 'Nonaktif'}`,
        {
          targetTable: 'extracurriculars',
          targetId: ekskul.id,
          beforeState: { is_active: ekskul.is_active },
          afterState: { is_active: !ekskul.is_active }
        }
      )
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
        <div className="p-4 bg-pixel-red/10 border-3 border-pixel-red text-pixel-red font-retro text-lg flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-pixel-green/10 border-3 border-pixel-green text-pixel-green font-retro text-lg flex items-start gap-3">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pixel-box p-6">
        <div>
          <h1 className="font-pixel text-xs text-pixel-blue pixel-text-shadow leading-loose">MANAJEMEN EKSKUL</h1>
          <p className="font-retro text-lg text-pixel-lavender">Kelola daftar ekstrakurikuler, jadwal latihan, dan penunjukan pelatih.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> EKSKUL BARU
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pixel-lavender w-5 h-5" />
        <Input
          type="text"
          placeholder="Cari ekskul berdasarkan nama, deskripsi, atau nama pelatih..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* Ekskul Grid */}
      {loading ? (
        <div className="p-8 text-center font-retro text-lg text-pixel-lavender">
          <span className="pixel-blink">MEMUAT DATA...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEkskul.length === 0 ? (
            <div className="col-span-full pixel-box-flat p-12 text-center font-retro text-lg text-pixel-lavender border-dashed">
              Tidak ada ekstrakurikuler ditemukan.
            </div>
          ) : (
            filteredEkskul.map(ekskul => (
              <Card key={ekskul.id} className={`relative overflow-hidden border-t-4 ${
                ekskul.is_active ? 'border-t-pixel-blue' : 'border-t-pixel-gray opacity-70'
              }`}>
                <CardContent className="p-5 space-y-4">
                  {/* Status Badge */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className={`pixel-badge ${
                        ekskul.is_active ? 'border-pixel-green text-pixel-green bg-pixel-green/10' : 'border-pixel-gray text-pixel-lavender'
                      }`}>
                        <Activity className="w-3 h-3 inline mr-1" />
                        {ekskul.is_active ? 'AKTIF' : 'OFF'}
                      </span>
                      {ekskul.is_mandatory && (
                        <span className="pixel-badge border-indigo-500 text-indigo-300 bg-indigo-900/30 text-[10px]">
                          WAJIB{ekskul.mandatory_class ? ` KLS ${ekskul.mandatory_class}` : ''}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <Button onClick={() => handleToggleStatus(ekskul)} variant="ghost" size="icon" className="h-8 w-8">
                        {ekskul.is_active ? <PowerOff className="w-4 h-4 text-pixel-orange" /> : <Power className="w-4 h-4 text-pixel-green" />}
                      </Button>
                      <Button onClick={() => handleOpenModal(ekskul)} variant="ghost" size="icon" className="h-8 w-8 hover:text-pixel-blue">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => handleDelete(ekskul.id)} variant="ghost" size="icon" className="h-8 w-8 text-pixel-red hover:bg-pixel-red/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-retro text-2xl text-pixel-white">{ekskul.name}</h3>
                    <p className="font-retro text-lg text-pixel-lavender mt-1 line-clamp-2 min-h-[2.5rem]">
                      {ekskul.description || 'Tidak ada deskripsi.'}
                    </p>
                  </div>

                  <div className="border-t-2 border-pixel-gray/30 pt-4 space-y-2 font-retro text-lg text-pixel-peach">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-pixel-lavender" />
                      <span>{ekskul.schedule || 'Jadwal belum ditentukan'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-pixel-lavender" />
                      <span>Pelatih 1: <strong className="text-pixel-yellow">{ekskul.coach?.full_name || 'Belum ditunjuk'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-pixel-lavender" />
                      <span>Pelatih 2: <strong className="text-pixel-yellow">{ekskul.coach2?.full_name || '-'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-pixel-lavender" />
                      <span>Pelatih 3: <strong className="text-pixel-yellow">{ekskul.coach3?.full_name || '-'}</strong></span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="pixel-box bg-pixel-panel w-full max-w-md overflow-hidden pixel-slide-in">
            <div className="flex justify-between items-center px-6 py-4 border-b-3 border-pixel-gray bg-pixel-navy">
              <h3 className="font-pixel text-[9px] text-pixel-blue pixel-text-shadow leading-relaxed">
                {selectedEkskul ? 'UBAH EKSKUL' : 'EKSKUL BARU'}
              </h3>
              <Button onClick={() => setIsModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="e_name">Nama Ekstrakurikuler</Label>
                <Input
                  id="e_name"
                  required
                  placeholder="Contoh: Futsal, Pramuka, Musik"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="e_desc">Deskripsi Singkat</Label>
                <textarea
                  id="e_desc"
                  className="pixel-input flex min-h-[80px] w-full rounded-none px-3 py-2 font-retro text-lg"
                  placeholder="Masukkan deskripsi ekskul..."
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="e_sched">Jadwal Latihan</Label>
                <Input
                  id="e_sched"
                  required
                  placeholder="Contoh: Setiap Sabtu, 08.00 - 10.00"
                  value={form.schedule}
                  onChange={e => setForm({...form, schedule: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="e_coach">Pilih Pelatih 1</Label>
                <select
                  id="e_coach"
                  className="pixel-input flex h-10 w-full rounded-none px-3 py-2 font-retro text-lg"
                  value={form.coach_id}
                  onChange={e => setForm({...form, coach_id: e.target.value})}
                >
                  <option value="">-- Pilih Pelatih 1 --</option>
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="e_coach_2">Pilih Pelatih 2 (Opsional)</Label>
                <select
                  id="e_coach_2"
                  className="pixel-input flex h-10 w-full rounded-none px-3 py-2 font-retro text-lg"
                  value={form.coach_id_2}
                  onChange={e => setForm({...form, coach_id_2: e.target.value, coach_id_3: e.target.value === form.coach_id_3 ? '' : form.coach_id_3})}
                >
                  <option value="">-- Tidak Ada / Pilih Pelatih 2 --</option>
                  {coaches.filter(c => c.id !== form.coach_id).map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="e_coach_3">Pilih Pelatih 3 (Opsional)</Label>
                <select
                  id="e_coach_3"
                  className="pixel-input flex h-10 w-full rounded-none px-3 py-2 font-retro text-lg"
                  value={form.coach_id_3}
                  onChange={e => setForm({...form, coach_id_3: e.target.value})}
                >
                  <option value="">-- Tidak Ada / Pilih Pelatih 3 --</option>
                  {coaches.filter(c => c.id !== form.coach_id && c.id !== form.coach_id_2).map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              {/* Mandatory ekskul toggle */}
              <div className="space-y-3 pt-2 border-t border-pixel-gray/30">
                <p className="text-xs text-pixel-lavender font-semibold uppercase tracking-wide">Pengaturan Wajib</p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="e_mandatory"
                    checked={form.is_mandatory}
                    onChange={e => setForm({...form, is_mandatory: e.target.checked, mandatory_class: e.target.checked ? form.mandatory_class : ''})}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  <Label htmlFor="e_mandatory" className="cursor-pointer select-none">Ekskul Wajib (absen = langsung peringatan)</Label>
                </div>
                {form.is_mandatory && (
                  <div className="space-y-1">
                    <Label htmlFor="e_mandatory_class">Kelas yang Diwajibkan</Label>
                    <select
                      id="e_mandatory_class"
                      className="pixel-input flex h-10 w-full rounded-none px-3 py-2 font-retro text-lg"
                      value={form.mandatory_class}
                      onChange={e => setForm({...form, mandatory_class: e.target.value})}
                    >
                      <option value="">-- Semua Kelas --</option>
                      <option value="7">Kelas 7</option>
                      <option value="8">Kelas 8</option>
                      <option value="9">Kelas 9</option>
                      <option value="7,8">Kelas 7 & 8</option>
                      <option value="all">Semua Kelas</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="e_active"
                  checked={form.is_active}
                  onChange={e => setForm({...form, is_active: e.target.checked})}
                  className="h-4 w-4 accent-pixel-blue"
                />
                <Label htmlFor="e_active" className="cursor-pointer select-none">Ekstrakurikuler Aktif</Label>
              </div>

              <div className="pt-4 border-t-2 border-pixel-gray/30 flex justify-end gap-2">
                <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">BATAL</Button>
                <Button type="submit">SIMPAN</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
