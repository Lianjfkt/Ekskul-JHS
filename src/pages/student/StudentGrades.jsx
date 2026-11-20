import { useState, useMemo } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useGrades } from '../../hooks/useGrades'
import { enrichGradeStats } from '../../utils/gradeUtils'
import {
 Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
 ResponsiveContainer, Tooltip, Legend,
 LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { GraduationCap, Filter, Loader2, TrendingUp, History, Calendar } from 'lucide-react'

// Semesta sort order for chronological display
const SEMESTER_ORDER = {
  'Pertengahan Semester Ganjil': 1,
  'Akhir Semester Ganjil': 2,
  'Pertengahan Semester Genap': 3,
  'Akhir Semester Genap': 4,
}

function sortGradesChronologically(grades) {
  return [...grades].sort((a, b) => {
    if (a.academic_year !== b.academic_year) return a.academic_year.localeCompare(b.academic_year)
    return (SEMESTER_ORDER[a.semester] || 0) - (SEMESTER_ORDER[b.semester] || 0)
  })
}

export default function StudentGrades() {
 const { studentId } = useAuthStore()
 const [selectedSemester, setSelectedSemester] = useState('')
 const [activeView, setActiveView] = useState('current') // 'current' | 'history'
 const [historyEkskulFilter, setHistoryEkskulFilter] = useState('') // '' = all

 // Fetch ALL grades once, then filter locally for UI speed and to avoid duplicate real-time WebSocket subscriptions
 const { grades: allGrades, loading: allLoading } = useGrades(studentId, null)

 const semesters = useMemo(() => {
  if (!allGrades) return []
  const unique = new Set(allGrades.map(g => g.semester))
  return Array.from(unique).sort()
 }, [allGrades])

 // All valid grades (with ekskul name) enriched with avg + predikat
 const validGrades = useMemo(() => {
  if (!allGrades) return []
  return allGrades
    .filter(g => g.extracurriculars && g.extracurriculars.name)
    .map(g => ({ ...g, ...enrichGradeStats(g) }))
 }, [allGrades])

 // Filtered grades for the "Semester Terpilih" tab
 const displayGrades = useMemo(() => {
  const filtered = selectedSemester
    ? validGrades.filter(g => g.semester === selectedSemester)
    : validGrades
  return filtered
 }, [validGrades, selectedSemester])

 // Distinct ekskul list for the history filter
 const ekskulList = useMemo(() => {
  const map = new Map()
  validGrades.forEach(g => {
    if (g.extracurriculars?.id) map.set(g.extracurriculars.id, g.extracurriculars.name)
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
 }, [validGrades])

 // Grades for history tab, sorted chronologically (newest first for cards)
 const historyGrades = useMemo(() => {
  const filtered = historyEkskulFilter
    ? validGrades.filter(g => g.extracurriculars?.id === historyEkskulFilter)
    : validGrades
  return sortGradesChronologically(filtered).reverse() // newest first for card display
 }, [validGrades, historyEkskulFilter])

 // Line chart data: grouped per semester period with avg per ekskul
 const lineChartData = useMemo(() => {
  const filtered = historyEkskulFilter
    ? validGrades.filter(g => g.extracurriculars?.id === historyEkskulFilter)
    : validGrades
  const sorted = sortGradesChronologically(filtered)

  // Build ordered period keys
  const periodMap = new Map()
  sorted.forEach(g => {
    const key = `${g.semester} ${g.academic_year}`
    if (!periodMap.has(key)) periodMap.set(key, { period: key })
    const point = periodMap.get(key)
    const eksName = g.extracurriculars?.name || 'Ekskul'
    point[eksName] = g.avg
  })
  return Array.from(periodMap.values())
 }, [validGrades, historyEkskulFilter])

 // Distinct ekskul names for Line series
 const lineKeys = useMemo(() => {
  const filtered = historyEkskulFilter
    ? validGrades.filter(g => g.extracurriculars?.id === historyEkskulFilter)
    : validGrades
  const names = new Set(filtered.map(g => g.extracurriculars?.name).filter(Boolean))
  return Array.from(names)
 }, [validGrades, historyEkskulFilter])

 // Prepare data for Radar Chart (current tab)
 const radarData = useMemo(() => {
  if (displayGrades.length === 0) return []
  const subjects = ['Sikap', 'Keterampilan', 'Keaktifan']
  const data = subjects.map(subj => {
   const row = { subject: subj }
   displayGrades.forEach(g => {
    const eksName = g.extracurriculars.name
    if (subj === 'Sikap') row[eksName] = g.attitude_score || 0
    if (subj === 'Keterampilan') row[eksName] = g.skill_score || 0
    if (subj === 'Keaktifan') row[eksName] = g.activity_score || 0
   })
   return row
  })
  return data
 }, [displayGrades])

 const colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e']

 if (allLoading) {
  return (
   <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
   </div>
  )
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="bg-pixel-panel rounded-none p-6 shadow-pixel-sm border border-violet-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
     <h1 className="text-xl font-bold text-pixel-white flex items-center gap-2">
      <GraduationCap className="w-6 h-6 text-violet-500" />
      Nilai Saya
     </h1>
     <p className="text-sm text-pixel-lavender mt-1">Laporan nilai seluruh ekstrakurikuler</p>
    </div>

    {/* Semester filter only shown for current tab */}
    {activeView === 'current' && semesters.length > 0 && (
     <div className="flex items-center gap-2">
      <Filter className="w-4 h-4 text-pixel-lavender" />
      <select
       value={selectedSemester}
       onChange={e => setSelectedSemester(e.target.value)}
       className="text-sm border border-pixel-gray rounded-none px-3 py-2 text-pixel-peach bg-pixel-navy focus:outline-none focus:ring-2 focus:ring-violet-300"
      >
       <option value="">Semua Semester</option>
       {semesters.map(s => (
        <option key={s} value={s}>{s}</option>
       ))}
      </select>
     </div>
    )}
   </div>

   {/* Tab Navigation */}
   {validGrades.length > 0 && (
    <div className="flex gap-0 border-b-2 border-pixel-gray/30">
     <button
      onClick={() => setActiveView('current')}
      className={`px-5 py-2.5 text-xs font-bold font-retro uppercase flex items-center gap-2 transition-all ${
       activeView === 'current'
        ? 'border-b-2 border-violet-500 text-violet-400 bg-pixel-panel/80 -mb-0.5'
        : 'text-pixel-lavender hover:text-pixel-white'
      }`}
     >
      <GraduationCap className="w-3.5 h-3.5" /> Semester Terpilih
     </button>
     <button
      onClick={() => setActiveView('history')}
      className={`px-5 py-2.5 text-xs font-bold font-retro uppercase flex items-center gap-2 transition-all ${
       activeView === 'history'
        ? 'border-b-2 border-pixel-peach text-pixel-peach bg-pixel-panel/80 -mb-0.5'
        : 'text-pixel-lavender hover:text-pixel-white'
      }`}
     >
      <History className="w-3.5 h-3.5" /> Riwayat &amp; Tren Nilai
     </button>
    </div>
   )}

   {allGrades.length === 0 ? (
    <div className="bg-pixel-panel rounded-none p-12 text-center border border-violet-50 shadow-pixel-sm">
     <TrendingUp className="w-12 h-12 text-violet-200 mx-auto mb-4" />
     <p className="text-pixel-lavender">Belum ada nilai yang diinput oleh pelatih.</p>
    </div>
   ) : activeView === 'current' ? (
    /* ===== TAB 1: SEMESTER TERPILIH ===== */
    displayGrades.length === 0 ? (
     <div className="bg-pixel-panel rounded-none p-12 text-center border border-violet-50 shadow-pixel-sm">
      <p className="text-pixel-lavender">Tidak ada nilai untuk semester yang dipilih.</p>
     </div>
    ) : (
     <div className="space-y-6">
      {/* Radar Chart */}
      <div className="bg-pixel-panel rounded-none p-4 sm:p-6 shadow-pixel-sm border border-violet-50 overflow-hidden">
       <h3 className="text-sm font-bold text-pixel-peach mb-6 text-center">Perbandingan Nilai Antar Ekskul</h3>
       <div className="w-full h-[300px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
         <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
          <PolarGrid stroke="#f1f5f9" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {displayGrades.map((g, i) => (
           <Radar
            key={g.id}
            name={g.extracurriculars?.name}
            dataKey={g.extracurriculars?.name}
            stroke={colors[i % colors.length]}
            fill={colors[i % colors.length]}
            fillOpacity={0.4}
           />
          ))}
         </RadarChart>
        </ResponsiveContainer>
       </div>
      </div>

      {/* Grades Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
       {displayGrades.map(g => (
        <div key={g.id} className="bg-pixel-panel rounded-none p-5 shadow-pixel-sm border border-violet-50 hover:brightness-110 transition-shadow">
         <div className="flex justify-between items-start mb-4">
          <div>
           <h3 className="font-bold text-pixel-white line-clamp-1">{g.extracurriculars?.name}</h3>
           <p className="text-xs text-pixel-lavender mt-0.5">Semester {g.semester} ({g.academic_year})</p>
          </div>
          <div className="flex flex-col items-end">
           <span className={`text-2xl font-black ${
            g.predikat === 'A' ? 'text-emerald-500' :
            g.predikat === 'B' ? 'text-blue-500' :
            g.predikat === 'C' ? 'text-amber-500' : 'text-pixel-red'
           }`}>
            {g.predikat}
           </span>
           <span className="text-[10px] font-bold text-pixel-lavender">Rata-rata: {g.avg}</span>
          </div>
         </div>

         <div className="space-y-2 mt-4">
          <div className="flex justify-between items-center text-sm">
           <span className="text-pixel-peach">Sikap</span>
           <span className="font-semibold text-pixel-white">{g.attitude_score ?? '-'}</span>
          </div>
          <div className="h-1.5 w-full bg-pixel-navy rounded-none overflow-hidden border border-pixel-gray/40">
           <div className="h-full bg-violet-400 rounded-none" style={{ width: `${g.attitude_score || 0}%` }}></div>
          </div>

          <div className="flex justify-between items-center text-sm pt-2">
           <span className="text-pixel-peach">Keterampilan</span>
           <span className="font-semibold text-pixel-white">{g.skill_score ?? '-'}</span>
          </div>
          <div className="h-1.5 w-full bg-pixel-navy rounded-none overflow-hidden border border-pixel-gray/40">
           <div className="h-full bg-cyan-400 rounded-none" style={{ width: `${g.skill_score || 0}%` }}></div>
          </div>

          <div className="flex justify-between items-center text-sm pt-2">
           <span className="text-pixel-peach">Keaktifan</span>
           <span className="font-semibold text-pixel-white">{g.activity_score ?? '-'}</span>
          </div>
          <div className="h-1.5 w-full bg-pixel-navy rounded-none overflow-hidden border border-pixel-gray/40">
           <div className="h-full bg-amber-400 rounded-none" style={{ width: `${g.activity_score || 0}%` }}></div>
          </div>
         </div>

         {g.notes && (
          <div className="mt-4 p-3 bg-pixel-navy rounded-none text-xs text-pixel-peach italic border border-pixel-gray/30">
           &ldquo;{g.notes}&rdquo;
          </div>
         )}
        </div>
       ))}
      </div>
     </div>
    )
   ) : (
    /* ===== TAB 2: RIWAYAT & TREN NILAI ===== */
    <div className="space-y-6">
     {/* Filter Ekskul */}
     {ekskulList.length > 1 && (
      <div className="flex items-center gap-3 bg-pixel-panel p-4 border border-pixel-gray/30">
       <Filter className="w-4 h-4 text-pixel-lavender flex-shrink-0" />
       <select
        value={historyEkskulFilter}
        onChange={e => setHistoryEkskulFilter(e.target.value)}
        className="text-sm border border-pixel-gray rounded-none px-3 py-2 text-pixel-peach bg-pixel-navy focus:outline-none focus:ring-2 focus:ring-violet-300"
       >
        <option value="">Semua Ekskul</option>
        {ekskulList.map(e => (
         <option key={e.id} value={e.id}>{e.name}</option>
        ))}
       </select>
       <span className="text-xs text-pixel-lavender">Filter tren per ekskul</span>
      </div>
     )}

     {/* Line Chart Tren Perkembangan */}
     {lineChartData.length >= 2 && (
      <div className="bg-pixel-panel rounded-none p-4 sm:p-6 shadow-pixel-sm border border-pixel-gray/30 overflow-hidden">
       <h3 className="text-xs font-pixel text-pixel-peach mb-6 text-center pixel-text-shadow">
        Tren Perkembangan Nilai Rata-rata
       </h3>
       <div className="w-full h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
         <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
           dataKey="period"
           tick={{ fill: '#94a3b8', fontSize: 10 }}
           angle={-30}
           textAnchor="end"
           interval={0}
          />
          <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip
           contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 12 }}
           labelStyle={{ color: '#f8fafc' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          {lineKeys.map((key, i) => (
           <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: colors[i % colors.length] }}
            activeDot={{ r: 6 }}
            connectNulls={false}
           />
          ))}
         </LineChart>
        </ResponsiveContainer>
       </div>
      </div>
     )}

     {/* Timeline Cards */}
     {historyGrades.length === 0 ? (
      <div className="bg-pixel-panel rounded-none p-10 text-center border border-pixel-gray/30">
       <History className="w-10 h-10 text-pixel-gray mx-auto mb-3 opacity-40" />
       <p className="text-pixel-lavender text-sm">Belum ada riwayat nilai yang tercatat.</p>
      </div>
     ) : (
      <div className="space-y-3">
       <h3 className="text-xs font-pixel text-pixel-lavender px-1">
        Linimasa Perkembangan ({historyGrades.length} Catatan)
       </h3>
       {historyGrades.map((g) => (
        <div
         key={g.id}
         className="bg-pixel-panel rounded-none border border-pixel-gray/30 p-4 hover:border-pixel-peach/40 transition-colors"
        >
         <div className="flex justify-between items-start mb-3">
          <div>
           <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-pixel-yellow" />
            <span className="text-xs font-bold text-pixel-white">
             {g.semester} &bull; {g.academic_year}
            </span>
           </div>
           <span className="font-bold text-pixel-peach">{g.extracurriculars?.name}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
           <span
            className={`px-2.5 py-1 text-sm font-black rounded-none ${
             g.predikat === 'A'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              : g.predikat === 'B'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              : g.predikat === 'C'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
            }`}
           >
            {g.predikat}
           </span>
           <span className="text-xs text-pixel-lavender font-mono">Rata-rata: {g.avg}</span>
          </div>
         </div>

         <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center mt-3">
          <div className="bg-pixel-navy/60 p-2 border border-pixel-gray/20">
           <span className="text-pixel-lavender block text-[10px] uppercase">Sikap</span>
           <span className="font-bold text-pixel-white">{g.attitude_score ?? '-'}</span>
          </div>
          <div className="bg-pixel-navy/60 p-2 border border-pixel-gray/20">
           <span className="text-pixel-lavender block text-[10px] uppercase">Keterampilan</span>
           <span className="font-bold text-pixel-white">{g.skill_score ?? '-'}</span>
          </div>
          <div className="bg-pixel-navy/60 p-2 border border-pixel-gray/20">
           <span className="text-pixel-lavender block text-[10px] uppercase">Aktivitas</span>
           <span className="font-bold text-pixel-white">{g.activity_score ?? '-'}</span>
          </div>
         </div>

         {g.notes && (
          <div className="mt-3 p-2 bg-pixel-navy/40 border-l-2 border-pixel-peach text-xs text-pixel-peach italic">
           &ldquo;{g.notes}&rdquo;
          </div>
         )}

         {g.graded_at && (
          <div className="mt-2 text-[10px] text-pixel-lavender/70 text-right">
           Dinilai: {new Date(g.graded_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
          </div>
         )}
        </div>
       ))}
      </div>
     )}
    </div>
   )}
  </div>
 )
}
