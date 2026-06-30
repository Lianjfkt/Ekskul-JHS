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
    <div className="min-h-screen bg-pixel-navy pixel-bg-grid">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-pixel-panel border-b-4 border-pixel-gray">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-none bg-pixel-blue border-2 border-pixel-gray flex items-center justify-center shadow-pixel-sm">
              <Shield className="w-4 h-4 text-pixel-white" />
            </div>
            <span className="font-pixel text-[9px] text-pixel-peach hidden sm:block tracking-tight">
              Orang Tua <span className="text-pixel-blue">Portal</span>
            </span>
          </div>

          {/* Child Selector (center) */}
          {!loading && children.length > 0 && (
            <div className="flex-1 max-w-xs relative">
              <button
                onClick={() => setShowChildDropdown(!showChildDropdown)}
                className="w-full flex items-center gap-2 bg-pixel-navy border-2 border-pixel-gray rounded-none px-3 py-2 text-left hover:bg-pixel-panel-light"
              >
                <Users className="w-4 h-4 text-pixel-blue shrink-0" />
                <div className="flex-1 min-w-0 font-retro text-lg">
                  <p className="text-base text-pixel-lavender leading-none">Melihat data:</p>
                  <p className="font-semibold text-pixel-white truncate leading-tight">
                    {selectedChild?.full_name || 'Pilih anak'}
                  </p>
                </div>
                {children.length > 1 && (
                  <ChevronDown className={`w-4 h-4 text-pixel-lavender transition-transform shrink-0 ${showChildDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              {showChildDropdown && children.length > 1 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-pixel-panel border-3 border-pixel-gray rounded-none shadow-pixel z-50 divide-y-2 divide-pixel-gray/25">
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => { setSelectedChild(child); setShowChildDropdown(false) }}
                      className={`w-full text-left px-4 py-3 font-retro text-lg hover:bg-pixel-panel-light ${
                        selectedChild?.id === child.id ? 'bg-pixel-blue/20 font-semibold text-pixel-blue' : 'text-pixel-peach'
                      }`}
                    >
                      <p className="font-medium">{child.full_name}</p>
                      <p className="text-base text-pixel-lavender">{child.class} · NIS: {child.nis}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="relative p-2 rounded-none hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-gray text-pixel-lavender hover:text-pixel-blue">
              <Bell className="w-5 h-5" />
            </button>
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-none border-2 font-retro text-lg ${
                  isActive
                    ? 'bg-pixel-blue/20 text-pixel-blue border-pixel-blue pixel-text-shadow'
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
          <Outlet context={{ selectedChild, children }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-pixel-panel border-t-4 border-pixel-gray z-50">
        <div className="grid grid-cols-4 h-16 max-w-sm mx-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/parent/dashboard' && location.pathname.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 ${
                  isActive ? 'text-pixel-blue' : 'text-pixel-lavender'
                }`}
              >
                <div className={`p-1.5 rounded-none ${isActive ? 'bg-pixel-blue/20 border-2 border-pixel-blue scale-110' : ''}`}>
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
