import { AlertTriangle, X } from 'lucide-react'
import { Button } from './button'
import { soundManager } from '../../utils/soundEffects'

export default function PixelConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi Tindakan',
  description,
  message,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = true,
  variant,
  isLoading = false
}) {
  if (!isOpen) return null

  const resolvedDanger = variant ? variant === 'danger' : isDanger
  const bodyText = description || message || 'Apakah Anda yakin ingin melanjutkan tindakan ini?'

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none"
    >
      <div className="bg-pixel-panel border-4 border-pixel-gray shadow-pixel-lg w-full max-w-md animate-pixel-pop overflow-hidden">
        {/* Header Bar */}
        <div className={`px-5 py-3 border-b-2 border-pixel-gray flex items-center justify-between ${resolvedDanger ? 'bg-pixel-red/20' : 'bg-pixel-navy'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 flex items-center justify-center border-2 ${resolvedDanger ? 'bg-pixel-red/30 border-pixel-red text-pixel-red' : 'bg-pixel-yellow/30 border-pixel-yellow text-pixel-yellow'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="font-pixel text-[10px] text-pixel-white uppercase tracking-wider">
              {title}
            </h3>
          </div>
          <button
            onClick={() => {
              soundManager.playBlip?.()
              onClose()
            }}
            disabled={isLoading}
            aria-label="Tutup dialog"
            className="p-1 text-pixel-lavender hover:text-pixel-red border-2 border-transparent hover:border-pixel-red transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 font-retro text-lg text-pixel-peach leading-relaxed">
          {bodyText}
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3 border-t-2 border-pixel-gray bg-pixel-navy/80 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              soundManager.playBlip?.()
              onClose()
            }}
            disabled={isLoading}
            className="font-retro text-base border-2 border-pixel-gray text-pixel-lavender hover:text-pixel-peach rounded-none px-4 py-2"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (resolvedDanger) {
                soundManager.playError?.()
              } else {
                soundManager.playSuccess?.()
              }
              onConfirm()
            }}
            disabled={isLoading}
            className={`font-retro text-base font-bold rounded-none px-4 py-2 shadow-pixel-sm active:translate-y-0.5 ${
              resolvedDanger
                ? 'bg-pixel-red hover:bg-pixel-red/90 text-pixel-white border-2 border-pixel-navy'
                : 'bg-pixel-green hover:bg-pixel-green/90 text-pixel-navy border-2 border-pixel-navy'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                <span>Memproses...</span>
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
