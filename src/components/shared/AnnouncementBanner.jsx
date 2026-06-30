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
          className="relative overflow-hidden bg-pixel-orange/10 border-3 border-pixel-orange rounded-none p-4 flex items-start gap-3 text-pixel-peach pixel-slide-in"
        >
          {/* Pixel icon box */}
          <div className="w-9 h-9 bg-pixel-orange/20 border-2 border-pixel-orange flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-pixel-orange pixel-bounce" />
          </div>
          <div className="flex-1 pr-6 min-w-0">
            <h4 className="font-pixel text-[9px] text-pixel-yellow pixel-text-shadow flex items-center gap-2 leading-relaxed">
              {ann.title}
              <span className="pixel-badge border-pixel-yellow text-pixel-yellow bg-pixel-yellow/10 text-[7px]">
                NEW!
              </span>
            </h4>
            <p className="font-retro text-lg text-pixel-peach mt-1 whitespace-pre-wrap leading-relaxed">
              {ann.content}
            </p>
            {ann.users?.full_name && (
              <p className="font-retro text-base text-pixel-lavender mt-2">
                By: {ann.users.full_name}
              </p>
            )}
          </div>
          <button 
            onClick={() => setDismissed(prev => [...prev, ann.id])}
            className="absolute top-3 right-3 p-1 rounded-none text-pixel-lavender hover:text-pixel-red border-2 border-transparent hover:border-pixel-red"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
