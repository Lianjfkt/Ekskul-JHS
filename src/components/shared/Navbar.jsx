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

  return (
    <header className="bg-pixel-panel border-b-4 border-pixel-gray h-16 flex items-center justify-between px-3 sm:px-4 lg:px-8 shrink-0 select-none">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button 
          onClick={() => {
            soundManager.playBlip()
            onMenuClick?.()
          }}
          aria-label="Buka navigasi menu"
          className="p-2 lg:hidden rounded-none text-pixel-peach hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-gray min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors shrink-0"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Desktop Title & Parent Child Selector */}
        <div className="hidden sm:flex items-center gap-2">
          {role === 'parent' ? (
            <div className="flex items-center gap-2">
              <span className="text-pixel-lavender font-retro text-base shrink-0">Data Anak:</span>
              {children.length > 1 ? (
                <Select
                  value={selectedChild?.id || ''}
                  onValueChange={(val) => {
                    const child = children.find(c => c.id === val)
                    if (child) setSelectedChild(child)
                  }}
                >
                  <SelectTrigger className="h-8 border-2 border-pixel-gray bg-pixel-navy font-retro text-base w-[190px] text-pixel-blue rounded-none">
                    <SelectValue placeholder="Pilih Anak" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-pixel-gray bg-pixel-navy">
                    {children.map(c => (
                      <SelectItem key={c.id} value={c.id} className="rounded-none">{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-retro text-lg text-pixel-blue font-bold">{selectedChild?.full_name || '...'}</span>
              )}
            </div>
          ) : (
            <h2 className="font-pixel text-[9px] text-pixel-peach pixel-text-shadow capitalize leading-relaxed">
              {role} Portal
            </h2>
          )}
        </div>

        {/* Mobile Title / Child Selector */}
        <div className="sm:hidden flex items-center min-w-0">
          {role === 'parent' ? (
            children.length > 1 ? (
              <Select
                value={selectedChild?.id || ''}
                onValueChange={(val) => {
                  const child = children.find(c => c.id === val)
                  if (child) setSelectedChild(child)
                }}
              >
                <SelectTrigger className="h-8 border-2 border-pixel-gray bg-pixel-navy font-retro text-sm max-w-[150px] truncate text-pixel-blue rounded-none px-2">
                  <SelectValue placeholder="Pilih Anak" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-pixel-gray bg-pixel-navy">
                  {children.map(c => (
                    <SelectItem key={c.id} value={c.id} className="rounded-none font-retro text-base">{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="font-retro text-base text-pixel-blue truncate max-w-[140px] font-bold">
                {selectedChild?.full_name || 'Anak'}
              </span>
            )
          ) : (
            <span className="font-pixel text-[8px] text-pixel-peach uppercase tracking-wide truncate">
              {role}
            </span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <SoundToggle />
        {(role === 'student' || role === 'parent' || role === 'coach' || role === 'admin') && (
          <NotificationBell />
        )}
        
        <Link 
          to="/profile"
          onClick={() => soundManager.playBlip()}
          aria-label="Profil Pengguna"
          className="hidden sm:flex items-center gap-2 font-retro text-lg text-pixel-peach bg-pixel-navy px-3 py-1.5 border-2 border-pixel-gray hover:border-pixel-blue hover:text-pixel-blue transition-colors cursor-pointer"
        >
          <div className="w-6 h-6 bg-pixel-blue/20 flex items-center justify-center border border-pixel-blue">
            <UserIcon className="w-3.5 h-3.5 text-pixel-blue" />
          </div>
          <span className="max-w-[120px] truncate">{userData?.full_name || fullName || user?.email}</span>
        </Link>
        
        <Button 
          variant="outline" 
          size="sm" 
          aria-label="Logout"
          onClick={() => {
            soundManager.playBlip()
            logout()
          }}
          className="gap-1.5 sm:gap-2 text-pixel-peach hover:text-pixel-red hover:border-pixel-red rounded-none border-2 min-h-[36px] px-2.5 sm:px-3"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline font-retro text-base">Logout</span>
        </Button>
      </div>
    </header>
  )
}
