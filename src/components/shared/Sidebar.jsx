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
  ChevronsLeft,
  ChevronsRight,
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

  // Local collapse state if not controlled from parent
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

  // Define menus based on role
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

  const roleCardMeta = {
    admin: {
      title: 'Admin Portal',
      desc: 'Kelola data & rekapitulasi sekolah',
      tag: 'ADMIN'
    },
    coach: {
      title: 'Pelatih Ekskul',
      desc: 'Jadwal sesi & penilaian siswa',
      tag: 'COACH'
    },
    student: {
      title: 'Portal Siswa',
      desc: 'Pantau aktivitas & capaian ekskul',
      tag: 'SISWA'
    },
    parent: {
      title: 'Portal Wali',
      desc: 'Pantau perkembangan ekskul anak',
      tag: 'ORANG TUA'
    }
  }

  const currentRoleMeta = roleCardMeta[role] || {
    title: 'Ekskul Portal',
    desc: 'Sistem manajemen ekskul',
    tag: 'PORTAL'
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
        // Base positioning & transitions
        "fixed inset-y-0 left-0 z-50 flex flex-col justify-between shrink-0 select-none",
        "bg-gradient-to-b from-pixel-panel via-pixel-panel to-pixel-navy/95",
        "border-2 border-pixel-gray/40 shadow-2xl backdrop-blur-md",
        "transition-all duration-300 ease-in-out",
        // Mobile drawer styling
        isOpen ? "translate-x-0" : "-translate-x-full",
        "w-72 p-4 rounded-r-3xl",
        // Desktop styling (floating rounded card)
        "lg:translate-x-0 lg:static lg:inset-auto lg:my-3 lg:ml-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-3xl",
        isCollapsed ? "lg:w-20 lg:p-3" : "lg:w-64 lg:p-4"
      )}
    >
      {/* Background ambient lighting orbs */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 bg-pixel-blue/15 rounded-full blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 w-32 h-32 bg-pixel-purple/15 rounded-full blur-2xl" />

      {/* Top Header / Logo Section */}
      <div className="relative shrink-0">
        <div className={cn(
          "flex items-center pb-4 border-b-2 border-pixel-gray/30",
          isCollapsed ? "lg:flex-col lg:items-center lg:gap-2 lg:pb-3" : "justify-between"
        )}>
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pixel-blue via-indigo-600 to-pixel-purple flex items-center justify-center shadow-[0_0_15px_rgba(41,173,255,0.4)] shrink-0 group cursor-pointer hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-pixel-white animate-pulse" />
            </div>

            <div className={cn(
              "overflow-hidden transition-all duration-300 whitespace-nowrap",
              isCollapsed ? "lg:w-0 lg:opacity-0 lg:pointer-events-none" : "w-auto opacity-100"
            )}>
              <span className="font-pixel text-[11px] text-pixel-white pixel-text-shadow tracking-wider block">
                EKSKUL <span className="text-pixel-blue">APP</span>
              </span>
              <span className="font-retro text-xs text-pixel-lavender tracking-widest uppercase block">
                JHS Modern Portal
              </span>
            </div>
          </div>

          {/* Desktop Collapse Toggle Button */}
          <button
            onClick={handleToggleCollapse}
            title={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
            className={cn(
              "hidden lg:flex items-center justify-center p-1.5 rounded-xl",
              "text-pixel-lavender hover:text-pixel-white hover:bg-pixel-panel-light/70",
              "border border-transparent hover:border-pixel-gray/50 transition-all duration-200 active:scale-90",
              isCollapsed ? "mt-1 w-8 h-8" : ""
            )}
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4 h-4 text-pixel-blue" />
            ) : (
              <ChevronsLeft className="w-4 h-4 text-pixel-lavender hover:text-pixel-white" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-pixel-peach hover:text-pixel-red hover:bg-pixel-panel-light/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Menu List */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden my-3 space-y-1.5 pr-0.5 pixel-scroll">
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
                "group relative select-none",
                // Collapsed desktop rendering
                isCollapsed ? "lg:flex lg:flex-col lg:items-center lg:justify-center lg:py-1.5 lg:px-0" : "",
                // Expanded / Normal rendering
                !isCollapsed ? cn(
                  "sidebar-link-smooth flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border font-retro text-xl leading-none",
                  isActive
                    ? "bg-gradient-to-r from-pixel-blue/20 via-pixel-purple/15 to-transparent border-pixel-blue/40 text-pixel-blue shadow-sm font-bold"
                    : "text-pixel-lavender border-transparent hover:bg-pixel-panel-light/60 hover:text-pixel-white hover:border-pixel-gray/30"
                ) : ""
              )}
            >
              {/* === EXPANDED VIEW CONTENTS === */}
              <div className={cn(
                "w-full items-center gap-3 flex",
                isCollapsed ? "lg:hidden" : ""
              )}>
                {/* Active vertical pill accent indicator on left */}
                {isActive && (
                  <span className="w-1.5 h-6 bg-pixel-blue rounded-full absolute left-1.5 top-1/2 -translate-y-1/2 shadow-[0_0_8px_#29ADFF] animate-pulse" />
                )}

                <Icon 
                  className={cn(
                    "w-5 h-5 shrink-0 ml-1.5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-pixel-blue" : "text-pixel-lavender group-hover:text-pixel-white"
                  )} 
                />

                <span className={cn(
                  "truncate tracking-wide transition-colors duration-200",
                  isActive ? "text-pixel-white font-bold" : "text-pixel-peach/90 group-hover:text-pixel-white"
                )}>
                  {item.name}
                </span>

                {/* Counter Badge (Expanded) */}
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 rounded-full font-pixel text-[9px] bg-pixel-purple/40 text-pixel-peach border border-pixel-purple/60 shadow-[0_0_8px_rgba(126,37,83,0.4)] animate-pixel-pop shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* === COLLAPSED VIEW CONTENTS (Desktop Only) === */}
              {isCollapsed && (
                <div className="hidden lg:flex flex-col items-center justify-center w-full relative">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 relative group-hover:scale-105",
                    isActive 
                      ? "bg-gradient-to-br from-pixel-blue/25 to-pixel-purple/20 border border-pixel-blue/40 text-pixel-blue shadow-[0_0_15px_rgba(41,173,255,0.25)]" 
                      : "text-pixel-lavender border border-transparent hover:bg-pixel-panel-light/60 hover:text-pixel-white hover:border-pixel-gray/30"
                  )}>
                    <Icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", isActive && "text-pixel-blue")} />

                    {/* Notification dot badge (Collapsed) */}
                    {item.badge && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-pixel-purple border-2 border-pixel-navy shadow-[0_0_6px_#7E2553] animate-pulse" />
                    )}
                  </div>

                  {/* Active Indicator Dot directly underneath icon */}
                  {isActive ? (
                    <span className="w-1.5 h-1.5 bg-pixel-blue rounded-full shadow-[0_0_8px_#29ADFF] mt-1.5 animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 opacity-0 mt-1.5 pointer-events-none" />
                  )}

                  {/* Floating Tooltip on Hover */}
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-pixel-panel/95 backdrop-blur-md border-2 border-pixel-gray/70 rounded-xl shadow-pixel text-pixel-white font-retro text-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 flex items-center gap-2">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[8px] font-pixel bg-pixel-purple text-pixel-white">
                        {item.badge}
                      </span>
                    )}
                    {/* Micro arrow pointer */}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-pixel-panel" />
                  </div>
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="relative shrink-0 pt-2 border-t-2 border-pixel-gray/30">
        {/* === COLLAPSED BOTTOM (Avatar + Status Dot) === */}
        {isCollapsed ? (
          <div className="hidden lg:flex flex-col items-center justify-center py-2">
            <Link
              to="/profile"
              onClick={() => soundManager.playBlip()}
              className="group relative w-12 h-12 rounded-full bg-gradient-to-tr from-pixel-navy to-pixel-panel-light border-2 border-pixel-gray/70 hover:border-pixel-blue flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
              title={`Profil (${currentRoleMeta.title})`}
            >
              <UserIcon className="w-5 h-5 text-pixel-blue group-hover:scale-110 transition-transform" />
              {/* Online indicator dot */}
              <span className="w-3 h-3 bg-pixel-green rounded-full border-2 border-pixel-navy absolute bottom-0 right-0 shadow-[0_0_6px_#00E436] animate-pulse" />

              {/* Tooltip on hover */}
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-pixel-panel/95 backdrop-blur-md border-2 border-pixel-gray/70 rounded-xl shadow-pixel text-pixel-white font-retro text-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 flex items-center gap-2">
                <span>{fullName || user?.email}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-pixel bg-pixel-blue/30 text-pixel-blue border border-pixel-blue/40 uppercase">
                  {currentRoleMeta.tag}
                </span>
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-pixel-panel" />
              </div>
            </Link>
          </div>
        ) : null}

        {/* === EXPANDED BOTTOM CARD (Role / Upgrade-Style Card) === */}
        <div className={cn(
          "transition-all duration-300",
          isCollapsed ? "lg:hidden" : "block"
        )}>
          <div className="rounded-2xl bg-gradient-to-br from-pixel-panel-light/90 via-pixel-panel to-pixel-navy/95 border-2 border-pixel-gray/40 p-3.5 relative overflow-hidden shadow-pixel-sm">
            {/* Background glowing gradient orbs */}
            <div className="pointer-events-none absolute -right-6 -bottom-6 w-20 h-20 bg-pixel-blue/20 rounded-full blur-xl" />
            <div className="pointer-events-none absolute -left-6 -top-6 w-16 h-16 bg-pixel-purple/20 rounded-full blur-xl" />

            {/* Glowing 3D-styled / pixel crystal icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pixel-blue via-indigo-600 to-pixel-purple flex items-center justify-center text-pixel-white shadow-md mb-2 relative group">
              <Sparkles className="w-4 h-4 text-pixel-white animate-pulse" />
            </div>

            <p className="font-pixel text-[9px] text-pixel-white tracking-wider uppercase leading-snug">
              {currentRoleMeta.title}
            </p>
            <p className="font-retro text-base text-pixel-lavender leading-tight mt-0.5 mb-3 line-clamp-2">
              {currentRoleMeta.desc}
            </p>

            {/* Pill action button */}
            <Link
              to="/profile"
              onClick={() => {
                soundManager.playBlip()
                onClose?.()
              }}
              className="sidebar-link-smooth w-full py-2 px-3 rounded-full bg-pixel-white text-pixel-navy hover:bg-pixel-blue hover:text-white font-retro text-lg font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-sm active:scale-95 group"
            >
              <span>Profil Saya</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Decorative indicator dots like in the image bottom */}
          <div className="flex justify-center gap-1.5 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-pixel-blue shadow-[0_0_4px_#29ADFF]" />
            <span className="w-1.5 h-1.5 rounded-full bg-pixel-purple/50" />
            <span className="w-1.5 h-1.5 rounded-full bg-pixel-lavender/40" />
            <span className="w-1.5 h-1.5 rounded-full bg-pixel-lavender/20" />
          </div>
        </div>
      </div>
    </aside>
  )
}
