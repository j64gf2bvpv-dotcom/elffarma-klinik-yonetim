import * as React from 'react'
import { Loader2, ZoomIn } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const VIEWPORT_SIZE = 260
const EXPORT_SIZE = 500
const MAX_EXTRA_ZOOM = 3

/**
 * Seçilen fotoğrafı (hangi çözünürlük/en-boy oranında olursa olsun) dairesel
 * bir çerçeve içinde gösterip kullanıcının kendi sürükleyip yakınlaştırarak
 * (zoom slider + fare ile sürükleme) tam istediği kadranı seçmesini sağlar —
 * "otomatik ortadan kırp" yerine kullanıcı kontrolü. Onaylanınca aynı
 * dönüşüm (konum + zoom) bir <canvas>'a dairesel maskeyle çizilip PNG Blob
 * olarak dışa aktarılır; üçüncü parti bir kırpma kütüphanesi eklenmedi.
 */
export function AvatarCropDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: File | null
  onConfirm: (blob: Blob) => Promise<void> | void
}) {
  const imgRef = React.useRef<HTMLImageElement>(null)
  const [imgUrl, setImgUrl] = React.useState<string | null>(null)
  const [naturalSize, setNaturalSize] = React.useState({ width: 0, height: 0 })
  const [coverScale, setCoverScale] = React.useState(1)
  const [zoom, setZoom] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [saving, setSaving] = React.useState(false)
  const dragState = React.useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(
    null,
  )

  React.useEffect(() => {
    if (!file) {
      setImgUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleImageLoad() {
    const img = imgRef.current
    if (!img) return
    const { naturalWidth, naturalHeight } = img
    setNaturalSize({ width: naturalWidth, height: naturalHeight })
    setCoverScale(Math.max(VIEWPORT_SIZE / naturalWidth, VIEWPORT_SIZE / naturalHeight))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset({ x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy })
  }

  function handlePointerUp() {
    dragState.current = null
  }

  async function handleConfirm() {
    if (!imgRef.current || naturalSize.width === 0) return
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_SIZE
      canvas.height = EXPORT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const exportRatio = EXPORT_SIZE / VIEWPORT_SIZE
      const scale = coverScale * zoom * exportRatio
      const drawWidth = naturalSize.width * scale
      const drawHeight = naturalSize.height * scale
      const drawX = EXPORT_SIZE / 2 + offset.x * exportRatio - drawWidth / 2
      const drawY = EXPORT_SIZE / 2 + offset.y * exportRatio - drawHeight / 2

      ctx.beginPath()
      ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(imgRef.current, drawX, drawY, drawWidth, drawHeight)

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (blob) await onConfirm(blob)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Fotoğrafı Ayarla</DialogTitle>
          <DialogDescription>
            Sürükleyerek konumlandırın, yakınlaştırma çubuğuyla boyutlandırın — daire içinde ne görünüyorsa o
            kaydedilir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="bg-muted relative touch-none overflow-hidden rounded-full ring-1 ring-black/10"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, cursor: 'grab' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                draggable={false}
                onLoad={handleImageLoad}
                className="absolute top-1/2 left-1/2 max-w-none select-none"
                style={{
                  width: naturalSize.width * coverScale * zoom,
                  height: naturalSize.height * coverScale * zoom,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomIn className="text-muted-foreground size-4 shrink-0" />
            <input
              type="range"
              min={1}
              max={MAX_EXTRA_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving || !imgUrl}>
            {saving && <Loader2 className="animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
