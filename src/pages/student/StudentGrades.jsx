import { useState, useMemo } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useGrades } from '../../hooks/useGrades'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip, Legend
} from 'recharts'
import { GraduationCap, Filter, Loader2, TrendingUp } from 'lucide-react'

export default function StudentGrades() {
  const { studentId } = useAuthStore()
  const [selectedSemester, setSelectedSemester] = useState('')

  // Fetch ALL grades once, then filter locally for UI speed and to avoid duplicate real-time WebSocket subscriptions
  const { grades: allGrades, loading: allLoading } = useGrades(studentId, null)

  const semesters = useMemo(() => {
    if (!allGrades) return []
    const unique = new Set(allGrades.map(g => g.semester))
    return Array.from(unique).sort()
  }, [allGrades])

  // Filtered grades with extracurricular relationship validation
  const displayGrades = useMemo(() => {
    if (!allGrades) return []
    const filtered = selectedSemester 
      ? allGrades.filter(g => g.semester === selectedSemester)
      : allGrades
    // Guard against grades with missing extracurricular details to avoid Recharts blank screen crashes
    return filtered.filter(g => g.extracurriculars && g.extracurriculars.name)
  }, [allGrades, selectedSemester])

  // Prepare data for Radar Chart
  const radarData = useMemo(() => {
    if (displayGrades.length === 0) return []
    
    // We want to show comparison of Sikap, Keterampilan, Pengetahuan per ekskul
    // The format for Recharts Radar is:
    // [ { subject: 'Sikap', EkskulA: 90, EkskulB: 80 }, { subject: 'Keterampilan', ... } ]
    
    const subjects = ['Sikap', 'Keterampilan', 'Pengetahuan']
    const data = subjects.map(subj => {
      const row = { subject: subj }
      displayGrades.forEach(g => {
        const eksName = g.extracurriculars.name
        if (subj === 'Sikap') row[eksName] = g.attitude_score || 0
        if (subj === 'Keterampilan') row[eksName] = g.skill_score || 0
        if (subj === 'Pengetahuan') row[eksName] = g.knowledge_score || 0
      })
      return row
    })
    return data
  }, [displayGrades])

  // Colors for radar
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-violet-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-violet-500" />
            Nilai Saya
          </h1>
          <p className="text-sm text-slate-500 mt-1">Laporan nilai seluruh ekstrakurikuler</p>
        </div>

        {semesters.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedSemester}
              onChange={e => setSelectedSemester(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="">Semua Semester</option>
              {semesters.map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {allGrades.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-violet-50 shadow-sm">
          <TrendingUp className="w-12 h-12 text-violet-200 mx-auto mb-4" />
          <p className="text-slate-500">Belum ada nilai yang diinput oleh pelatih.</p>
        </div>
      ) : displayGrades.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-violet-50 shadow-sm">
          <p className="text-slate-500">Tidak ada nilai untuk semester yang dipilih.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Radar Chart */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-violet-50 overflow-hidden">
            <h3 className="text-sm font-bold text-slate-700 mb-6 text-center">Perbandingan Nilai Antar Ekskul</h3>
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
              <div key={g.id} className="bg-white rounded-2xl p-5 shadow-sm border border-violet-50 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 line-clamp-1">{g.extracurriculars?.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Semester {g.semester} ({g.academic_year})</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-2xl font-black ${
                      g.predikat === 'A' ? 'text-emerald-500' :
                      g.predikat === 'B' ? 'text-blue-500' :
                      g.predikat === 'C' ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {g.predikat}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Rata-rata: {g.avg}</span>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Sikap</span>
                    <span className="font-semibold text-slate-800">{g.attitude_score}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-400 rounded-full" style={{ width: `${g.attitude_score}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2">
                    <span className="text-slate-600">Keterampilan</span>
                    <span className="font-semibold text-slate-800">{g.skill_score}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${g.skill_score}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2">
                    <span className="text-slate-600">Pengetahuan</span>
                    <span className="font-semibold text-slate-800">{g.knowledge_score}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${g.knowledge_score}%` }}></div>
                  </div>
                </div>
                
                {g.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 italic border border-slate-100">
                    "{g.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
