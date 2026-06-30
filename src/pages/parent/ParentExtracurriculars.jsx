import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useParentChildren } from '../../hooks/useParentChildren'
import { supabase } from '../../lib/supabaseClient'
import { Activity, Clock, User, ChevronRight, Layers, Loader2 } from 'lucide-react'

function StatusBadge({ status }) {
 if (status === 'active') return (
 <span className="inline-flex items-center gap-1 font-retro text-base px-2 py-0.5 rounded-none bg-emerald-100 text-pixel-green">
 <span className="w-1.5 h-1.5 rounded-none bg-pixel-green/100"></span> Aktif
 </span>
 )
 return (
 <span className="inline-flex items-center gap-1 font-retro text-base px-2 py-0.5 rounded-none bg-slate-100 text-pixel-lavender">
 <span className="w-1.5 h-1.5 rounded-none bg-slate-400"></span> Tidak Aktif
 </span>
 )
}

export default function ParentExtracurriculars() {
 const { selectedChild } = useParentChildren()
 const studentId = selectedChild?.id
 const [enrollments, setEnrollments] = useState([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 if (studentId) {
 fetchEnrollments()
 } else {
 setEnrollments([])
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
 users(full_name)
 )
 `)
 .eq('student_id', studentId)
 .order('enrolled_at', { ascending: false })

 if (error) throw error
 setEnrollments(data || [])
 } catch (err) {
 console.error('ParentExtracurriculars error:', err)
 } finally {
 setLoading(false)
 }
 }

 if (!selectedChild) {
 return (
 <div className="flex items-center justify-center py-20 text-pixel-lavender">
 <Loader2 className="w-8 h-8 animate-spin" />
 </div>
 )
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div>
 <h1 className="text-xl font-bold text-pixel-white">Ekskul Anak</h1>
 <p className="text-sm text-pixel-lavender mt-0.5">Semua ekstrakurikuler yang diikuti oleh {selectedChild.full_name.split(' ')[0]}</p>
 </div>

 {loading ? (
 <div className="space-y-3">
 {[1,2,3].map(i => (
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
 <p className="text-sm text-pixel-lavender">Anak Anda belum terdaftar di ekskul apapun.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {enrollments.map(enr => {
 const ekskul = enr.extracurriculars
 const coachName = ekskul?.users?.full_name

 return (
 <Link
 key={enr.id}
 to={`/parent/extracurriculars/${ekskul?.id}`}
 className="flex items-center gap-4 bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 hover:brightness-110 hover:border-violet-200 group"
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

 {/* Arrow */}
 <ChevronRight className="w-5 h-5 text-pixel-peach group-hover:text-violet-500 group-hover:translate-x-1 shrink-0" />
 </Link>
 )
 })}
 </div>
 )}
 </div>
 )
}
