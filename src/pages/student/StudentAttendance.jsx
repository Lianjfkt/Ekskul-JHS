import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useAttendanceSummary } from '../../hooks/useAttendanceSummary'
import { supabase } from '../../lib/supabaseClient'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select"
import { ClipboardCheck, Loader2 } from 'lucide-react'

// Override some calendar styles for better UI
import './calendar-overrides.css'

export default function StudentAttendance() {
 const { studentId } = useAuthStore()
 const [enrollments, setEnrollments] = useState([])
 const [selectedEkskul, setSelectedEkskul] = useState('')
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 if (studentId) fetchEnrollments()
 }, [studentId])

 const fetchEnrollments = async () => {
 setLoading(true)
 try {
 const { data } = await supabase
 .from('enrollments')
 .select(`
 extracurricular_id,
 extracurriculars(id, name)
 `)
 .eq('student_id', studentId)
 .eq('status', 'active')
 
 const list = (data || []).map(d => ({
 id: d.extracurriculars.id,
 name: d.extracurriculars.name
 }))

 setEnrollments(list)
 if (list.length > 0) {
 setSelectedEkskul(list[0].id)
 }
 } catch (err) {
 console.error(err)
 } finally {
 setLoading(false)
 }
 }

 const { summary, attendances, loading: attLoading } = useAttendanceSummary(studentId, selectedEkskul)

 const getTileClassName = ({ date, view }) => {
 if (view === 'month') {
 // Format date to local YYYY-MM-DD
 const dateStr = date.toLocaleDateString('sv-SE') // sv-SE gives YYYY-MM-DD format
 
 const att = attendances.find(a => a.session?.session_date === dateStr)
 if (att) {
 if (att.status === 'hadir') return 'bg-emerald-100 text-pixel-green font-bold rounded-none border-2 border-white'
 if (att.status === 'izin') return 'bg-amber-100 text-amber-700 font-bold rounded-none border-2 border-white'
 if (att.status === 'alpha') return 'bg-rose-100 text-rose-700 font-bold rounded-none border-2 border-white'
 }
 }
 return null
 }

 const getTileContent = ({ date, view }) => {
 if (view === 'month') {
 const dateStr = date.toLocaleDateString('sv-SE')
 const att = attendances.find(a => a.session?.session_date === dateStr)
 if (att) {
 return (
 <div className="text-[10px] truncate w-full text-center mt-1 hidden sm:block">
 {att.session.topic}
 </div>
 )
 }
 }
 return null
 }

 if (loading) {
 return (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
 </div>
 )
 }

 return (
 <div className="space-y-6">
 {/* Header & Filter */}
 <div className="bg-pixel-panel rounded-none p-6 shadow-pixel-sm border border-violet-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-xl font-bold text-pixel-white flex items-center gap-2">
 <ClipboardCheck className="w-6 h-6 text-violet-500" />
 Rekap Kehadiran
 </h1>
 <p className="text-sm text-pixel-lavender mt-1">Pantau kehadiranmu di setiap ekstrakurikuler</p>
 </div>
 
 {enrollments.length > 0 && (
 <div className="w-full sm:w-64">
 <Select value={selectedEkskul} onValueChange={setSelectedEkskul}>
 <SelectTrigger className="w-full bg-pixel-navy border-pixel-gray">
 <SelectValue placeholder="Pilih Ekskul" />
 </SelectTrigger>
 <SelectContent>
 {enrollments.map(e => (
 <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>

 {enrollments.length === 0 ? (
 <div className="bg-pixel-panel rounded-none p-12 text-center border border-violet-50 shadow-pixel-sm">
 <p className="text-pixel-lavender">Kamu belum terdaftar di ekskul apapun.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Stats */}
 <div className="lg:col-span-1 space-y-4">
 <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 text-center">
 <h3 className="text-sm font-bold text-pixel-peach mb-2">Persentase Kehadiran</h3>
 {attLoading ? (
 <div className="h-12 flex items-center justify-center">
 <Loader2 className="w-6 h-6 animate-spin text-pixel-peach" />
 </div>
 ) : (
 <p className={`text-5xl font-extrabold ${summary.percentage >= 75 ? 'text-pixel-green' : summary.percentage >= 50 ? 'text-pixel-orange' : 'text-pixel-red'}`}>
 {summary.percentage}%
 </p>
 )}
 </div>
 
 <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50">
 <h3 className="text-sm font-bold text-pixel-peach mb-4">Statistik Total</h3>
 {attLoading ? (
 <div className="space-y-3">
 {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-none animate-pulse"></div>)}
 </div>
 ) : (
 <div className="space-y-3">
 <div className="flex justify-between items-center p-3 rounded-none bg-pixel-navy">
 <span className="text-sm text-pixel-peach font-medium">Total Sesi</span>
 <span className="font-bold text-pixel-white">{summary.total}</span>
 </div>
 <div className="flex justify-between items-center p-3 rounded-none bg-pixel-green/10 text-pixel-green">
 <span className="font-retro text-lg">Hadir</span>
 <span className="font-bold">{summary.hadir}</span>
 </div>
 <div className="flex justify-between items-center p-3 rounded-none bg-amber-50 text-amber-700">
 <span className="font-retro text-lg">Izin</span>
 <span className="font-bold">{summary.izin}</span>
 </div>
 <div className="flex justify-between items-center p-3 rounded-none bg-pixel-red/10 text-rose-700">
 <span className="font-retro text-lg">Alpha</span>
 <span className="font-bold">{summary.alpha}</span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Calendar */}
 <div className="lg:col-span-2">
 <div className="bg-pixel-panel rounded-none p-4 sm:p-6 shadow-pixel-sm border border-violet-50 overflow-hidden">
 <h3 className="text-sm font-bold text-pixel-peach mb-4">Kalender Kehadiran</h3>
 {attLoading ? (
 <div className="h-64 flex items-center justify-center">
 <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
 </div>
 ) : (
 <div className="calendar-container w-full overflow-x-auto">
 <Calendar 
 className="w-full min-w-[300px] border-none font-sans"
 tileClassName={getTileClassName}
 tileContent={getTileContent}
 />
 </div>
 )}
 
 {/* Legend */}
 <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-50 text-xs text-pixel-peach">
 <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-none bg-pixel-green/100"></span> Hadir</span>
 <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-none bg-amber-500"></span> Izin</span>
 <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-none bg-pixel-red/100"></span> Alpha</span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
