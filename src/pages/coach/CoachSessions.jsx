import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import PixelConfirmModal from '@/components/ui/PixelConfirmModal'
import {
  Plus, Trash2, Edit2, CalendarDays,
  X, FileText, Trophy,
  Search, ChevronLeft, ChevronRight, Users,
} from 'lucide-react'
import { soundManager } from '@/utils/soundEffects'
import { toast } from '@/stores/toastStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10
const CLASS_GRADES = ['7', '8', '9']

const DEFAULT_FORM = {
  extracurricular_id: '',
  session_date: new Date().toISOString().split('T')[0],
  topic: '',
  notes: '',
  coaches_present: [],
  is_special_training: false,
  event_name: '',
  selected_students: [],
  target_classes: [],
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

/** Parse YYYY-MM-DD string as local midnight to prevent timezone off-by-one */
function parseLocalDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

function formatDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('id-ID', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTargetClass(targetClass) {
  if (!targetClass || targetClass === 'all') return 'Semua Kelas'
  return targetClass.split(',').map(g => `Kelas ${g}`).join(', ')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="p-4 space-y-3 animate-pulse border-b border-pixel-gray/20">
      <div className="h-3.5 bg-pixel-gray/20 rounded w-36" />
      <div className="h-4 bg-pixel-gray/20 rounded w-full" />
      <div className="h-3 bg-pixel-gray/20 rounded w-3/4" />
      <div className="h-3 bg-pixel-gray/20 rounded w-1/2" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-pixel-gray/20 animate-pulse">
      {[160, 140, 120, 160, 100, 60].map((w, i) => (
        <td key={i} className="px-6 py-4">
          <div className={`h-4 bg-pixel-gray/20 rounded`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

/** Displays coach checkboxes for the given ekskul */
function CoachCheckboxList({ ekskul, coachesPresent, onToggle }) {
  if (!ekskul) return null

  const coaches = [
    ekskul.coach  && { ...ekskul.coach,  label: 'Pelatih 1' },
    ekskul.coach2 && { ...ekskul.coach2, label: 'Pelatih 2' },
    ekskul.coach3 && { ...ekskul.coach3, label: 'Pelatih 3' },
  ].filter(Boolean)

  if (coaches.length === 0) return null

  return (
    <div className="space-y-2">
      <Label>Pelatih yang Memimpin Latihan (Dapat Pilih Lebih dari 1)</Label>
      <div className="flex flex-col gap-2 p-3 bg-pixel-navy border border-pixel-gray/30">
        {coaches.map(coach => (
          <label
            key={coach.id}
            className="flex items-center gap-2 cursor-pointer font-retro text-base text-pixel-peach select-none"
          >
            <input
              type="checkbox"
              checked={coachesPresent.includes(coach.id)}
              onChange={e => onToggle(coach.id, e.target.checked)}
              className="h-4 w-4 accent-pixel-blue"
            />
            <span>{coach.full_name} ({coach.label})</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** Date + special-training badge — reused by both mobile and desktop views */
function SessionMeta({ session }) {
  return (
    <>
      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-pixel-white">
        <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        {formatDate(session.session_date)}
      </div>
      {session.is_special_training && (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-retro bg-pixel-orange/20 text-pixel-orange px-2 py-0.5 border border-pixel-orange/40">
          <Trophy className="w-3 h-3" /> Latihan Khusus
        </span>
      )}
    </>
  )
}

/** Coach name list from session_coaches */
function CoachNames({ sessionCoaches }) {
  const names = sessionCoaches?.map(sc => sc.coach?.full_name).filter(Boolean).join(', ')
  return names
    ? <>{names}</>
    : <span className="italic text-pixel-gray">Tidak diketahui</span>
}

/** Mobile card for a single session */
function SessionCard({ session, onEdit, onDelete }) {
  return (
    <div className="p-4 space-y-3 hover:bg-pixel-panel-light/60 transition-colors">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SessionMeta session={session} />
      </div>

      <div>
        <div className="font-bold text-pixel-white text-base leading-snug">
          {session.extracurricular?.name}
        </div>
        <div className="text-xs text-pixel-lavender font-mono mt-0.5">
          Target: {formatTargetClass(session.target_class)}
        </div>
      </div>

      <div className="bg-pixel-navy/70 border border-pixel-gray/30 p-2.5 space-y-1">
        <div className="text-xs font-semibold text-pixel-peach">
          <span className="text-pixel-lavender font-normal">Topik: </span>
          {session.topic || 'Sesi Umum'}
        </div>
        {session.is_special_training && session.event_name && (
          <div className="text-xs text-pixel-orange font-mono">
            Event: {session.event_name}
          </div>
        )}
        {session.notes && (
          <div className="text-xs text-pixel-lavender italic pt-1 border-t border-pixel-gray/20">
            Catatan: {session.notes}
          </div>
        )}
      </div>

      <div className="text-xs text-pixel-yellow font-retro">
        Pelatih: <CoachNames sessionCoaches={session.session_coaches} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-pixel-gray/20">
        <Button
          onClick={() => onEdit(session)}
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1 border-pixel-gray text-pixel-peach hover:text-pixel-white"
        >
          <Edit2 className="w-3.5 h-3.5" /><span>Ubah</span>
        </Button>
        <Button
          onClick={() => onDelete(session)}
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1 text-pixel-red hover:bg-pixel-red/10"
        >
          <Trash2 className="w-3.5 h-3.5" /><span>Hapus</span>
        </Button>
      </div>
    </div>
  )
}

/** Desktop table row for a single session */
function SessionRow({ session, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-pixel-panel-light">
      <td className="px-6 py-4 font-mono font-semibold text-pixel-white">
        <div className="flex flex-col gap-1 mt-2">
          <SessionMeta session={session} />
        </div>
      </td>
      <td className="px-6 py-4 font-bold text-pixel-white">
        {session.extracurricular?.name}
        <div className="text-xs text-pixel-lavender font-mono font-normal mt-1">
          Target: {formatTargetClass(session.target_class)}
        </div>
      </td>
      <td className="px-6 py-4 text-pixel-yellow font-semibold">
        <CoachNames sessionCoaches={session.session_coaches} />
      </td>
      <td className="px-6 py-4 font-semibold text-pixel-white">
        {session.topic || 'Sesi Umum'}
        {session.is_special_training && session.event_name && (
          <div className="text-xs text-pixel-lavender mt-0.5 font-mono">
            Event: {session.event_name}
          </div>
        )}
      </td>
      <td className="px-6 py-4 text-pixel-lavender max-w-xs truncate">
        {session.notes || '-'}
      </td>
      <td className="px-6 py-4 text-right space-x-2">
        <Button
          onClick={() => onEdit(session)}
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-pixel-panel-light hover:text-primary"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onDelete(session)}
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-pixel-red/10 text-pixel-red hover:text-pixel-red"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachSessions() {
  const { user } = useAuthStore()

  // Loading states
  const [loading, setLoading]         = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting]   = useState(false)

  // Data
  const [sessions, setSessions]               = useState([])
  const [managedEkskuls, setManagedEkskuls]   = useState([])
  const [enrolledStudents, setEnrolledStudents] = useState([])

  // Modal visibility
  const [isModalOpen, setIsModalOpen]             = useState(false)
  const [selectedSession, setSelectedSession]     = useState(null)
  const [sessionToDelete, setSessionToDelete]     = useState(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)

  // Form
  const [form, setForm] = useState(DEFAULT_FORM)
  /**
   * Stores the form values at the moment the modal opens.
   * Used to detect actual changes (dirty check) — especially important in Edit mode
   * where all fields are pre-filled, so we only warn if the user truly changed something.
   */
  const initialFormRef = useRef(null)

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEkskul, setFilterEkskul] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) fetchData()
    // fetchData is intentionally omitted: it is redefined each render but its
    // identity changing should not re-trigger the effect — only 'user' should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (form.extracurricular_id && form.is_special_training) {
      fetchEnrolledStudents(form.extracurricular_id)
    } else {
      setEnrolledStudents([])
    }
  }, [form.extracurricular_id, form.is_special_training])

  // Reset to page 1 whenever search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterEkskul])

  // ── Data Fetching ─────────────────────────────────────────────────────────

  /**
   * Fetches coach's ekskuls and their sessions.
   * NOTE: does NOT touch form state — form initialisation is handled
   * exclusively by handleOpenModal to avoid race conditions.
   */
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: ekskuls, error: eErr } = await supabase
        .from('extracurriculars')
        .select(`
          id, name, coach_id, coach_id_2, coach_id_3,
          coach:coach_id(id, full_name),
          coach2:coach_id_2(id, full_name),
          coach3:coach_id_3(id, full_name)
        `)
        .or(`coach_id.eq.${user.id},coach_id_2.eq.${user.id},coach_id_3.eq.${user.id}`)
      if (eErr) throw eErr
      setManagedEkskuls(ekskuls || [])

      if (ekskuls && ekskuls.length > 0) {
        const ekskulIds = ekskuls.map(e => e.id)
        const { data: sessionsData, error: sErr } = await supabase
          .from('sessions')
          .select(`
            *,
            extracurricular:extracurricular_id (
              name, coach_id, coach_id_2, coach_id_3,
              coach:coach_id(id, full_name),
              coach2:coach_id_2(id, full_name),
              coach3:coach_id_3(id, full_name)
            ),
            session_coaches (
              id,
              coach:coach_id (id, full_name)
            )
          `)
          .in('extracurricular_id', ekskulIds)
          .order('session_date', { ascending: false })
        if (sErr) throw sErr
        setSessions(sessionsData || [])
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat data sesi: ' + err.message)
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
      console.error('Failed to load students:', err)
    }
  }

  // ── Modal Handlers ────────────────────────────────────────────────────────

  const handleOpenModal = useCallback(async (session = null) => {
    soundManager.playPop()
    let formValues

    if (session) {
      setSelectedSession(session)
      const presentCoaches = session.session_coaches
        ? session.session_coaches.map(sc => sc.coach?.id).filter(Boolean)
        : []

      let preSelectedStudents = []
      if (session.is_special_training) {
        const { data: participants } = await supabase
          .from('special_session_participants')
          .select('student_id')
          .eq('session_id', session.id)
        if (participants) preSelectedStudents = participants.map(p => p.student_id)
      }

      formValues = {
        extracurricular_id: session.extracurricular_id,
        session_date: session.session_date,
        topic: session.topic || '',
        notes: session.notes || '',
        coaches_present: presentCoaches.length > 0 ? presentCoaches : [user.id],
        is_special_training: session.is_special_training || false,
        event_name: session.event_name || '',
        selected_students: preSelectedStudents,
        target_classes: session.target_class && session.target_class !== 'all'
          ? session.target_class.split(',')
          : [],
      }
    } else {
      setSelectedSession(null)
      formValues = {
        ...DEFAULT_FORM,
        session_date: new Date().toISOString().split('T')[0],
        extracurricular_id: managedEkskuls[0]?.id || '',
        coaches_present: [user.id],
      }
    }

    setForm(formValues)
    // Store snapshot for dirty-check — JSON.stringify is fast enough for this small object
    initialFormRef.current = JSON.stringify(formValues)
    setIsModalOpen(true)
  }, [managedEkskuls, user])

  const handleCloseModal = useCallback(() => {
    if (isSubmitting) return
    const isDirty = JSON.stringify(form) !== initialFormRef.current
    if (isDirty) {
      setIsDiscardConfirmOpen(true)
      return
    }
    setIsModalOpen(false)
  }, [isSubmitting, form])

  // ── Form Field Handlers ───────────────────────────────────────────────────

  /** When the ekskul dropdown changes, also reset coach and student selections */
  const handleEkskulChange = useCallback((ekskulId) => {
    const ekskul = managedEkskuls.find(e => e.id === ekskulId)
    setForm(f => ({
      ...f,
      extracurricular_id: ekskulId,
      coaches_present: [ekskul?.coach?.id || user.id].filter(Boolean),
      selected_students: [],
    }))
  }, [managedEkskuls, user])

  const handleCoachToggle = useCallback((coachId, checked) => {
    setForm(f => ({
      ...f,
      coaches_present: checked
        ? [...f.coaches_present, coachId]
        : f.coaches_present.filter(id => id !== coachId),
    }))
  }, [])

  const handleStudentToggle = useCallback((studentId, checked) => {
    setForm(f => ({
      ...f,
      selected_students: checked
        ? [...f.selected_students, studentId]
        : f.selected_students.filter(id => id !== studentId),
    }))
  }, [])

  /** Toggle-all: select all students if any are unselected, deselect all otherwise */
  const handleSelectAllStudents = useCallback(() => {
    const allIds = enrolledStudents.map(s => s.id)
    setForm(f => {
      const allSelected = allIds.every(id => f.selected_students.includes(id))
      return { ...f, selected_students: allSelected ? [] : allIds }
    })
  }, [enrolledStudents])

  const handleGradeToggle = useCallback((grade, checked) => {
    setForm(f => ({
      ...f,
      target_classes: checked
        ? [...(f.target_classes || []), grade]
        : (f.target_classes || []).filter(g => g !== grade),
    }))
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    // Client-side validation
    if (form.coaches_present.length === 0) {
      toast.error('Harap pilih minimal 1 pelatih yang memimpin sesi latihan.')
      return
    }
    if (form.is_special_training) {
      if (!form.event_name.trim()) {
        toast.error('Nama event perlombaan wajib diisi untuk sesi latihan khusus.')
        return
      }
      if (form.selected_students.length === 0) {
        toast.error('Harap pilih minimal 1 siswa untuk sesi latihan khusus ini.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      // ── Duplicate date check ────────────────────────────────────────────
      let dupQuery = supabase
        .from('sessions')
        .select('id, topic')
        .eq('extracurricular_id', form.extracurricular_id)
        .eq('session_date', form.session_date)
      if (selectedSession?.id) dupQuery = dupQuery.neq('id', selectedSession.id)

      const { data: existing, error: dupErr } = await dupQuery
      if (dupErr) throw dupErr
      if (existing?.length > 0) {
        throw new Error(
          `Sesi untuk ekstrakurikuler ini pada tanggal ${form.session_date} sudah ada (${existing[0].topic || 'Tanpa topik'}). Setiap ekskul hanya boleh memiliki 1 sesi per hari.`
        )
      }

      // ── 3-session limit for special training ───────────────────────────
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

      const targetClassStr = form.target_classes?.length > 0
        ? form.target_classes.join(',')
        : 'all'

      let sessionId = selectedSession?.id

      if (selectedSession) {
        // ── Edit Mode ────────────────────────────────────────────────────
        const { error } = await supabase
          .from('sessions')
          .update({
            extracurricular_id: form.extracurricular_id,
            session_date: form.session_date,
            topic: form.topic,
            notes: form.notes,
            is_special_training: form.is_special_training,
            event_name: form.is_special_training ? form.event_name : null,
            target_class: targetClassStr,
          })
          .eq('id', selectedSession.id)
        if (error) throw error

        /**
         * Atomic-safer relational update strategy:
         *   1. INSERT new records first  → if this fails, nothing is lost
         *   2. DELETE removed records    → if this fails, we have extras (recoverable)
         * This avoids the original DELETE-all-then-INSERT-all pattern where
         * a failed INSERT would leave relational data permanently empty.
         */
        await syncRelatedRecords(
          'session_coaches',
          'coach_id',
          sessionId,
          form.coaches_present
        )
        await syncRelatedRecords(
          'special_session_participants',
          'student_id',
          sessionId,
          form.is_special_training ? form.selected_students : []
        )

        toast.success('Sesi latihan berhasil diperbarui.')
      } else {
        // ── Create Mode ──────────────────────────────────────────────────
        const { data: newSession, error } = await supabase
          .from('sessions')
          .insert([{
            extracurricular_id: form.extracurricular_id,
            session_date: form.session_date,
            topic: form.topic,
            notes: form.notes,
            created_by: user.id,
            is_special_training: form.is_special_training,
            event_name: form.is_special_training ? form.event_name : null,
            target_class: targetClassStr,
          }])
          .select()
          .single()
        if (error) throw error
        sessionId = newSession.id

        const { error: cErr } = await supabase.from('session_coaches').insert(
          form.coaches_present.map(id => ({ session_id: sessionId, coach_id: id }))
        )
        if (cErr) throw cErr

        if (form.is_special_training && form.selected_students.length > 0) {
          const { error: spErr } = await supabase.from('special_session_participants').insert(
            form.selected_students.map(id => ({ session_id: sessionId, student_id: id }))
          )
          if (spErr) throw spErr
        }

        toast.success('Sesi latihan baru berhasil dibuat.')
      }

      soundManager.playSuccess()
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      soundManager.playError()
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Syncs a one-to-many relation table by computing a diff and applying
   * minimal inserts/deletes rather than a destructive wipe-and-replace.
   * @param {string} table        – Supabase table name
   * @param {string} foreignKey   – Column name for the related ID (e.g. 'coach_id')
   * @param {string} sessionId    – The parent session's ID
   * @param {string[]} newIds     – The desired set of related IDs after save
   */
  const syncRelatedRecords = async (table, foreignKey, sessionId, newIds) => {
    const { data: current, error: fetchErr } = await supabase
      .from(table)
      .select(foreignKey)
      .eq('session_id', sessionId)
    if (fetchErr) throw fetchErr

    const currentIds = current?.map(r => r[foreignKey]) ?? []
    const toAdd    = newIds.filter(id => !currentIds.includes(id))
    const toRemove = currentIds.filter(id => !newIds.includes(id))

    if (toAdd.length > 0) {
      const { error } = await supabase.from(table).insert(
        toAdd.map(id => ({ session_id: sessionId, [foreignKey]: id }))
      )
      if (error) throw error
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('session_id', sessionId)
        .in(foreignKey, toRemove)
      if (error) throw error
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionToDelete.id)
      if (error) throw error
      soundManager.playSuccess()
      toast.success('Sesi latihan berhasil dihapus.')
      setSessionToDelete(null)
      fetchData()
    } catch (err) {
      soundManager.playError()
      toast.error(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Filtered & Paginated Data ─────────────────────────────────────────────

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sessions.filter(s => {
      const matchEkskul = !filterEkskul || s.extracurricular_id === filterEkskul
      const matchSearch = !q ||
        s.topic?.toLowerCase().includes(q) ||
        s.event_name?.toLowerCase().includes(q) ||
        s.extracurricular?.name?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      return matchEkskul && matchSearch
    })
  }, [sessions, filterEkskul, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE))

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredSessions.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredSessions, currentPage])

  // ── Derived / computed ────────────────────────────────────────────────────

  const selectedEkskulObj = managedEkskuls.find(e => e.id === form.extracurricular_id) ?? null
  const allStudentsSelected =
    enrolledStudents.length > 0 &&
    enrolledStudents.every(s => form.selected_students.includes(s.id))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pixel-panel p-6 rounded-none border border-pixel-gray/30 shadow-pixel-sm">
        <div>
          <h1 className="font-pixel text-xs pixel-text-shadow leading-loose text-pixel-white">
            Jadwal &amp; Log Sesi Latihan
          </h1>
          <p className="text-pixel-lavender text-sm">
            Catat setiap pertemuan latihan, materi/topik yang dibahas, dan catatan khusus.
          </p>
        </div>
        {managedEkskuls.length > 0 && (
          <Button onClick={() => handleOpenModal()} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Tambah Sesi
          </Button>
        )}
      </div>

      {/* ── Empty / No Ekskul ──────────────────────────────────────────── */}
      {!loading && managedEkskuls.length === 0 ? (
        <div className="bg-pixel-panel p-12 text-center text-pixel-lavender rounded-none border border-pixel-gray">
          Anda belum memiliki ekskul asuhan. Hubungi Admin untuk mendaftarkan Anda sebagai pelatih ekskul terlebih dahulu.
        </div>
      ) : (
        <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">

          {/* ── Search & Filter Bar ──────────────────────────────────── */}
          {!loading && sessions.length > 0 && (
            <div className="p-4 border-b border-pixel-gray/30 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pixel-lavender pointer-events-none" />
                <Input
                  placeholder="Cari topik, event, catatan, ekskul..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {managedEkskuls.length > 1 && (
                <select
                  className="flex h-10 w-full sm:w-56 rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={filterEkskul}
                  onChange={e => setFilterEkskul(e.target.value)}
                >
                  <option value="">Semua Ekskul</option>
                  {managedEkskuls.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <CardContent className="p-0">
            {loading ? (
              /* ── Skeleton ──────────────────────────────────────────── */
              <>
                <div className="md:hidden divide-y-2 divide-pixel-gray/30">
                  {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pixel-navy border-b border-pixel-gray/30 font-retro text-base text-pixel-lavender uppercase tracking-wider">
                        {['Tanggal', 'Ekstrakurikuler', 'Pelatih Memimpin', 'Topik / Materi Latihan', 'Catatan Sesi', 'Aksi'].map(h => (
                          <th key={h} className="px-6 py-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-pixel-gray/30">
                      {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
                    </tbody>
                  </table>
                </div>
              </>
            ) : filteredSessions.length === 0 ? (
              /* ── Empty State ───────────────────────────────────────── */
              <div className="p-10 text-center text-pixel-lavender">
                {sessions.length === 0
                  ? 'Belum ada sesi latihan yang dibuat.'
                  : 'Tidak ada sesi yang cocok dengan pencarian.'}
              </div>
            ) : (
              <>
                {/* ── Mobile Card List ──────────────────────────────── */}
                <div className="md:hidden divide-y-2 divide-pixel-gray/30">
                  {paginatedSessions.map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onEdit={handleOpenModal}
                      onDelete={setSessionToDelete}
                    />
                  ))}
                </div>

                {/* ── Desktop Table ─────────────────────────────────── */}
                <div className="hidden md:block overflow-x-auto">
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
                      {paginatedSessions.map(session => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          onEdit={handleOpenModal}
                          onDelete={setSessionToDelete}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Pagination ────────────────────────────────────── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-pixel-gray/30">
                    <span className="text-xs text-pixel-lavender font-mono">
                      {filteredSessions.length} sesi &middot; Hal. {currentPage} / {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2 gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Sebelumnya</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2 gap-1"
                      >
                        <span className="hidden sm:inline">Berikutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal Tambah / Edit Sesi ──────────────────────────────────────── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
        >
          <div className="bg-pixel-panel rounded-none shadow-pixel-lg border-4 border-pixel-gray w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-pixel-pop">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b-2 border-pixel-gray bg-pixel-navy shrink-0">
              <h3 className="font-bold text-pixel-white text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {selectedSession ? 'Ubah Sesi Latihan' : 'Buat Sesi Latihan Baru'}
              </h3>
              <Button
                onClick={handleCloseModal}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 pixel-scroll">

                {/* Pilih Ekskul */}
                <div className="space-y-1.5">
                  <Label htmlFor="s_ekskul">Ekstrakurikuler</Label>
                  <select
                    id="s_ekskul"
                    required
                    className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.extracurricular_id}
                    onChange={e => handleEkskulChange(e.target.value)}
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
                    onChange={e => setForm(f => ({
                      ...f,
                      is_special_training: e.target.checked,
                      event_name: '',
                      selected_students: [],
                    }))}
                    className="mt-1 h-4 w-4 accent-pixel-orange"
                  />
                  <div>
                    <label htmlFor="is_special" className="font-retro text-base text-pixel-orange cursor-pointer">
                      Sesi Latihan Khusus (Persiapan Lomba)
                    </label>
                    <p className="text-xs text-pixel-lavender mt-1">
                      Latihan khusus di luar jadwal reguler, dibatasi max 3x pertemuan per event.
                    </p>
                  </div>
                </div>

                {/* Special Training Fields */}
                {form.is_special_training && (
                  <div className="space-y-4 p-4 border border-pixel-orange/30 bg-pixel-panel-light relative">
                    <Trophy className="absolute top-4 right-4 w-12 h-12 text-pixel-orange/10 pointer-events-none" />

                    {/* Nama Event */}
                    <div className="space-y-1.5">
                      <Label htmlFor="event_name">Nama Event / Perlombaan</Label>
                      <Input
                        id="event_name"
                        placeholder="Contoh: O2SN 2026, Porseni Kota"
                        value={form.event_name}
                        onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}
                        className="border-pixel-orange/50 focus-visible:ring-pixel-orange"
                      />
                    </div>

                    {/* Pilih Siswa */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Pilih Siswa Peserta Latihan Khusus</Label>
                        {enrolledStudents.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectAllStudents}
                            className="text-xs text-pixel-blue hover:underline font-mono flex items-center gap-1 shrink-0"
                          >
                            <Users className="w-3 h-3" />
                            {allStudentsSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-pixel-gray/30 bg-pixel-navy p-2 space-y-1">
                        {enrolledStudents.length === 0 ? (
                          <div className="p-2 text-xs text-pixel-lavender text-center">
                            Belum ada siswa terdaftar / Sedang memuat...
                          </div>
                        ) : (
                          enrolledStudents.map(student => (
                            <label
                              key={student.id}
                              className="flex items-center gap-2 p-1.5 hover:bg-pixel-panel-light cursor-pointer text-sm text-pixel-peach"
                            >
                              <input
                                type="checkbox"
                                checked={form.selected_students.includes(student.id)}
                                onChange={e => handleStudentToggle(student.id, e.target.checked)}
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

                {/* Pelatih yang Memimpin */}
                <CoachCheckboxList
                  ekskul={selectedEkskulObj}
                  coachesPresent={form.coaches_present}
                  onToggle={handleCoachToggle}
                />

                {/* Tanggal Latihan */}
                <div className="space-y-1.5">
                  <Label htmlFor="s_date">Tanggal Latihan</Label>
                  <Input
                    id="s_date"
                    type="date"
                    required
                    value={form.session_date}
                    onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                  />
                </div>

                {/* Target Tingkat Kelas */}
                <div className="space-y-2">
                  <Label>Target Tingkat Kelas (Kosongkan untuk Semua Kelas)</Label>
                  <div className="flex gap-4 p-3 bg-pixel-navy border border-pixel-gray/30">
                    {CLASS_GRADES.map(grade => (
                      <label
                        key={grade}
                        className="flex items-center gap-2 cursor-pointer font-retro text-base text-pixel-peach select-none"
                      >
                        <input
                          type="checkbox"
                          checked={form.target_classes?.includes(grade)}
                          onChange={e => handleGradeToggle(grade, e.target.checked)}
                          className="h-4 w-4 accent-pixel-blue"
                        />
                        <span>Kelas {grade}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Topik Latihan */}
                <div className="space-y-1.5">
                  <Label htmlFor="s_topic">Materi / Topik Latihan</Label>
                  <Input
                    id="s_topic"
                    required
                    placeholder="Contoh: Teknik Dribbling, Latihan Fisik"
                    value={form.topic}
                    onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  />
                </div>

                {/* Catatan & Evaluasi Sesi */}
                <div className="space-y-1.5">
                  <Label htmlFor="s_notes">Catatan &amp; Evaluasi Sesi</Label>
                  <Textarea
                    id="s_notes"
                    placeholder="Masukkan evaluasi atau poin-poin latihan..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

              </div>

              {/* Modal Footer */}
              <div className="shrink-0 p-4 border-t-2 border-pixel-gray bg-pixel-navy flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={handleCloseModal}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-pixel-white border-t-transparent rounded-full animate-spin inline-block" />
                      Menyimpan...
                    </>
                  ) : 'Simpan Sesi'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm: Delete Session ───────────────────────────────────────── */}
      <PixelConfirmModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
        title="HAPUS SESI LATIHAN?"
        description={`Apakah Anda yakin ingin menghapus sesi "${sessionToDelete?.topic || 'Sesi Latihan'}" pada tanggal ${
          sessionToDelete?.session_date
            ? parseLocalDate(sessionToDelete.session_date).toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })
            : ''
        }? Semua data absensi siswa pada sesi ini juga akan ikut terhapus.`}
        confirmText="HAPUS SESI"
        cancelText="BATAL"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* ── Confirm: Discard Changes ──────────────────────────────────────── */}
      <PixelConfirmModal
        isOpen={isDiscardConfirmOpen}
        onClose={() => setIsDiscardConfirmOpen(false)}
        onConfirm={() => {
          setIsDiscardConfirmOpen(false)
          setIsModalOpen(false)
        }}
        title="BATALKAN PENGISIAN?"
        description="Data yang sudah diisi akan hilang dan tidak tersimpan. Yakin ingin menutup form ini?"
        confirmText="YA, TUTUP"
        cancelText="LANJUT ISI"
        variant="danger"
      />

    </div>
  )
}
