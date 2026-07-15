import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, LogOut, User as UserIcon, Bell } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useParentChildren } from '../../hooks/useParentChildren'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from '../../lib/supabaseClient'
import { useState } from 'react'

export default function Navbar({ onMenuClick }) {
  const { user, role, logout } = useAuthStore()
  const { children, selectedChild, setSelectedChild, fetchChildren } = useParentChildren()
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    if (user && role === 'parent') {
      const fetchUserData = async () => {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        setUserData(data)
        if (data) {
          fetchChildren(user.id, data.full_name, data.student_id)
        }
      }
      fetchUserData()
    } else if (user) {
      const fetchUserData = async () => {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        setUserData(data)
      }
      fetchUserData()
    }
  }, [user, role, fetchChildren])

  return (
    <header className="bg-pixel-panel border-b-4 border-pixel-gray h-16 flex items-center justify-between px-4 lg:px-8 shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 mr-2 lg:hidden rounded-none text-pixel-peach hover:bg-pixel-panel-light border-2 border-transparent hover:border-pixel-gray"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="font-pixel text-[9px] text-pixel-peach pixel-text-shadow capitalize hidden sm:block leading-relaxed">
          {role === 'parent' ? (
            <div className="flex items-center gap-2">
              <span className="text-pixel-lavender font-retro text-base">Data:</span>
              {children.length > 1 ? (
                <Select
                  value={selectedChild?.id || ''}
                  onValueChange={(val) => {
                    const child = children.find(c => c.id === val)
                    if (child) setSelectedChild(child)
                  }}
                >
                  <SelectTrigger className="h-8 border-2 border-pixel-gray bg-pixel-navy font-retro text-base w-[180px] text-pixel-blue">
                    <SelectValue placeholder="Pilih Anak" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-retro text-lg text-pixel-blue">{selectedChild?.full_name || '...'}</span>
              )}
            </div>
          ) : (
            `${role} Portal`
          )}
        </h2>
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
              <SelectTrigger className="h-8 border-2 border-pixel-gray bg-pixel-navy font-retro text-sm max-w-[140px] truncate text-pixel-blue">
                <SelectValue placeholder="Pilih Anak" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : role === 'parent' ? (
             <span className="font-retro text-lg text-pixel-blue truncate max-w-[150px]">{selectedChild?.full_name || '...'}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {(role === 'student' || role === 'parent') && (
          <button className="p-2 relative text-pixel-lavender hover:text-pixel-yellow rounded-none border-2 border-transparent hover:border-pixel-gray hover:bg-pixel-panel-light">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-pixel-red"></span>
          </button>
        )}
        
        <Link 
          to="/profile"
          className="hidden sm:flex items-center gap-2 font-retro text-lg text-pixel-peach bg-pixel-navy px-3 py-1.5 border-2 border-pixel-gray hover:border-pixel-blue hover:text-pixel-blue transition-colors cursor-pointer"
        >
          <div className="w-6 h-6 bg-pixel-blue/20 flex items-center justify-center border border-pixel-blue">
            <UserIcon className="w-3.5 h-3.5 text-pixel-blue" />
          </div>
          <span className="max-w-[120px] truncate">{userData?.full_name || user?.email}</span>
        </Link>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className="gap-2 text-pixel-peach hover:text-pixel-red hover:border-pixel-red"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline font-retro text-base">Logout</span>
        </Button>
      </div>
    </header>
  )
}
