import * as React from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const MIN = 0.5
const MAX = 8

/**
 * Tam ekran resim görüntüleyici (kullanıcı isteği, 2026-11-17: "küçük resimler tam ekrana sığsın, yakınlaşıp
 * uzaklaşabileyim"). Resim ekrana sığar; tekerlek / trackpad sıkıştırma / + − düğmeleriyle yakınlaşır, yakınken
 * sürüklenerek gezilir, çift tıklama sığdırma ↔ 2x arasında geçer. `actions` alta ek düğme koyar.
 */
export function ImageViewer({
  src,
  title,
  open,
  onOpenChange,
  actions,
}: {
  src: string | null
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  actions?: React.ReactNode
}) {
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  const zoomBy = (factor: number) =>
    setZoom((z) => {
      const next = Math.min(MAX, Math.max(MIN, z * factor))
      if (next <= 1) setPan({ x: 0, y: 0 })
      return next
    })

  // Kapanınca yakınlaştırma sıfırlanır; bir sonraki açılışta resim yine ekrana sığar
  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[96vh] max-h-[96vh] w-[98vw] max-w-[98vw] flex-col gap-0 overflow-hidden border-0 bg-black/95 p-0 text-white sm:max-w-[98vw] [&>button:last-child]:z-10 [&>button:last-child]:text-white"
        onKeyDown={(e) => {
          if (e.key === '+' || e.key === '=') zoomBy(1.25)
          if (e.key === '-') zoomBy(0.8)
          if (e.key === '0') reset()
        }}
      >
        <DialogTitle className="sr-only">{title ?? 'Resim'}</DialogTitle>
        <div
          className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
          onWheel={(e) => zoomBy(e.deltaY < 0 ? (e.ctrlKey ? 1.08 : 1.15) : e.ctrlKey ? 0.926 : 0.87)}
          onDoubleClick={() => (zoom > 1 ? reset() : setZoom(2))}
          onPointerDown={(e) => {
            if (zoom <= 1) return
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) })
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {src && (
            <img
              src={src}
              alt={title ?? ''}
              draggable={false}
              className="absolute inset-0 size-full object-contain transition-transform duration-75"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/80 p-2 text-white">
          {title && <span className="mr-auto truncate px-2 text-sm text-white/80">{title}</span>}
          <Button size="icon" variant="secondary" title="Uzaklaştır (−)" onClick={() => zoomBy(0.8)}>
            <Minus />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="secondary" title="Yakınlaştır (+)" onClick={() => zoomBy(1.25)}>
            <Plus />
          </Button>
          <Button variant="secondary" title="Ekrana sığdır (0)" onClick={reset}>
            <Maximize /> Ekrana sığdır
          </Button>
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  )
}
