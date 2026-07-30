import * as React from 'react'
import { Eraser } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface SignaturePadProps {
  value: string | null | undefined
  onChange: (dataUrl: string | null) => void
}

/**
 * Basit canvas tabanlı imza yakalama — harici bir kütüphane eklemeden
 * (Pointer Events + 2D context) doktordan ziyaret sırasında imza alınabilir.
 */
export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const drawingRef = React.useRef(false)
  const hasContentRef = React.useRef(!!value)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawingRef.current = true
    hasContentRef.current = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL('image/png'))
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    hasContentRef.current = false
    onChange(null)
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">İmza</p>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
          <Eraser className="size-3.5" /> Temizle
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        className="w-full touch-none rounded-lg border bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  )
}
