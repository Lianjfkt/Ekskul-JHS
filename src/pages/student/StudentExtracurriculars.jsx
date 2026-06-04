import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { Activity, Clock, User, ChevronRight, Layers, Loader2 } from 'lucide-react'

function StatusBadge({ status }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aktif
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Tidak Aktif
    </span>
  )
}

export default function StudentExtracurriculars() {
  const { studentId } = useAuthStore()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentId) fetchEnrollments()
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
      console.error('StudentExtracurriculars error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Ekskul Saya</h1>
        <p className="text-sm text-slate-500 mt-0.5">Semua ekstrakurikuler yang kamu ikuti</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-violet-50 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
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
        <div className="bg-white rounded-2xl p-12 text-center border border-violet-50 shadow-sm">
          <Layers className="w-12 h-12 text-violet-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-1">Belum Ada Ekskul</h3>
          <p className="text-sm text-slate-400">Kamu belum terdaftar di ekskul apapun.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map(enr => {
            const ekskul = enr.extracurriculars
            const coachName = ekskul?.users?.full_name

            return (
              <Link
                key={enr.id}
                to={`/student/extracurriculars/${ekskul?.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-violet-50 hover:shadow-md hover:border-violet-200 transition-all duration-200 group"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0 group-hover:from-violet-200 group-hover:to-purple-200 transition-all">
                  <Activity className="w-6 h-6 text-violet-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 group-hover:text-violet-700 transition-colors">
                      {ekskul?.name}
                    </h3>
                    <StatusBadge status={enr.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    {coachName && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        {coachName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {ekskul?.schedule || 'Jadwal belum diatur'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {ekskul?.description || 'Tidak ada deskripsi.'}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
