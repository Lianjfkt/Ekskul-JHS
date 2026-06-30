import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import BottomNavigation from './BottomNavigation'
import { useAuthStore } from '../../stores/authStore'

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { role } = useAuthStore()

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  // Students and Parents have bottom navigation on mobile
  const hasBottomNav = role === 'student' || role === 'parent'

  return (
    <div className="flex h-screen bg-pixel-navy pixel-bg-grid overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} />

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <Navbar onMenuClick={toggleSidebar} />
        
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${hasBottomNav ? 'pb-24 lg:pb-8' : ''}`}>
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
