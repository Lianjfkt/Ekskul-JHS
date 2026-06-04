import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useParentChildren } from '../../hooks/useParentChildren'
import { 
  LayoutDashboard, Activity, ClipboardCheck, GraduationCap,
  Bell, LogOut, Shield, ChevronDown, Users
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { name: 'Beranda', path: '/parent/dashboard', icon: LayoutDashboard },
  { name: 'Ekskul Anak', path: '/parent/extracurriculars', icon: Activity },
  { name: 'Kehadiran', path: '/parent/attendance', icon: ClipboardCheck },
  { name: 'Nilai', path: '/parent/grades', icon: GraduationCap },
]

export default function ParentLayout() {
  const { logout } = useAuthStore()
  const { children, selectedChild, setSelectedChild, loading } = useParentChildren()
  const location = useLocation()
  const [showChildDropdown, setShowChildDropdown] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-sky-50">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-blue-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 hidden sm:block text-sm tracking-tight">
              Orang Tua <span className="text-blue-600">Portal</span>
            </span>
          </div>

          {/* Child Selector (center) */}
          {!loading && children.length > 0 && (
            <div className="flex-1 max-w-xs relative">
              <button
                onClick={() => setShowChildDropdown(!showChildDropdown)}
                className="w-full flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-left hover:bg-blue-100 transition-colors"
              >
                <Users className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-400 leading-none">Anda melihat data:</p>
                  <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                    {selectedChild?.full_name || 'Pilih anak'}
                  </p>
                </div>
                {children.length > 1 && (
                  <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform shrink-0 ${showChildDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              {showChildDropdown && children.length > 1 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden z-50">
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => { setSelectedChild(child); setShowChildDropdown(false) }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                        selectedChild?.id === child.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      <p className="font-medium">{child.full_name}</p>
                      <p className="text-xs text-slate-500">{child.class} · NIS: {child.nis}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="relative p-2 rounded-xl hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
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
      <div className="flex max-w-6xl mx-auto" onClick={() => setShowChildDropdown(false)}>
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 sticky top-16 h-[calc(100vh-4rem)] p-4 gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/parent/dashboard' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
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
          <Outlet context={{ selectedChild, children }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-blue-100 shadow-lg z-50">
        <div className="grid grid-cols-4 h-16 max-w-sm mx-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/parent/dashboard' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-100 scale-110' : ''}`}>
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
