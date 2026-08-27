import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getErrorMessage } from '@/lib/utils'

/**
 * "Tüm Ürünleri Sıfırla" — artık herhangi bir aktif personel kullanabilir
 * (kullanıcı isteği, 2026-08-25: "bütün kullanıcılara açık olsun" —
 * `reset_all_stock` RPC'sindeki is_admin() kontrolü is_active_staff()'a
 * indirildi, bkz. migration 20260825120853). Onay, uygulamanın geri
 * kalanındaki paylaşılan tek adımlı İptal Et/Sil deseniyle aynı
 * (useConfirmDialog) — önceden ayrıca zorunlu bir gerekçe metni yazmak
 * gerekiyordu, kullanıcı isteğiyle (2026-08-25, "bu ekran çıkmasın onayla ve
 * vazgeç çıksın sadece") kaldırıldı; RPC'nin kendisi denetim kaydı için hâlâ
 * bir gerekçe metni istediğinden sabit bir metin otomatik gönderiliyor.
 * Gönderildiğinde `reset_all_stock` RPC'sini TEK seferde çağırır — RPC
 * sunucu tarafında aktif VE stoğu 0'dan büyük olan (bu yüzden "eksik/fazla
 * ürün kalmasın" isteğiyle tutarlı — zaten stoğu 0 olan bir ürünün ayrıca
 * sıfırlanacak bir şeyi yok) her ürünün paket + flakon sayaçlarını tek tek
 * ama aynı çağrı içinde sıfırlar. StockPage.tsx (Ürünler listesi) ve
 * StockCardPanel.tsx (Stok Kartı, hem tek ürün hem tüm ürünler modu)
 * tarafından paylaşılıyor — StockPage → StockCardPanel zaten import ettiği
 * için bu bileşen döngüsel import olmasın diye ayrı bir dosyada.
 */
export function ResetAllStockDialog({ affectedCount }: { affectedCount: number }) {
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirmDialog()

  async function handleClick() {
    if (
      !(await confirm(
        `${affectedCount} ürünün stoğu (paket + flakon) SIFIRLANACAK. Bu işlem her ürün için "çıkış" hareketi olarak denetim kaydına işlenir ve geri alınamaz.`,
        { title: 'Tüm Ürünleri Sıfırla', confirmLabel: 'Onayla' },
      ))
    )
      return

    try {
      const { data, error } = await supabase.rpc('reset_all_stock', {
        p_reason: `Tüm ürünleri sıfırla (${new Date().toLocaleString('tr-TR')})`,
      })
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
    } catch (error) {
      toast.error('Sıfırlanamadı', { description: getErrorMessage(error) })
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={handleClick}
        disabled={affectedCount === 0}
        title="Tüm ürünlerin paket ve flakon stok miktarını 0'a çeker (denetim kaydı olarak işlenir)"
      >
        <RotateCcw />
        Tüm Ürünleri Sıfırla
      </Button>
      {dialog}
    </>
  )
}
