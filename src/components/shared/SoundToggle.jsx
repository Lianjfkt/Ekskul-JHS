import { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { soundManager } from '@/utils/soundEffects'
import { cn } from '@/lib/utils'

export default function SoundToggle({ className }) {
  const [muted, setMuted] = useState(soundManager.isMuted())

  useEffect(() => {
    const unsubscribe = soundManager.subscribe((isMuted) => {
      setMuted(isMuted)
    })
    return unsubscribe
  }, [])

  const handleToggle = () => {
    soundManager.toggleMute()
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "p-2 relative rounded-none border-2 border-transparent hover:border-pixel-gray hover:bg-pixel-panel-light active:translate-x-0.5 active:translate-y-0.5",
        muted ? "text-pixel-lavender/60 hover:text-pixel-lavender" : "text-pixel-green hover:text-pixel-yellow",
        className
      )}
      title={muted ? "Suara Retro: Bisu (Klik untuk aktifkan)" : "Suara Retro: Aktif (Klik untuk bisukan)"}
      aria-label="Toggle Sound Effects"
    >
      {muted ? (
        <VolumeX className="w-5 h-5" />
      ) : (
        <div className="relative">
          <Volume2 className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-pixel-green animate-pixel-blink" />
        </div>
      )}
    </button>
  )
}

