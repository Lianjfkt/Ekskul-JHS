import { useToastStore } from '@/stores/toastStore'
import { soundManager } from '@/utils/soundEffects'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PixelToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((item) => (
        <PixelToastItem key={item.id} item={item} onClose={() => removeToast(item.id)} />
      ))}
    </div>
  )
}

function PixelToastItem({ item, onClose }) {
  const { title, message, type, duration } = item

  const typeConfig = {
    success: {
      border: 'border-pixel-green',
      bg: 'bg-pixel-navy',
      badgeBg: 'bg-pixel-green/20 text-pixel-green border-pixel-green',
      icon: CheckCircle2,
      progressColor: 'bg-pixel-green',
      accentColor: 'text-pixel-green',
    },
    error: {
      border: 'border-pixel-red',
      bg: 'bg-pixel-navy',
      badgeBg: 'bg-pixel-red/20 text-pixel-red border-pixel-red',
      icon: AlertCircle,
      progressColor: 'bg-pixel-red',
      accentColor: 'text-pixel-red',
    },
    warning: {
      border: 'border-pixel-orange',
      bg: 'bg-pixel-navy',
      badgeBg: 'bg-pixel-orange/20 text-pixel-orange border-pixel-orange',
      icon: AlertTriangle,
      progressColor: 'bg-pixel-orange',
      accentColor: 'text-pixel-orange',
    },
    info: {
      border: 'border-pixel-blue',
      bg: 'bg-pixel-navy',
      badgeBg: 'bg-pixel-blue/20 text-pixel-blue border-pixel-blue',
      icon: Info,
      progressColor: 'bg-pixel-blue',
      accentColor: 'text-pixel-blue',
    },
  }[type] || {
    border: 'border-pixel-blue',
    bg: 'bg-pixel-navy',
    badgeBg: 'bg-pixel-blue/20 text-pixel-blue border-pixel-blue',
    icon: Info,
    progressColor: 'bg-pixel-blue',
    accentColor: 'text-pixel-blue',
  }

  const Icon = typeConfig.icon

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto relative overflow-hidden p-3.5 border-3 shadow-pixel animate-pixel-pop",
        typeConfig.bg,
        typeConfig.border
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 border-2 shrink-0 mt-0.5", typeConfig.badgeBg)}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          {title && (
            <h4 className={cn("font-pixel text-[10px] tracking-wide mb-1", typeConfig.accentColor)}>
              {title}
            </h4>
          )}
          <p className="font-retro text-base text-pixel-white leading-tight break-words">
            {message}
          </p>
        </div>

        <button
          onClick={() => {
            soundManager.playBlip()
            onClose()
          }}
          className="absolute top-2.5 right-2.5 p-1 text-pixel-lavender hover:text-pixel-white hover:bg-pixel-panel border border-transparent hover:border-pixel-gray transition-none"
          title="Tutup"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Retro progress countdown bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-pixel-panel">
          <div
            className={cn("h-full", typeConfig.progressColor)}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  )
}
