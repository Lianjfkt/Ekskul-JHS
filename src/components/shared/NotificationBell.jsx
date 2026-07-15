import { useState, useEffect } from 'react'
import { Bell, Check, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../stores/authStore'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

export default function NotificationBell() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  
  useEffect(() => {
    if (user) {
      fetchNotifications()
      
      // Subscribe to new notifications
      const subscription = supabase
        .channel('notifications_channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev])
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [user])

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      
    if (!error && data) {
      setNotifications(data)
    }
  }

  const markAsRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      
    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 relative text-pixel-lavender hover:text-pixel-yellow rounded-none border-2 border-transparent hover:border-pixel-gray hover:bg-pixel-panel-light transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-pixel-red rounded-none flex items-center justify-center border border-pixel-navy animate-pulse">
            <span className="sr-only">New notifications</span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-pixel-navy border-2 border-pixel-gray shadow-pixel z-50 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b-2 border-pixel-gray bg-pixel-panel">
              <h3 className="font-pixel text-[10px] text-pixel-peach uppercase tracking-wider">
                Notifikasi
              </h3>
              {unreadCount > 0 && (
                <span className="font-retro text-xs bg-pixel-red/20 text-pixel-red px-2 py-0.5 border border-pixel-red">
                  {unreadCount} Baru
                </span>
              )}
            </div>
            
            <div className="max-h-[350px] overflow-y-auto pixel-scroll divide-y divide-pixel-gray/30">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-pixel-lavender font-retro">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Belum ada notifikasi
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    className={`p-4 hover:bg-pixel-panel-light transition-colors cursor-default ${
                      !notif.is_read ? 'bg-pixel-blue/5' : ''
                    }`}
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className={`font-retro text-base ${!notif.is_read ? 'text-pixel-white font-bold' : 'text-pixel-lavender'}`}>
                        {notif.title}
                      </h4>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-pixel-blue rounded-none mt-1.5 shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-pixel-lavender/80 mb-2 leading-tight">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-pixel-lavender/50 font-mono">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
