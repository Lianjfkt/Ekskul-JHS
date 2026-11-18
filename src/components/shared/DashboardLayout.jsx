import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import BottomNavigation from './BottomNavigation'
import { useAuthStore } from '../../stores/authStore'
import { cn } from '@/lib/utils'

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ekskul_sidebar_collapsed') === 'true'
    }
    return false
  })

  const { role } = useAuthStore()

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  // Students and Parents have bottom navigation on mobile
  const hasBottomNav = role === 'student' || role === 'parent'

  return (
    <div className="flex h-screen bg-pixel-navy pixel-bg-grid overflow-hidden">
      {/* Modern Sidebar Navigation */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={setIsCollapsed}
      />

      {/* Backdrop Overlay for mobile when sidebar drawer is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden p-0 lg:p-3 lg:pl-3 gap-0 lg:gap-3">
        <Navbar onMenuClick={toggleSidebar} />
        
        <main className={cn(
          "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-6",
          "lg:rounded-2xl border-0 lg:border-2 border-pixel-gray/40 bg-pixel-panel/30 backdrop-blur-sm shadow-inner pixel-scroll",
          hasBottomNav ? 'pb-24 lg:pb-6' : ''
        )}>
          <div className="mx-auto max-w-7xl h-full">
            {/* The routed components will be rendered here */}
            <Outlet />
          </div>
        </main>
      </div>

      {hasBottomNav && <BottomNavigation />}
    </div>
  )
}
