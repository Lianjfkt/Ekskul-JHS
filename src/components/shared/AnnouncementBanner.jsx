import { useEffect, useState } from 'react'
import { announcementService } from '../../utils/announcementService'
import { Megaphone, X } from 'lucide-react'

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([])
  const [dismissed, setDismissed] = useState([])

  useEffect(() => {
    async function load() {
      const data = await announcementService.getAnnouncements()
      setAnnouncements(data || [])
    }
    load()
  }, [])

  const activeAnnouncements = announcements.filter(ann => !dismissed.includes(ann.id))

  if (activeAnnouncements.length === 0) return null

  return (
    <div className="space-y-3 mb-6">
      {activeAnnouncements.map((ann) => (
        <div 
          key={ann.id} 
          className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-slate-800 dark:text-slate-200 transition-all duration-300 animate-in fade-in slide-in-from-top-4"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-bounce" />
          </div>
          <div className="flex-1 pr-6 min-w-0">
            <h4 className="font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
              {ann.title}
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                Baru
              </span>
            </h4>
            <p className="text-xs text-amber-900/80 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
              {ann.content}
            </p>
            {ann.users?.full_name && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                Diumumkan oleh: {ann.users.full_name}
              </p>
            )}
          </div>
          <button 
            onClick={() => setDismissed(prev => [...prev, ann.id])}
            className="absolute top-3 right-3 p-1 rounded-lg text-amber-700/60 dark:text-slate-400 hover:text-amber-900 dark:hover:text-slate-200 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 transition-all"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
