import { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { soundManager } from '../../utils/soundEffects'
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
  const [pressedPath, setPressedPath] = useState(null)
  const timeoutRef = useRef(null)

  // Only show for student and parent
  if (role !== 'student' && role !== 'parent') return null

  const menus = {
    student: [
      { name: 'Beranda',   path: '/student/dashboard',        icon: LayoutDashboard },
      { name: 'Ekskul',    path: '/student/extracurriculars', icon: Activity },
      { name: 'Kehadiran', path: '/student/attendance',       icon: ClipboardCheck },
      { name: 'Nilai',     path: '/student/grades',           icon: GraduationCap },
    ],
    parent: [
      { name: 'Beranda',   path: '/parent/dashboard',         icon: LayoutDashboard },
      { name: 'Ekskul',    path: '/parent/extracurriculars',  icon: Activity },
      { name: 'Kehadiran', path: '/parent/attendance',        icon: ClipboardCheck },
      { name: 'Nilai',     path: '/parent/grades',            icon: GraduationCap },
    ],
  }

  const currentMenu = menus[role] || []

  const handlePress = (path) => {
    soundManager.playBlip()
    setPressedPath(path)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setPressedPath(null), 350)
  }

  return (
    /* Outer container: positioned at bottom, full width, transparent */
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4 lg:hidden pointer-events-none">
      {/* The floating pill container */}
      <nav
        className={cn(
          "pointer-events-auto pill-nav-enter",
          "flex items-center gap-1 px-2 py-2",
          // Pixel-art pill shape: thick borders, shadow, background
          "bg-pixel-panel border-4 border-pixel-gray",
          "shadow-[6px_6px_0_0_rgba(0,0,0,0.6)]",
          // We use a large border-radius to get the pill look
          // while keeping square inner elements for pixel feel
          "rounded-full",
        )}
        style={{ borderRadius: '999px' }}
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
                "relative flex items-center gap-2 select-none",
                "transition-none", // animations handled via CSS classes, not Tailwind transition
                // Active pill item: filled background
                isActive
                  ? cn(
                      "bg-pixel-blue border-2 border-pixel-navy px-4 py-2",
                      "shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]",
                      "pixel-glow-pulse",
                    )
                  : cn(
                      "px-3.5 py-2.5 border-2 border-transparent",
                      "hover:bg-pixel-panel-light hover:border-pixel-gray",
                      "active:translate-x-0.5 active:translate-y-0.5",
                    ),
                "rounded-full",
                // Active pop animation when tapped
                isPressed ? "pill-nav-active-pop" : "",
              )}
              style={{ borderRadius: '999px' }}
            >
              {/* Icon */}
              <Icon
                className={cn(
                  "shrink-0",
                  isActive ? "w-5 h-5 text-pixel-navy" : "w-5 h-5 text-pixel-lavender",
                  !isActive && "group-hover:text-pixel-peach",
                )}
              />

              {/* Label — only shown when active, slides in */}
              {isActive && (
                <span
                  className={cn(
                    "font-pixel text-[8px] text-pixel-navy uppercase tracking-wider leading-none",
                    "pill-nav-label-slide",
                  )}
                >
                  {item.name}
                </span>
              )}

              {/* Pixel square dot above active icon (retro indicator) */}
              {isActive && (
                <span
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pixel-yellow border border-pixel-navy animate-pixel-blink"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Pixel art 8-bit shadow strip at bottom edge */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 bg-pixel-gray/40 pointer-events-none"
        style={{ width: 'calc(100% - 32px)', borderRadius: '0 0 2px 2px' }}
      />
    </div>
  )
}
