import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useStudentProfile } from '../../hooks/useStudentProfile'
import { 
  LayoutDashboard, Activity, ClipboardCheck, GraduationCap,
  Bell, LogOut, Sparkles
} from 'lucide-react'

const navItems = [
  { name: 'Beranda', path: '/student/dashboard', icon: LayoutDashboard },
  { name: 'Ekskul Saya', path: '/student/extracurriculars', icon: Activity },
  { name: 'Kehadiran', path: '/student/attendance', icon: ClipboardCheck },
  { name: 'Nilai', path: '/student/grades', icon: GraduationCap },
]

export default function StudentLayout() {
  const { logout } = useAuthStore()
  const { profile } = useStudentProfile()
  const location = useLocation()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-violet-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 hidden sm:block text-sm tracking-tight">
              Ekskul <span className="text-violet-600">Portal</span>
            </span>
          </div>

          {/* Right: Profile + Actions */}
          <div className="flex items-center gap-2">
            {/* Notification */}
            <button className="relative p-2 rounded-xl hover:bg-violet-50 text-slate-500 hover:text-violet-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>

            {/* Profile chip */}
            <div className="flex items-center gap-2.5 bg-violet-50 rounded-xl px-3 py-1.5 border border-violet-100">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{profile?.full_name || 'Memuat...'}</p>
                <p className="text-xs text-violet-500 leading-tight">{profile?.class || 'Siswa'}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex max-w-6xl mx-auto">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 sticky top-16 h-[calc(100vh-4rem)] p-4 gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/student/dashboard' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200'
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 py-6 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-violet-100 shadow-lg z-50 safe-area-inset-bottom">
        <div className="grid grid-cols-4 h-16 max-w-sm mx-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/student/dashboard' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
                  isActive ? 'text-violet-600' : 'text-slate-400'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? 'bg-violet-100 scale-110' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
