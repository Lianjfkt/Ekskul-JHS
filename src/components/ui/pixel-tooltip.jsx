import { useState } from 'react'
import { cn } from '@/lib/utils'

export function PixelTooltip({ children, content, side = 'top', className }) {
  const [open, setOpen] = useState(false)

  if (!content) return children

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side] || 'bottom-full left-1/2 -translate-x-1/2 mb-2'

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 pointer-events-none whitespace-nowrap bg-pixel-navy border-2 border-pixel-blue px-2 py-1 text-pixel-white font-retro text-sm shadow-pixel animate-pixel-pop",
            sideClasses,
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}

