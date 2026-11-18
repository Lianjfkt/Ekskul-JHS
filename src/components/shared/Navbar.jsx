import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, LogOut, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useParentChildren } from '../../hooks/useParentChildren'
import NotificationBell from './NotificationBell'
import SoundToggle from './SoundToggle'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from '../../lib/supabaseClient'
import { soundManager } from '../../utils/soundEffects'
import { cn } from '@/lib/utils'

export default function Navbar({ onMenuClick }) {
  const { user, role, fullName, studentId, logout } = useAuthStore()
  const { children, selectedChild, setSelectedChild, fetchChildren } = useParentChildren()
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    if (user && role === 'parent') {
      const activeName = fullName || userData?.full_name
      if (activeName) {
        fetchChildren(user.id, activeName, studentId)
      } else {
        const fetchUserData = async () => {
          const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
          setUserData(data)
          if (data) {
            fetchChildren(user.id, data.full_name, data.student_id)
          }
        }
        fetchUserData()
      }
    } else if (user && !fullName && !userData) {
      const fetchUserData = async () => {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        setUserData(data)
      }
      fetchUserData()
    }
  }, [user, role, fullName, studentId, userData, fetchChildren])

  const roleDisplayName = {
    admin: 'Admin Portal',
    coach: 'Pelatih Portal',
    student: 'Siswa Portal',
    parent: 'Orang Tua Portal'
  }[role] || `${role} Portal`

  return (
    <header className={cn(
      "h-16 flex items-center justify-between px-4 lg:px-6 shrink-0 z-30 select-none",
      "bg-gradient-to-r from-pixel-panel via-pixel-panel to-pixel-navy/95",
      "border-2 border-pixel-gray/40 shadow-pixel-sm backdrop-blur-md",
      "transition-all duration-300",
      "lg:rounded-2xl"
    )}>
      {/* Left side: Hamburger (Mobile) + Title / Child Selector */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => {
            soundManager.playBlip()
            onMenuClick?.()
          }}
          className="p-2 -ml-1 rounded-xl lg:hidden text-pixel-peach hover:text-pixel-white hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-gray/50 transition-colors active:scale-95"
          title="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          {/* Glowing pulse indicator dot */}
          <span className="w-2.5 h-2.5 rounded-full bg-pixel-blue shadow-[0_0_8px_#29ADFF] animate-pulse hidden sm:block" />

          <h2 className="font-pixel text-[10px] text-pixel-peach pixel-text-shadow capitalize hidden sm:block leading-relaxed">
            {role === 'parent' ? (
              <div className="flex items-center gap-2">
                <span className="text-pixel-lavender font-retro text-lg">Melihat Data:</span>
                {children.length > 1 ? (
                  <Select
                    value={selectedChild?.id || ''}
                    onValueChange={(val) => {
                      const child = children.find(c => c.id === val)
                      if (child) setSelectedChild(child)
                    }}
                  >
                    <SelectTrigger className="h-8 border-2 border-pixel-gray/60 bg-pixel-navy rounded-xl font-retro text-base w-[180px] text-pixel-blue hover:border-pixel-blue transition-colors">
                      <SelectValue placeholder="Pilih Anak" />
                    </SelectTrigger>
                    <SelectContent className="bg-pixel-navy border-2 border-pixel-gray/60 rounded-xl">
                      {children.map(c => (
                        <SelectItem key={c.id} value={c.id} className="font-retro text-base hover:bg-pixel-panel-light">{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-retro text-xl text-pixel-blue font-bold">{selectedChild?.full_name || '...'}</span>
                )}
              </div>
            ) : (
              <span className="tracking-wider">{roleDisplayName}</span>
            )}
          </h2>
        </div>

        {/* Mobile Title for Parent */}
        <div className="sm:hidden flex items-center h-full">
          {role === 'parent' && children.length > 1 ? (
            <Select
              value={selectedChild?.id || ''}
              onValueChange={(val) => {
                const child = children.find(c => c.id === val)
                if (child) setSelectedChild(child)
              }}
            >
              <SelectTrigger className="h-8 border-2 border-pixel-gray/60 bg-pixel-navy rounded-xl font-retro text-base max-w-[140px] truncate text-pixel-blue">
                <SelectValue placeholder="Pilih Anak" />
              </SelectTrigger>
              <SelectContent className="bg-pixel-navy border-2 border-pixel-gray/60 rounded-xl">
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id} className="font-retro text-base">{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : role === 'parent' ? (
             <span className="font-retro text-lg text-pixel-blue truncate max-w-[150px]">{selectedChild?.full_name || '...'}</span>
          ) : (
            <span className="font-pixel text-[9px] text-pixel-peach truncate">{roleDisplayName}</span>
          )}
        </div>
      </div>

      {/* Right side: Sound Toggle, Notifications, Profile Chip, Logout */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <SoundToggle className="rounded-xl border border-transparent hover:border-pixel-gray/40 hover:bg-pixel-panel-light/60 transition-all" />

        {(role === 'student' || role === 'parent' || role === 'coach' || role === 'admin') && (
          <NotificationBell />
        )}
        
        {/* User Profile Pill */}
        <Link 
          to="/profile"
          onClick={() => soundManager.playBlip()}
          className="hidden sm:flex items-center gap-2.5 font-retro text-lg text-pixel-peach bg-pixel-navy/80 hover:bg-pixel-navy px-3 py-1.5 rounded-xl border-2 border-pixel-gray/60 hover:border-pixel-blue hover:text-pixel-blue transition-all cursor-pointer group shadow-sm active:scale-95"
          title="Buka Profil"
        >
          <div className="w-6 h-6 rounded-lg bg-pixel-blue/20 flex items-center justify-center border border-pixel-blue/60 group-hover:scale-105 transition-transform">
            <UserIcon className="w-3.5 h-3.5 text-pixel-blue" />
          </div>
          <span className="max-w-[120px] truncate">{userData?.full_name || fullName || user?.email}</span>
        </Link>
        
        {/* Logout Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            soundManager.playBlip()
            logout()
          }}
          className="gap-2 rounded-xl border-2 border-pixel-gray/60 text-pixel-peach hover:text-pixel-red hover:border-pixel-red hover:bg-pixel-red/10 active:scale-95 transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline font-retro text-lg">Logout</span>
        </Button>
      </div>
    </header>
  )
}
