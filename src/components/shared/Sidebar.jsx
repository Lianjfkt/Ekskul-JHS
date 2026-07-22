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
  FileSpreadsheet,
  ShieldAlert
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
      { name: 'Kepatuhan Siswa', path: '/admin/compliance', icon: ShieldAlert },
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
      "fixed inset-y-0 left-0 z-50 w-64 bg-pixel-panel border-r-4 border-pixel-gray lg:translate-x-0 lg:static lg:inset-auto",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo Area */}
      <div className="flex items-center justify-center h-16 bg-pixel-navy border-b-4 border-pixel-gray">
        <span className="font-pixel text-[10px] text-pixel-blue pixel-text-shadow flex items-center gap-2 tracking-wider">
          <Activity className="w-5 h-5 text-pixel-green" />
          EKSKUL APP
        </span>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 mt-3">
        {currentMenu.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          const Icon = item.icon
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-none border-2 font-retro text-lg",
                isActive 
                  ? "bg-pixel-blue/20 text-pixel-blue border-pixel-blue pixel-text-shadow" 
                  : "text-pixel-peach border-transparent hover:bg-pixel-panel-light hover:border-pixel-gray"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Decorative pixel art bottom */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="w-2 h-2 bg-pixel-lavender/30"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
