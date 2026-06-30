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
    <div className="min-h-screen bg-pixel-navy pixel-bg-grid">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-pixel-panel border-b-4 border-pixel-gray">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-pixel-purple border-2 border-pixel-gray flex items-center justify-center shadow-pixel-sm">
              <Sparkles className="w-4 h-4 text-pixel-white" />
            </div>
            <span className="font-pixel text-[9px] text-pixel-peach hidden sm:block tracking-tight">
              Ekskul <span className="text-pixel-blue">Portal</span>
            </span>
          </div>

          {/* Right: Profile + Actions */}
          <div className="flex items-center gap-2">
            {/* Notification */}
            <button className="relative p-2 rounded-none hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-gray text-pixel-lavender hover:text-pixel-blue">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-pixel-red"></span>
            </button>

            {/* Profile chip */}
            <div className="flex items-center gap-2.5 bg-pixel-navy rounded-none px-3 py-1.5 border-2 border-pixel-gray">
              <div className="w-7 h-7 rounded-none bg-pixel-purple border border-pixel-gray flex items-center justify-center text-pixel-white font-pixel text-[8px] shadow-pixel-sm">
                {initials}
              </div>
              <div className="hidden sm:block font-retro text-lg">
                <p className="font-semibold text-pixel-white leading-tight">{profile?.full_name || 'Memuat...'}</p>
                <p className="text-pixel-purple leading-tight">{profile?.class || 'Siswa'}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-none hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-red text-pixel-lavender hover:text-pixel-red"
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-none border-2 font-retro text-lg ${
                  isActive
                    ? 'bg-pixel-purple/20 text-pixel-purple border-pixel-purple pixel-text-shadow'
                    : 'text-pixel-peach border-transparent hover:bg-pixel-panel-light hover:border-pixel-gray'
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-pixel-panel border-t-4 border-pixel-gray z-50">
        <div className="grid grid-cols-4 h-16 max-w-sm mx-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/student/dashboard' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 ${
                  isActive ? 'text-pixel-purple' : 'text-pixel-lavender'
                }`}
              >
                <div className={`p-1.5 rounded-none ${
                  isActive ? 'bg-pixel-purple/20 border-2 border-pixel-purple scale-110' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-pixel text-[6px] uppercase tracking-wider">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
