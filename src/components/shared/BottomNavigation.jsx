import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { soundManager } from '../../utils/soundEffects'
import {
  LayoutDashboard,
  Activity,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Users,
  BookOpen,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Nav menus per role (max 5 items so the pill stays compact on mobile) */
/* ------------------------------------------------------------------ */
const MENUS = {
  admin: [
    { name: 'Dashboard',  path: '/admin/dashboard',        icon: LayoutDashboard },
    { name: 'Users',      path: '/admin/users',            icon: Users },
    { name: 'Ekskul',     path: '/admin/extracurriculars', icon: Activity },
    { name: 'Daftar',     path: '/admin/enrollments',      icon: BookOpen },
    { name: 'Rekap',      path: '/admin/recap',            icon: FileSpreadsheet },
  ],
  coach: [
    { name: 'Dashboard',  path: '/coach/dashboard',        icon: LayoutDashboard },
    { name: 'Jadwal',     path: '/coach/sessions',         icon: CalendarDays },
    { name: 'Absensi',    path: '/coach/attendances',      icon: ClipboardCheck },
    { name: 'Nilai',      path: '/coach/grades',           icon: GraduationCap },
  ],
  student: [
    { name: 'Beranda',    path: '/student/dashboard',        icon: LayoutDashboard },
    { name: 'Ekskul',     path: '/student/extracurriculars', icon: Activity },
    { name: 'Kehadiran',  path: '/student/attendance',       icon: ClipboardCheck },
    { name: 'Nilai',      path: '/student/grades',           icon: GraduationCap },
  ],
  parent: [
    { name: 'Beranda',    path: '/parent/dashboard',         icon: LayoutDashboard },
    { name: 'Ekskul',     path: '/parent/extracurriculars',  icon: Activity },
    { name: 'Kehadiran',  path: '/parent/attendance',        icon: ClipboardCheck },
    { name: 'Nilai',      path: '/parent/grades',            icon: GraduationCap },
  ],
}

export default function BottomNavigation() {
  const { role } = useAuthStore()
  const location = useLocation()
  const [pressedPath, setPressedPath] = useState(null)
  const [hasModalOpen, setHasModalOpen] = useState(false)
  const timeoutRef = useRef(null)

  // Automatically hide floating nav when any modal or dialog is open in the DOM
  useEffect(() => {
    const checkModal = () => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[60\\], .fixed.inset-0.z-60, [data-modal="true"], [role="dialog"]')
      setHasModalOpen(!!modal)
    }

    const observer = new MutationObserver(checkModal)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    checkModal()

    return () => observer.disconnect()
  }, [])

  const currentMenu = MENUS[role] || []
  if (!currentMenu.length) return null

  const handlePress = (path) => {
    soundManager.playBlip()
    setPressedPath(path)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setPressedPath(null), 350)
  }

  return (
    /*
     * Wrapper: full-width, transparent, pointer-events-none so taps on
     * the transparent area pass through to content underneath.
     */
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-30 flex justify-center items-end pb-4 px-3 lg:hidden pointer-events-none transition-all duration-200",
      hasModalOpen ? "opacity-0 translate-y-12 pointer-events-none" : "opacity-100 translate-y-0"
    )}>
      {/*
       * The floating pill container — styled faithfully like Picture 2:
       *   • Dark pill container
       *   • Heavy pixel border and shadow
       *   • Active item expands into a white sub-pill with icon + label
       *   • Inactive items are icons only
       */}
      <nav
        className="pointer-events-auto pill-nav-enter flex items-center gap-1 p-1.5"
        style={{
          background: '#121829',          /* dark pixel-navy */
          border: '3px solid #5F574F',    /* pixel-gray */
          boxShadow: '4px 4px 0 0 rgba(0,0,0,0.65)',
          borderRadius: '9999px',
        }}
      >
        {currentMenu.map((item) => {
          const isActive = item.path.includes('dashboard')
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path)
          const isPressed = pressedPath === item.path
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => handlePress(item.path)}
              className={cn(
                'relative flex items-center select-none active:scale-95 transition-transform',
                isPressed ? 'pill-nav-active-pop' : '',
              )}
              style={{ borderRadius: '9999px' }}
            >
              {isActive ? (
                /*
                 * ACTIVE sub-pill — white background with dark icon + label,
                 * exactly as shown in Picture 2 ("Icons only. The active tab shows its label.")
                 */
                <span
                  className="flex items-center gap-2 px-3.5 py-2 shadow-sm"
                  style={{
                    background: '#FFF1E8',   /* pixel-white */
                    border: '2px solid #1D2B53',
                    borderRadius: '9999px',
                  }}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0 text-pixel-black" />

                  {/* Label slides in smoothly */}
                  <span
                    className="font-pixel text-[8px] text-pixel-black uppercase tracking-wider leading-none pill-nav-label-slide"
                  >
                    {item.name}
                  </span>

                  {/* Blinking retro indicator dot above */}
                  <span
                    className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] bg-pixel-yellow border border-pixel-black animate-pixel-blink"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </span>
              ) : (
                /*
                 * INACTIVE item — icon only, tap expands it
                 */
                <span
                  className="flex items-center justify-center w-10 h-10 hover:bg-white/10 active:bg-white/20 transition-colors"
                  style={{ borderRadius: '9999px' }}
                >
                  <Icon className="w-[19px] h-[19px] text-pixel-lavender" />
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
