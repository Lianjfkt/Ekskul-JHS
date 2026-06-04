import { useEffect } from 'react'
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
    }
  }, [user, role, fetchChildren])

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 mr-2 lg:hidden rounded-md hover:bg-slate-100 text-slate-600"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 capitalize hidden sm:block">
          {role === 'parent' ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm font-normal">Anda melihat data:</span>
              {children.length > 1 ? (
                <Select
                  value={selectedChild?.id || ''}
                  onValueChange={(val) => {
                    const child = children.find(c => c.id === val)
                    if (child) setSelectedChild(child)
                  }}
                >
                  <SelectTrigger className="h-8 border-none bg-slate-50 font-semibold shadow-none focus:ring-0 w-[180px]">
                    <SelectValue placeholder="Pilih Anak" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-semibold text-violet-600">{selectedChild?.full_name || '...'}</span>
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
              <SelectTrigger className="h-8 border-slate-200 bg-white font-semibold text-xs shadow-none focus:ring-0 max-w-[140px] truncate">
                <SelectValue placeholder="Pilih Anak" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : role === 'parent' ? (
             <span className="font-semibold text-violet-600 text-sm truncate max-w-[150px]">{selectedChild?.full_name || '...'}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {(role === 'student' || role === 'parent') && (
          <button className="p-2 relative text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
        )}
        
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
            <UserIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-medium text-xs max-w-[120px] truncate">{userData?.full_name || user?.email}</span>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className="gap-2 text-slate-600 hover:text-destructive hover:bg-destructive/10 border-slate-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  )
}
