import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { soundManager } from '../../utils/soundEffects'
import { supabase } from '../../lib/supabaseClient'
import { 
  LayoutDashboard, 
  Activity, 
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Users,
  BookOpen,
  FileSpreadsheet,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  User as UserIcon,
  ArrowRight,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Sidebar({ 
  isOpen, 
  onClose,
  isCollapsed: propIsCollapsed,
  onToggleCollapse
}) {
  const { user, role, fullName } = useAuthStore()
  const location = useLocation()

  // Collapse state (desktop)
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ekskul_sidebar_collapsed') === 'true'
    }
    return false
  })

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed

  const handleToggleCollapse = () => {
    const next = !isCollapsed
    setInternalCollapsed(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekskul_sidebar_collapsed', String(next))
    }
    onToggleCollapse?.(next)
    soundManager.playBlip()
  }

  // Pending enrollments count for admin badge
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user || role !== 'admin') return

    const fetchPending = async () => {
      try {
        const { count, error } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!error && typeof count === 'number') {
          setPendingCount(count)
        }
      } catch (err) {
        console.error('Failed to fetch pending enrollments count:', err)
      }
    }

    fetchPending()

    const channel = supabase
      .channel('sidebar-enrollments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'enrollments' },
        () => {
          fetchPending()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, role])

  // Menus per role
  const menus = {
    admin: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Users', path: '/admin/users', icon: Users },
      { name: 'Ekskul', path: '/admin/extracurriculars', icon: Activity },
      { name: 'Pendaftaran', path: '/admin/enrollments', icon: BookOpen, badge: pendingCount > 0 ? pendingCount : null },
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

  const roleMeta = {
    admin: {
      title: 'ADMIN PORTAL',
      desc: 'Kelola data & rekapitulasi',
    },
    coach: {
      title: 'PELATIH EKSKUL',
      desc: 'Sesi & penilaian aktif',
    },
    student: {
      title: 'PORTAL SISWA',
      desc: 'Aktivitas & nilai ekskul',
    },
    parent: {
      title: 'PORTAL ORANG TUA',
      desc: 'Monitoring ekskul anak',
    }
  }

  const currentRoleMeta = roleMeta[role] || {
    title: 'EKSKUL PORTAL',
    desc: 'Sistem manajemen ekskul',
  }

  const checkIsActive = (path) => {
    if (path.includes('dashboard')) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-pixel-panel border-r-4 border-pixel-gray select-none",
        "transition-[width,transform] duration-200 ease-in-out",
        // Mobile drawer state
        isOpen ? "translate-x-0" : "-translate-x-full",
        "w-64",
        // Desktop docked state
        "lg:translate-x-0 lg:static lg:inset-auto h-screen shrink-0 relative",
        isCollapsed ? "lg:w-20" : "lg:w-64"
      )}
    >
      {/* Top Section / Header */}
      <div className="shrink-0 relative">
        {/* Header Bar */}
        <div className={cn(
          "flex items-center h-16 bg-pixel-navy border-b-4 border-pixel-gray px-3 transition-all",
          isCollapsed ? "lg:justify-center" : "justify-between"
        )}>
          {/* Logo Brand & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo Ekskul JHS */}
            <div className="w-9 h-9 bg-white border-2 border-pixel-gray flex items-center justify-center shrink-0 shadow-pixel-sm p-0.5">
              <img 
                src="/logo.png" 
                alt="Logo Ekskul JHS" 
                className="w-full h-full object-contain"
              />
            </div>

            {/* Title (Hidden in Collapsed on Desktop) */}
            <div className={cn(
              "overflow-hidden transition-all duration-200 whitespace-nowrap",
              isCollapsed ? "lg:hidden" : "block"
            )}>
              <span className="font-pixel text-[10px] text-pixel-blue pixel-text-shadow tracking-wider block leading-tight">
                EKSKUL <span className="text-pixel-white">APP</span>
              </span>
              <span className="font-retro text-xs text-pixel-lavender tracking-wide block truncate">
                SMP Global Madani
              </span>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            aria-label="Tutup Menu"
            className="lg:hidden p-1.5 text-pixel-peach hover:text-pixel-red hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-gray transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 
          Desktop Toggle Button: 
          1 Tombol Tunggal untuk < dan > (Collapse & Expand)
          Diposisikan tepat di border samping header sehingga rapi,
          tidak menumpuk/bertabrakan dengan logo di mode collapsed,
          dan tidak memakan baris menu vertikal.
        */}
        <button
          onClick={handleToggleCollapse}
          title={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
          aria-label={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
          className="hidden lg:flex items-center justify-center absolute -right-3.5 top-4.5 w-7 h-7 bg-pixel-panel hover:bg-pixel-panel-light border-2 border-pixel-gray text-pixel-blue hover:text-pixel-yellow shadow-pixel-sm z-40 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5 pixel-scroll">
        {currentMenu.map((item) => {
          const isActive = checkIsActive(item.path)
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                soundManager.playBlip()
                onClose?.()
              }}
              className={cn(
                "group relative select-none block active:translate-x-0.5 active:translate-y-0.5",
                isCollapsed ? "lg:flex lg:flex-col lg:items-center lg:justify-center lg:py-1" : ""
              )}
            >
              {/* === EXPANDED VIEW === */}
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 border-2 font-retro text-lg transition-colors",
                isCollapsed ? "lg:hidden" : "",
                isActive 
                  ? "bg-pixel-blue/20 text-pixel-blue border-pixel-blue pixel-text-shadow font-bold" 
                  : "text-pixel-peach border-transparent hover:bg-pixel-panel-light hover:border-pixel-gray hover:text-pixel-white"
              )}>
                {/* Retro Pointer Arrow ▶ */}
                <span className={cn(
                  "font-pixel text-[8px] text-pixel-yellow shrink-0",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 animate-pixel-blink"
                )}>
                  ▶
                </span>

                <Icon className={cn("w-5 h-5 shrink-0 group-hover:scale-110", isActive && "text-pixel-blue")} />
                
                <span className="truncate">{item.name}</span>

                {/* Badge (Expanded) */}
                {item.badge && (
                  <span className="ml-auto font-pixel text-[8px] bg-pixel-purple text-pixel-white px-2 py-0.5 border border-pixel-gray shadow-pixel-sm shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* === COLLAPSED VIEW (Desktop) === */}
              {isCollapsed && (
                <div className="hidden lg:flex flex-col items-center justify-center w-full relative">
                  <div className={cn(
                    "w-11 h-11 border-2 flex items-center justify-center relative transition-colors shadow-pixel-sm",
                    isActive
                      ? "bg-pixel-blue/20 border-pixel-blue text-pixel-blue"
                      : "bg-pixel-navy border-pixel-gray hover:border-pixel-blue text-pixel-peach hover:text-pixel-white"
                  )}>
                    <Icon className="w-5 h-5 shrink-0 group-hover:scale-110" />

                    {/* Dot Badge (Collapsed) */}
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pixel-red border border-pixel-navy animate-pixel-blink" />
                    )}
                  </div>

                  {/* Pixel Indicator Dot directly underneath active icon */}
                  {isActive ? (
                    <span className="w-2 h-2 bg-pixel-blue mt-1 shadow-pixel-sm animate-pixel-blink" />
                  ) : (
                    <span className="w-2 h-2 opacity-0 mt-1 pointer-events-none" />
                  )}

                  {/* Retro Pixel Tooltip on Hover */}
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-pixel-panel border-2 border-pixel-gray shadow-pixel text-pixel-peach font-retro text-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 flex items-center gap-2">
                    <span className="text-pixel-yellow font-pixel text-[8px]">▶</span>
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="font-pixel text-[8px] bg-pixel-purple text-pixel-white px-1.5 py-0.5 border border-pixel-gray">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="shrink-0 p-3 border-t-4 border-pixel-gray bg-pixel-panel">
        {/* === COLLAPSED BOTTOM (Pixel Avatar) === */}
        {isCollapsed ? (
          <div className="hidden lg:flex flex-col items-center justify-center">
            <Link
              to="/profile"
              onClick={() => soundManager.playBlip()}
              className="w-11 h-11 bg-pixel-navy border-2 border-pixel-gray hover:border-pixel-blue flex items-center justify-center relative shadow-pixel-sm cursor-pointer group active:translate-x-0.5 active:translate-y-0.5"
              title={`Profil: ${fullName || user?.email}`}
            >
              <UserIcon className="w-5 h-5 text-pixel-blue" />
              {/* Green online pixel indicator */}
              <span className="w-2.5 h-2.5 bg-pixel-green border border-pixel-navy absolute -bottom-0.5 -right-0.5 animate-pixel-blink" />

              {/* Tooltip on hover */}
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-pixel-panel border-2 border-pixel-gray shadow-pixel text-pixel-peach font-retro text-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 flex items-center gap-2">
                <span className="text-pixel-yellow font-pixel text-[8px]">▶</span>
                <span>{fullName || user?.email}</span>
              </div>
            </Link>
          </div>
        ) : (
          /* === EXPANDED BOTTOM (Pixel Info Box + Bouncing Cubes) === */
          <div>
            <div className="p-2.5 bg-pixel-navy border-2 border-pixel-gray shadow-pixel-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 bg-pixel-purple border border-pixel-gray flex items-center justify-center shadow-pixel-sm">
                  <Sparkles className="w-3.5 h-3.5 text-pixel-white" />
                </div>
                <span className="font-pixel text-[8px] text-pixel-blue pixel-text-shadow">
                  {currentRoleMeta.title}
                </span>
              </div>
              <p className="font-retro text-base text-pixel-lavender leading-tight mb-2 truncate">
                {currentRoleMeta.desc}
              </p>
              <Link
                to="/profile"
                onClick={() => {
                  soundManager.playBlip()
                  onClose?.()
                }}
                className="pixel-btn text-[8px] bg-pixel-panel hover:bg-pixel-panel-light text-pixel-peach border-2 border-pixel-gray py-1 px-2 w-full flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>PROFIL SAYA</span>
                <ArrowRight className="w-3.5 h-3.5 text-pixel-yellow" />
              </Link>
            </div>

            {/* Decorative bouncing pixel art squares at the bottom */}
            <div className="flex justify-center gap-1 mt-3">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-2 h-2 bg-pixel-lavender/30 animate-pixel-bounce"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
