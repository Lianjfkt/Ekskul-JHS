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
/* Nav menus per role (max 5 items so dock stays balanced on mobile) */
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
    timeoutRef.current = setTimeout(() => setPressedPath(null), 300)
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 flex justify-center items-end px-2 sm:px-4 lg:hidden pointer-events-none transition-all duration-200",
        hasModalOpen ? "opacity-0 translate-y-16 pointer-events-none" : "opacity-100 translate-y-0"
      )}
    >
      {/* 
        Retro Arcade Dock Container:
        - 100% square edges (no pill radius)
        - Heavy 3px solid pixel borders with inset and dropped box-shadow
        - High-contrast, authentic 8-bit aesthetic
      */}
      <nav
        className="pointer-events-auto flex items-center justify-around w-full max-w-lg bg-pixel-panel border-t-4 border-x-4 border-pixel-gray px-1.5 py-1 shadow-pixel-lg"
        style={{
          boxShadow: '0 -4px 0 0 rgba(0,0,0,0.6), inset 0 2px 0 0 rgba(255,255,255,0.12)',
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
              aria-label={item.name}
              className={cn(
                "relative flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-1 min-h-[48px] select-none transition-transform",
                "active:translate-y-0.5",
                isPressed ? "scale-95" : "",
                isActive
                  ? "bg-pixel-navy border-2 border-pixel-blue shadow-pixel-sm text-pixel-blue"
                  : "text-pixel-lavender hover:text-pixel-peach border-2 border-transparent hover:bg-pixel-panel-light"
              )}
            >
              {/* Retro Indicator Dot for Active Tab */}
              {isActive && (
                <span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pixel-yellow border border-pixel-navy animate-pixel-blink"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}

              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-transform",
                  isActive ? "text-pixel-blue scale-105" : "text-pixel-lavender"
                )}
              />

              <span
                className={cn(
                  "truncate w-full text-center mt-0.5 leading-none",
                  isActive
                    ? "font-pixel text-[8px] text-pixel-white tracking-tight"
                    : "font-retro text-xs text-pixel-lavender uppercase"
                )}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
