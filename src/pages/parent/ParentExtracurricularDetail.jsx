import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useParentChildren } from '../../hooks/useParentChildren'
import { useAttendanceSummary } from '../../hooks/useAttendanceSummary'
import { supabase } from '../../lib/supabaseClient'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
 PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
 LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { ArrowLeft, Clock, User, CalendarDays, BookOpen, TrendingUp, Filter, Loader2 } from 'lucide-react'

const STATUS_COLORS = { hadir: '#10b981', izin: '#f59e0b', alpha: '#ef4444' }
const STATUS_LABEL = { hadir: 'Hadir', izin: 'Izin', alpha: 'Alpha' }

function AttStatusBadge({ status }) {
 const cfg = {
 hadir: 'bg-emerald-100 text-pixel-green',
 izin: 'bg-amber-100 text-amber-700',
 alpha: 'bg-rose-100 text-rose-700',
 }
 return (
 <span className={`inline-flex px-2 py-0.5 rounded-none font-retro text-base ${cfg[status] || 'bg-slate-100 text-pixel-peach'}`}>
 {STATUS_LABEL[status] || status}
 </span>
 )
}

function PredikatBadge({ predikat }) {
 const cfg = { A: 'bg-emerald-100 text-pixel-green', B: 'bg-blue-100 text-blue-700', C: 'bg-amber-100 text-amber-700', D: 'bg-rose-100 text-rose-700' }
 return (
 <span className={`inline-flex px-2.5 py-0.5 rounded-none font-retro text-base ${cfg[predikat] || 'bg-slate-100 text-pixel-peach'}`}>
 {predikat}
 </span>
 )
}

function calcPredikat(avg) {
 if (avg >= 90) return 'A'
 if (avg >= 75) return 'B'
 if (avg >= 60) return 'C'
 return 'D'
}

