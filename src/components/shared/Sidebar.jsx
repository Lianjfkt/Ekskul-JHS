import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { 
  LayoutDashboard, 
  Activity, 
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Users,
  BookOpen,
  FileSpreadsheet
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Sidebar({ isOpen }) {
  const { role } = useAuthStore()
  const location = useLocation()

  // Define menus based on role
  const menus = {
    admin: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Users', path: '/admin/users', icon: Users },
      { name: 'Ekskul', path: '/admin/extracurriculars', icon: Activity },
      { name: 'Pendaftaran', path: '/admin/enrollments', icon: BookOpen },
      { name: 'Rekap & Laporan', path: '/admin/recap', icon: FileSpreadsheet },
    ],
    coach: [
      { name: 'Dashboard', path: '/coach/dashboard', icon: LayoutDashboard },
      { name: 'Jadwal Sesi', path: '/coach/sessions', icon: CalendarDays },
      { name: 'Absensi', path: '/coach/attendances', icon: ClipboardCheck },
      { name: 'Nilai', path: '/coach/grades', icon: GraduationCap },
    ],
    student: [
      { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
      { name: 'Ekskul Saya', path: '/student/extracurriculars', icon: Activity },
      { name: 'Absensi', path: '/student/attendance', icon: ClipboardCheck },
      { name: 'Nilai', path: '/student/grades', icon: GraduationCap },
    ],
    parent: [
      { name: 'Dashboard', path: '/parent/dashboard', icon: LayoutDashboard },
      { name: 'Ekskul Anak', path: '/parent/extracurriculars', icon: Activity },
      { name: 'Absensi', path: '/parent/attendance', icon: ClipboardCheck },
      { name: 'Nilai', path: '/parent/grades', icon: GraduationCap },
    ]
  }

  const currentMenu = menus[role] || []

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex items-center justify-center h-16 bg-slate-950">
        <span className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Ekskul App
        </span>
      </div>
      <nav className="p-4 space-y-2 mt-4">
        {currentMenu.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          const Icon = item.icon
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground font-medium shadow-md" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
