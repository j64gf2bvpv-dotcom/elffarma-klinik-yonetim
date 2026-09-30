import * as React from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SafeThumbnail } from '@/components/SafeThumbnail'

/**
 * SafeThumbnail'in tıklanınca görseli büyük gösteren hali (kullanıcı isteği,
 * 2026-09-30: "küçük resimlerine tıklayınca büyük göstersin"). Görsel yoksa
 * veya yüklenemezse sadece `fallback` gösterilir, tıklanamaz. Tıklama üst
 * satıra (satır seçimi, sürükleme vb.) geçmesin diye durduruluyor.
 */
export function ZoomableThumbnail({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null
  alt: string
  className?: string
  fallback: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  if (!src) return <>{fallback}</>

  return (
    <>
      <button
        type="button"
        title="Büyütmek için tıklayın"
        className="block cursor-zoom-in rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <SafeThumbnail src={src} alt={alt} className={className} fallback={fallback} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <img src={src} alt={alt} className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
