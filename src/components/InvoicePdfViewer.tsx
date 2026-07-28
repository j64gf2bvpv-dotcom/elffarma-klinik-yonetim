import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface InvoicePdfViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  getUrl: () => Promise<string>
}

/**
 * Fatura PDF'ini uygulama içinde (Chromium'un yerleşik PDF görüntüleyicisiyle) gösterir —
 * electron/main.ts'te setWindowOpenHandler her window.open() çağrısını harici tarayıcıya
 * yönlendirdiği için, faturalar burada bir <iframe> ile açılır; harici pencere açılmaz.
 * Chromium'un görüntüleyici araç çubuğu yazdırma ve indirme seçeneklerini kendiliğinden sağlar.
 */
export function InvoicePdfViewer({ open, onOpenChange, title, getUrl }: InvoicePdfViewerProps) {
  const [url, setUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setUrl(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getUrl()
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        toast.error('Fatura açılamadı', { description: error instanceof Error ? error.message : undefined })
        onOpenChange(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // getUrl/onOpenChange her satırda yeni bir fonksiyon referansı olabileceğinden yalnızca
    // dialog açıldığında yeniden çalıştırılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-muted flex-1 overflow-hidden rounded-lg border">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          )}
          {!loading && url && <iframe src={url} title={title} className="h-full w-full" />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
