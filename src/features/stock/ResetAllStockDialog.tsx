import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabaseClient'

/**
 * "Tüm Ürünleri Sıfırla" — sadece yönetici, iki adımlı onay: (1) etkilenecek
 * ürün sayısının önizlemesi + zorunlu bir gerekçe metni, (2) ürün sayısını
 * elle yazarak kesin onay. Gönderildiğinde `reset_all_stock` RPC'sini TEK
 * seferde çağırır — RPC sunucu tarafında hem paket hem flakon sayaçlarını
 * tek bir transaction içinde sıfırlar (ya hepsi ya hiçbiri). StockPage.tsx
 * (Ürünler listesi) ve StockCardPanel.tsx (Stok Kartı, hem tek ürün hem tüm
 * ürünler modu) tarafından paylaşılıyor — StockPage → StockCardPanel zaten
 * import ettiği için bu bileşen döngüsel import olmasın diye ayrı bir
 * dosyada.
 */
export function ResetAllStockDialog({ affectedCount }: { affectedCount: number }) {
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2>(1)
  const [reason, setReason] = React.useState('')
  const [confirmText, setConfirmText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  if (staff?.role !== 'admin') return null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setStep(1)
      setReason('')
      setConfirmText('')
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('reset_all_stock', { p_reason: reason.trim() })
      if (error) throw error
      // Sadece ['products'] invalidate etmek yetmiyordu — Günlük Sayım
      // (['stock_count_items', ...]) ve Stok Kartı (['stock_movements'])
      // ürün verisini KENDİ sorgularına GÖMÜLÜ olarak (join ile) önceden
      // çekip ayrı önbelleklerde tutuyor; bu anahtarlar ayrıca invalidate
      // edilmezse sıfırlama veritabanında gerçekleşir ama o ekranlar eski
      // (sıfırlanmamış) miktarları göstermeye devam eder.
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['stock_count_items'] })
      await queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      toast.success(`${data ?? affectedCount} ürünün stoğu (paket + flakon) sıfırlandı`)
      handleOpenChange(false)
    } catch (error) {
      toast.error('Sıfırlanamadı', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={affectedCount === 0}
        title="Tüm ürünlerin paket ve flakon stok miktarını 0'a çeker (denetim kaydı olarak işlenir)"
      >
        <RotateCcw />
        Tüm Ürünleri Sıfırla
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tüm Ürünleri Sıfırla</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `${affectedCount} ürünün stoğu (paket + flakon) SIFIRLANACAK. Bu işlem her ürün için "çıkış" hareketi olarak denetim kaydına işlenir ve geri alınamaz.`
              : 'Son onay: devam etmek için etkilenecek ürün sayısını aşağıya yazın.'}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reset-reason">Gerekçe (zorunlu)</Label>
              <Textarea
                id="reset-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ör. yıl sonu fiziksel sayım sonrası toplu sıfırlama..."
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="reset-confirm">Onaylamak için "{affectedCount}" yazın</Label>
            <Input id="reset-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Vazgeç
          </Button>
          {step === 1 ? (
            <Button type="button" variant="destructive" disabled={!reason.trim()} onClick={() => setStep(2)}>
              Devam Et
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText.trim() !== String(affectedCount) || submitting}
              onClick={handleConfirm}
            >
              {submitting && <Loader2 className="animate-spin" />}
              Sıfırla
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
