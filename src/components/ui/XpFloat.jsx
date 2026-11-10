import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export default function XpFloat({ text = '+10 XP', show = false, onComplete, className }) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        if (onComplete) onComplete()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!visible) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 inline-flex items-center gap-1 font-pixel text-xs px-2.5 py-1 bg-pixel-navy border-2 border-pixel-yellow text-pixel-yellow shadow-pixel animate-pixel-xp-float",
        className
      )}
    >
      <span>⭐</span>
      <span>{text}</span>
    </div>
  )
}