export default function ParentExtracurricularDetail() {
 const { id: ekskulId } = useParams()
 const { selectedChild } = useParentChildren()
 const studentId = selectedChild?.id
 const navigate = useNavigate()
 
 const [ekskul, setEkskul] = useState(null)
 const [grades, setGrades] = useState([])
 const [monthFilter, setMonthFilter] = useState('')
 const [loadingEkskul, setLoadingEkskul] = useState(true)
 const [loadingGrades, setLoadingGrades] = useState(true)

 const { summary, attendances, loading: attLoading } = useAttendanceSummary(studentId, ekskulId)

 useEffect(() => {
 if (ekskulId) fetchEkskul()
 if (ekskulId && studentId) fetchGrades()
 }, [ekskulId, studentId])

 const fetchEkskul = async () => {
 setLoadingEkskul(true)
 try {
 const { data } = await supabase
 .from('extracurriculars')
 .select('*, users(full_name)')
 .eq('id', ekskulId)
 .single()
 setEkskul(data)
 } catch (err) { console.error(err) }
 finally { setLoadingEkskul(false) }
 }

 const fetchGrades = async () => {
 setLoadingGrades(true)
 try {
 const { data } = await supabase
 .from('grades')
 .select('*')
 .eq('student_id', studentId)
 .eq('extracurricular_id', ekskulId)
 .order('graded_at', { ascending: true })
 const enriched = (data || []).map(g => {
 const avg = Math.round(((g.attitude_score || 0) + (g.skill_score || 0) + (g.activity_score || 0)) / 3)
 return { ...g, avg, predikat: calcPredikat(avg) }
 })
 setGrades(enriched)
 } catch (err) { console.error(err) }
 finally { setLoadingGrades(false) }
 }

 // Donut chart data
 const donutData = [
 { name: 'Hadir', value: summary.hadir, color: STATUS_COLORS.hadir },
 { name: 'Izin', value: summary.izin, color: STATUS_COLORS.izin },
 { name: 'Alpha', value: summary.alpha, color: STATUS_COLORS.alpha },
 ].filter(d => d.value > 0)

 // Filter attendances by month
 const filteredAttendances = monthFilter
 ? attendances.filter(a => a.session?.session_date?.startsWith(monthFilter))
 : attendances

 // Line chart data for grades
 const lineData = grades.map(g => ({
 semester: `${g.semester} ${g.academic_year}`,
 Sikap: g.attitude_score,
 Keterampilan: g.skill_score,
 Keaktifan: g.activity_score,
 'Rata-rata': g.avg,
 }))

 // Available months
 const availableMonths = [...new Set(
 attendances.map(a => a.session?.session_date?.slice(0, 7)).filter(Boolean)
 )].sort().reverse()

 if (!selectedChild || loadingEkskul) {
 return (
 <div className="flex items-center justify-center py-20 text-pixel-lavender">
 <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
 </div>
 )
 }

 return (
 <div className="space-y-6">
 {/* Back + Header */}
 <div>
 <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-pixel-purple hover:text-violet-800 font-medium mb-4">
 <ArrowLeft className="w-4 h-4" /> Kembali
 </button>

 <div className="bg-pixel-purple rounded-none p-6 text-pixel-white shadow-pixel ">
 <h1 className="text-xl font-bold">{ekskul?.name}</h1>
 <p className="text-violet-200 text-sm mt-1 line-clamp-2">{ekskul?.description || 'Tidak ada deskripsi.'}</p>
 <div className="flex items-center gap-4 mt-3 flex-wrap">
 {ekskul?.users?.full_name && (
 <span className="flex items-center gap-1.5 text-xs text-violet-100">
 <User className="w-3.5 h-3.5" /> {ekskul.users.full_name}
 </span>
 )}
 <span className="flex items-center gap-1.5 text-xs text-violet-100">
 <Clock className="w-3.5 h-3.5" /> {ekskul?.schedule || 'Jadwal belum diatur'}
 </span>
 </div>
 </div>
 </div>

 {/* Tabs */}
 <Tabs defaultValue="kehadiran">
 <TabsList className="bg-violet-50 border border-violet-100 rounded-none p-1 w-full grid grid-cols-2">
 <TabsTrigger value="kehadiran" className="rounded-none data-[state=active]:bg-pixel-panel data-[state=active]:shadow-pixel-sm data-[state=active]:text-violet-700 font-medium">
 <CalendarDays className="w-4 h-4 mr-1.5" /> Kehadiran
 </TabsTrigger>
 <TabsTrigger value="nilai" className="rounded-none data-[state=active]:bg-pixel-panel data-[state=active]:shadow-pixel-sm data-[state=active]:text-violet-700 font-medium">
 <TrendingUp className="w-4 h-4 mr-1.5" /> Nilai
 </TabsTrigger>
 </TabsList>

 {/* ===== TAB KEHADIRAN ===== */}
 <TabsContent value="kehadiran" className="mt-4 space-y-4">
 {attLoading ? (
 <div className="bg-pixel-panel rounded-none p-8 text-center text-pixel-lavender animate-pulse border border-violet-50">
 Memuat data kehadiran...
 </div>
 ) : (
 <>
 {/* Donut + Stats */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* Donut Chart */}
 <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50">
 <h3 className="text-sm font-bold text-pixel-peach mb-3">Rekap Kehadiran</h3>
 {summary.total === 0 ? (
 <p className="text-center text-sm text-pixel-lavender py-8">Belum ada data kehadiran.</p>
 ) : (
 <ResponsiveContainer width="100%" height={200}>
 <PieChart>
 <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
 paddingAngle={3} dataKey="value">
 {donutData.map((entry, i) => (
 <Cell key={i} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip formatter={(val, name) => [`${val} sesi`, name]} />
 <Legend wrapperStyle={{ fontSize: '12px' }} />
 </PieChart>
 </ResponsiveContainer>
 )}
 </div>

 {/* Stats */}
 <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 space-y-3">
 <h3 className="text-sm font-bold text-pixel-peach">Statistik</h3>
 <div className="text-center py-2">
 <p className={`text-4xl font-extrabold ${summary.percentage >= 75 ? 'text-pixel-green' : summary.percentage >= 50 ? 'text-pixel-orange' : 'text-pixel-red'}`}>
 {summary.percentage}%
 </p>
 <p className="text-xs text-pixel-lavender mt-1">Persentase Kehadiran</p>
 </div>
 <div className="grid grid-cols-2 gap-2 text-center">
 {[
 { label: 'Total Sesi', val: summary.total, color: 'text-pixel-peach' },
 { label: 'Hadir', val: summary.hadir, color: 'text-pixel-green' },
 { label: 'Izin', val: summary.izin, color: 'text-pixel-orange' },
 { label: 'Alpha', val: summary.alpha, color: 'text-pixel-red' },
 ].map(item => (
 <div key={item.label} className="bg-pixel-navy rounded-none py-2">
 <p className={`text-xl font-bold ${item.color}`}>{item.val}</p>
 <p className="text-xs text-pixel-lavender">{item.label}</p>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Table */}
 <div className="bg-pixel-panel rounded-none shadow-pixel-sm border border-violet-50 overflow-hidden">
 <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
 <h3 className="text-sm font-bold text-pixel-peach flex items-center gap-2">
 <BookOpen className="w-4 h-4 text-violet-500" /> Riwayat Absensi
 </h3>
 {availableMonths.length > 0 && (
 <div className="flex items-center gap-2">
 <Filter className="w-3.5 h-3.5 text-pixel-lavender" />
 <select
 value={monthFilter}
 onChange={e => setMonthFilter(e.target.value)}
 className="text-xs border border-pixel-gray rounded-none px-2 py-1 text-pixel-peach focus:outline-none focus:ring-2 focus:ring-violet-300"
 >
 <option value="">Semua Bulan</option>
 {availableMonths.map(m => (
 <option key={m} value={m}>
 {new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
 </option>
 ))}
 </select>
 </div>
 )}
 </div>

 {filteredAttendances.length === 0 ? (
 <p className="text-center text-sm text-pixel-lavender py-8">Tidak ada data kehadiran.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-pixel-navy">
 <tr>
 <th className="text-left px-5 py-3 font-retro text-base text-pixel-lavender">Tanggal</th>
 <th className="text-left px-5 py-3 font-retro text-base text-pixel-lavender">Topik Sesi</th>
 <th className="text-left px-5 py-3 font-retro text-base text-pixel-lavender">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {filteredAttendances.map(att => (
 <tr key={att.id} className="hover:bg-pixel-panel-light">
 <td className="px-5 py-3 text-xs text-pixel-peach whitespace-nowrap">
 {att.session?.session_date
 ? new Date(att.session.session_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
 : '—'}
 </td>
 <td className="px-5 py-3 text-xs text-pixel-peach max-w-xs truncate">
 {att.session?.topic || 'Tidak ada topik'}
 </td>
 <td className="px-5 py-3">
 <AttStatusBadge status={att.status} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </>
 )}
 </TabsContent>

 {/* ===== TAB NILAI ===== */}
 <TabsContent value="nilai" className="mt-4 space-y-4">
 {loadingGrades ? (
 <div className="bg-pixel-panel rounded-none p-8 text-center text-pixel-lavender animate-pulse border border-violet-50">
 Memuat nilai...
 </div>
 ) : grades.length === 0 ? (
 <div className="bg-pixel-panel rounded-none p-10 text-center border border-violet-50 shadow-pixel-sm">
 <TrendingUp className="w-10 h-10 text-violet-200 mx-auto mb-3" />
 <p className="text-pixel-lavender text-sm">Belum ada nilai yang diinput.</p>
 </div>
 ) : (
 <>
 {/* Grades Table */}
 <div className="bg-pixel-panel rounded-none shadow-pixel-sm border border-violet-50 overflow-hidden">
 <div className="px-5 py-4 border-b border-slate-50">
 <h3 className="text-sm font-bold text-pixel-peach">Tabel Nilai Per Semester</h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-pixel-navy">
 <tr>
 {['Semester', 'Th. Ajaran', 'Sikap', 'Keterampilan', 'Keaktifan', 'Rata-rata', 'Predikat'].map(h => (
 <th key={h} className="text-left px-4 py-3 font-retro text-base text-pixel-lavender whitespace-nowrap">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {grades.map(g => (
 <tr key={g.id} className="hover:bg-pixel-panel-light">
 <td className="px-4 py-3 font-retro text-base text-pixel-peach whitespace-nowrap">{g.semester}</td>
 <td className="px-4 py-3 text-xs text-pixel-lavender whitespace-nowrap">{g.academic_year}</td>
 <td className="px-4 py-3 font-retro text-base text-pixel-peach">{g.attitude_score ?? '—'}</td>
 <td className="px-4 py-3 font-retro text-base text-pixel-peach">{g.skill_score ?? '—'}</td>
 <td className="px-4 py-3 font-retro text-base text-pixel-peach">{g.activity_score ?? '—'}</td>
 <td className="px-4 py-3 font-retro text-base text-violet-700">{g.avg}</td>
 <td className="px-4 py-3"><PredikatBadge predikat={g.predikat} /></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Line Chart */}
 {lineData.length > 1 && (
 <div className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50">
 <h3 className="text-sm font-bold text-pixel-peach mb-4">Tren Nilai Per Semester</h3>
 <ResponsiveContainer width="100%" height={220}>
 <LineChart data={lineData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
 <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
 <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
 <Tooltip />
 <Legend wrapperStyle={{ fontSize: '11px' }} />
 <Line type="monotone" dataKey="Sikap" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
 <Line type="monotone" dataKey="Keterampilan" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} />
 <Line type="monotone" dataKey="Keaktifan" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
 <Line type="monotone" dataKey="Rata-rata" stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}
 </>
 )}
 </TabsContent>
 </Tabs>
 </div>
 )
}
