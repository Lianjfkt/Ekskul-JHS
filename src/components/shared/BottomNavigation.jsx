import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { 
  LayoutDashboard, 
  Activity, 
  ClipboardCheck,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BottomNavigation() {
  const { role } = useAuthStore()
  const location = useLocation()

  // Only show for student and parent
  if (role !== 'student' && role !== 'parent') return null

  const menus = {
    student: [
      { name: 'Beranda', path: '/student/dashboard', icon: LayoutDashboard },
      { name: 'Ekskul', path: '/student/extracurriculars', icon: Activity },
      { name: 'Kehadiran', path: '/student/attendance', icon: ClipboardCheck },
      { name: 'Nilai', path: '/student/grades', icon: GraduationCap },
    ],
    parent: [
      { name: 'Beranda', path: '/parent/dashboard', icon: LayoutDashboard },
      { name: 'Ekskul', path: '/parent/extracurriculars', icon: Activity },
      { name: 'Kehadiran', path: '/parent/attendance', icon: ClipboardCheck },
      { name: 'Nilai', path: '/parent/grades', icon: GraduationCap },
    ]
  }

  const currentMenu = menus[role] || []

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 lg:hidden z-50 pb-safe">
      <div className="flex justify-around items-center h-16">
        {currentMenu.map((item) => {
          // Check if active (exact match for dashboard, startsWith for others)
          const isActive = item.path.includes('dashboard') 
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path)
            
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "fill-primary/20")} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
