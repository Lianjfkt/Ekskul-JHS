import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { soundManager } from '@/utils/soundEffects'
import { toast } from '@/stores/toastStore'
import { cn } from '@/lib/utils'

export default function CopyButton({
  text,
  label = 'Salin',
  successMessage = 'Teks berhasil disalin ke clipboard!',
  className,
  variant = 'default', // 'default', 'icon-only', 'compact'
  iconOnly = false,
  showToast = true,
  onCopySuccess
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      soundManager.playCoin()
      
      if (showToast) {
        toast.success(successMessage, 'Tersalin!')
      }

      if (onCopySuccess) {
        onCopySuccess()
      }

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
      soundManager.playError()
      toast.error('Gagal menyalin teks ke clipboard.')
    }
  }

  if (iconOnly || variant === 'icon-only') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "p-1.5 border-2 rounded-none relative group",
          copied
            ? "bg-pixel-green/20 border-pixel-green text-pixel-green"
            : "border-pixel-gray bg-pixel-navy text-pixel-peach hover:border-pixel-blue hover:text-pixel-blue",
          className
        )}
        title={copied ? "Tersalin!" : label}
      >
        {copied ? (
          <Check className="w-4 h-4 animate-pixel-pop" />
        ) : (
          <Copy className="w-4 h-4 group-hover:scale-110" />
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "pixel-btn inline-flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 border-2 rounded-none",
        copied
          ? "bg-pixel-green text-pixel-navy border-pixel-green font-bold animate-pixel-pop"
          : "bg-pixel-panel text-pixel-peach border-pixel-gray hover:border-pixel-blue hover:text-pixel-blue",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Tersalin!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}

