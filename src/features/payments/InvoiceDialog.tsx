import * as React from 'react'
import { FileText, Loader2, Upload, Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InvoicePdfViewer } from '@/components/InvoicePdfViewer'
import { getInvoiceFileUrl } from './api'
import { useSaveInvoice } from './hooks'
import type { Payment } from '@/types/database'

export function InvoiceDialog({ payment }: { payment: Payment }) {
  const [open, setOpen] = React.useState(false)
  const [invoiceNumber, setInvoiceNumber] = React.useState(payment.invoice_number ?? '')
  const [file, setFile] = React.useState<File | null>(null)
  const [viewerOpen, setViewerOpen] = React.useState(false)
  const saveMutation = useSaveInvoice()

  React.useEffect(() => {
    if (open) {
      setInvoiceNumber(payment.invoice_number ?? '')
      setFile(null)
    }
  }, [open, payment.invoice_number])

  async function handleSave() {
    await saveMutation.mutateAsync({ paymentId: payment.id, invoiceNumber: invoiceNumber || null, file })
    setOpen(false)
  }

  const hasInvoice = !!payment.invoice_number || !!payment.invoice_file_path

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasInvoice ? 'secondary' : 'outline'} size="sm">
          <FileText className="size-3.5" />
          {hasInvoice ? payment.invoice_number || 'Fatura' : 'Fatura Ekle'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fatura Bilgisi</DialogTitle>
          <DialogDescription>Gerçek fatura numarasını ve/veya dosyasını (PDF/görsel) ekleyin.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invoice-number">Fatura Numarası</Label>
            <Input
              id="invoice-number"
              placeholder="ABC2026000000123"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoice-file">Fatura Dosyası (PDF/JPG/PNG)</Label>
            <Input
              id="invoice-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {payment.invoice_file_path && (
            <Button type="button" variant="outline" size="sm" onClick={() => setViewerOpen(true)}>
              <Eye /> Yüklü Faturayı Görüntüle
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
      {payment.invoice_file_path && (
        <InvoicePdfViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          title={payment.invoice_number || 'Fatura'}
          getUrl={() => getInvoiceFileUrl(payment.invoice_file_path!)}
        />
      )}
    </Dialog>
  )
}
