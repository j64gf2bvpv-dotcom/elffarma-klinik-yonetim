import * as React from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { saveAs } from 'file-saver'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Bir PDF'i program içinde sayfa sayfa gösterir, istenirse indirir (kullanıcı isteği, 2026-11-27: "fiyat listesi hem
 * görüntüle olsun hem indir olsun"). Electron penceresinde yerleşik PDF görüntüleyici kapalı olduğundan sayfalar
 * pdf.js ile resme çevrilip gösterilir.
 */
export function PdfPreviewDialog({
  pdf,
  title,
  onClose,
}: {
  pdf: { blob: Blob; fileName: string } | null
  title: string
  onClose: () => void
}) {
  const [pages, setPages] = React.useState<string[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [index, setIndex] = React.useState(0)
  const count = pages?.length ?? 0
  const go = (d: number) => setIndex((i) => Math.min(Math.max(0, i + d), Math.max(0, count - 1)))

  React.useEffect(() => {
    if (!pdf) return
    let cancelled = false
    void (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await pdf.blob.arrayBuffer()) }).promise
        const out: string[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: 2 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
          out.push(canvas.toDataURL('image/png'))
        }
        if (!cancelled) {
          setIndex(0)
          setPages(out)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
      setPages(null)
      setError(null)
      setIndex(0)
    }
  }, [pdf])

  return (
    <Dialog open={!!pdf} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex h-[98vh] w-[98vw] max-w-none! flex-col gap-2 p-3 sm:max-w-none!"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
          if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{pdf?.fileName}</DialogDescription>
        </DialogHeader>
        {/* Tam ekran, her seferinde tek sayfa — sayfa ekrana tam sığar (kullanıcı isteği: "tam ekran tek sayfa görünsün") */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-md bg-muted/40 p-2">
          {error ? (
            <p className="text-sm text-destructive">Görüntülenemedi: {error}</p>
          ) : !pages ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <img src={pages[index]} alt={`Sayfa ${index + 1}`} className="max-h-full max-w-full rounded bg-white object-contain shadow-md" />
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => go(-1)} disabled={index === 0} title="Önceki sayfa">
              <ChevronLeft />
            </Button>
            <span className="min-w-16 text-center text-sm tabular-nums">{count ? `${index + 1} / ${count}` : ''}</span>
            <Button variant="outline" size="icon" onClick={() => go(1)} disabled={index >= count - 1} title="Sonraki sayfa">
              <ChevronRight />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Kapat
            </Button>
            <Button onClick={() => pdf && saveAs(pdf.blob, pdf.fileName)} disabled={!pdf}>
              <Download /> İndir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
