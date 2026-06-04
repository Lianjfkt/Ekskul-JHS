import { useEffect } from 'react'
import { Menu, LogOut, User as UserIcon, Bell, Sun, Moon } from 'lucide-react'
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
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

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
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 lg:px-8 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 mr-2 lg:hidden rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 capitalize hidden sm:block">
          {role === 'parent' ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 text-sm font-normal">Anda melihat data:</span>
              {children.length > 1 ? (
                <Select
                  value={selectedChild?.id || ''}
                  onValueChange={(val) => {
                    const child = children.find(c => c.id === val)
                    if (child) setSelectedChild(child)
                  }}
                >
                  <SelectTrigger className="h-8 border-none bg-slate-50 dark:bg-slate-800 font-semibold shadow-none focus:ring-0 w-[180px] text-slate-800 dark:text-slate-100">
                    <SelectValue placeholder="Pilih Anak" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-semibold text-violet-600 dark:text-violet-400">{selectedChild?.full_name || '...'}</span>
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
              <SelectTrigger className="h-8 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs shadow-none focus:ring-0 max-w-[140px] truncate text-slate-800 dark:text-slate-100">
                <SelectValue placeholder="Pilih Anak" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : role === 'parent' ? (
             <span className="font-semibold text-violet-600 dark:text-violet-400 text-sm truncate max-w-[150px]">{selectedChild?.full_name || '...'}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {(role === 'student' || role === 'parent') && (
          <button className="p-2 relative text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Ubah Tema"
        >
          {theme === 'light' ? <Moon className="w-5.5 h-5.5" /> : <Sun className="w-5.5 h-5.5 text-amber-500" />}
        </Button>
        
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700">
          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
            <UserIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-medium text-xs max-w-[120px] truncate">{userData?.full_name || user?.email}</span>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className="gap-2 text-slate-600 dark:text-slate-300 hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 border-slate-200 dark:border-slate-700"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  )
}
