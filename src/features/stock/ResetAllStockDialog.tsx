import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
 * "Tüm Ürünleri Sıfırla" — sadece yönetici; zorunlu bir gerekçe metniyle tek
 * adımlı onay (önceden ayrıca "etkilenecek ürün sayısını yazarak onayla" ikinci
 * bir adımı vardı — kullanıcı isteğiyle, 2026-08-24, "sıfırlama ve silmeler bu
 * şekilde ekran çıkmasın Sil ve İptal çıksın sadece" — uygulamanın geri
 * kalanındaki tek adımlı İptal Et/Sil deseniyle tutarlı olsun diye kaldırıldı).
 * Gönderildiğinde `reset_all_stock` RPC'sini TEK seferde çağırır — RPC sunucu
 * tarafında hem paket hem flakon sayaçlarını tek bir transaction içinde
 * sıfırlar (ya hepsi ya hiçbiri). StockPage.tsx (Ürünler listesi) ve
 * StockCardPanel.tsx (Stok Kartı, hem tek ürün hem tüm ürünler modu)
 * tarafından paylaşılıyor — StockPage → StockCardPanel zaten import ettiği
 * için bu bileşen döngüsel import olmasın diye ayrı bir dosyada.
 */
export function ResetAllStockDialog({ affectedCount }: { affectedCount: number }) {
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  if (staff?.role !== 'admin') return null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setReason('')
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
            {affectedCount} ürünün stoğu (paket + flakon) SIFIRLANACAK. Bu işlem her ürün için "çıkış" hareketi olarak
            denetim kaydına işlenir ve geri alınamaz.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            İptal Et
          </Button>
          <Button type="button" variant="destructive" disabled={!reason.trim() || submitting} onClick={handleConfirm}>
            {submitting && <Loader2 className="animate-spin" />}
            Sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
