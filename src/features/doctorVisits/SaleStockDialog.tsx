import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, PackageMinus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/features/stock/hooks'
import { createSale } from '@/features/sales/api'
import { getErrorMessage } from '@/lib/utils'
import type { DoctorVisit } from '@/types/database'
import { ensureVisitCustomer } from './linkCustomer'
import { setVisitSale } from './api'
import type { VisitSale } from './chatSales'
import { matchProduct } from './productMatch'
import { REP_REPORT_SALE_NOTE } from '@/features/salesReps/repRevenue'

/** "10+2 mixo volume" → 12; "3 kutu" → 3; sayı yoksa 1 */
function qtyOf(text: string): number {
  const m = text.match(/(\d+)\s*(?:\+\s*(\d+))?/)
  return m ? +m[1] + (m[2] ? +m[2] : 0) : 1
}

interface Line {
  include: boolean
  text: string
  productId: string
  qty: string
  unitPrice: string
}

/**
 * Satışın stoktan düşülmesi için teyit (kullanıcı isteği, 2026-11-19: "stoktan düşülsün mü diye teyit al").
 * Her ürün satırı katalogdaki ürünle eşleştirilir; adet ve birim fiyat düzeltilebilir. Onaylanınca her satır
 * için normal Satış kaydı açılır (stok hareketi aynı anda yazılır) ve ziyaretteki satış "stoktan düşüldü" olur.
 */
export function SaleStockDialog({
  visit,
  sale,
  repName,
  open,
  onOpenChange,
}: {
  visit: DoctorVisit
  sale: VisitSale
  repName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: allProducts = [] } = useProducts('')
  // Örnek/deneme ürünleri teyit listesinde çıkmaz
  const products = React.useMemo(() => allProducts.filter((p) => !/^\[örnek\]|^ürün adı$/i.test(p.name.trim())), [allProducts])
  const [lines, setLines] = React.useState<Line[]>([])
  const [busy, setBusy] = React.useState(false)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!open) return
    setLines(
      sale.items.map((it) => {
        const qty = qtyOf(it.text)
        const gift = /hediye|mf\b/i.test(it.text)
        // Tek ürün ve toplam = adet × tutar ise tutar birim fiyattır; değilse satır toplamıdır
        const amountIsUnit = sale.items.length === 1 && it.amount != null && sale.total != null && Math.abs(sale.total - it.amount * qty) < 1
        const unit = it.amount == null ? (sale.items.length === 1 && sale.total != null ? sale.total / qty : 0) : amountIsUnit ? it.amount : it.amount / qty
        return {
          include: true,
          text: it.text,
          productId: matchProduct(it.text, products)?.id ?? '',
          qty: String(qty),
          unitPrice: gift ? '0' : String(Math.round(unit * 100) / 100),
        }
      }),
    )
  }, [open, sale, products])

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const chosen = lines.filter((l) => l.include)
  const valid = chosen.length > 0 && chosen.every((l) => l.productId && Number(l.qty) > 0 && Number(l.unitPrice) >= 0)

  async function confirm() {
    setBusy(true)
    try {
      let customerId = visit.customer_id
      if (!customerId) customerId = (await ensureVisitCustomer(visit.doctor_name, visit.phone, visit.sales_rep_id, visit.visit_date))?.id ?? null
      if (!customerId) throw new Error('Doktor Cari Kart ile eşleşmedi')
      for (const l of chosen) {
        const product = products.find((p) => p.id === l.productId)!
        await createSale({
          type: 'sale',
          customer_id: customerId,
          sales_rep_id: visit.sales_rep_id,
          product_id: product.id,
          product_name: product.name,
          quantity: Number(l.qty),
          unit_price: Number(l.unitPrice),
          sale_date: visit.visit_date,
          note: `${REP_REPORT_SALE_NOTE} — ${repName}: ${l.text}`,
          movement_note: `${repName} satışı — ${visit.doctor_name}`,
        })
      }
      await setVisitSale(visit.id, { ...sale, stock: 'done' })
      toast.success(`${chosen.length} ürün stoktan düşüldü`, { description: 'Satışlar sayfasına da kaydedildi.' })
      void queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      onOpenChange(false)
    } catch (err) {
      toast.error('Stoktan düşülemedi', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Stoktan düşülsün mü? — {visit.doctor_name}</DialogTitle>
          <DialogDescription>
            Ürünleri ve adetleri kontrol edin. Onaylarsanız her ürün stoktan düşülür ve Satışlar sayfasına {repName} satışı olarak kaydedilir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_7rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
            <span />
            <span>Ürün</span>
            <span>Adet (paket)</span>
            <span>Birim fiyat ₺</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_7rem] items-start gap-2 rounded-md border p-2">
              <Checkbox checked={l.include} onCheckedChange={(v) => update(i, { include: v === true })} className="mt-2" />
              <div className="grid min-w-0 gap-1">
                <Select value={l.productId} onValueChange={(v) => update(i, { productId: v })}>
                  <SelectTrigger className={!l.productId ? 'border-destructive' : undefined}>
                    <SelectValue placeholder="Ürün seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} <span className="text-muted-foreground">· stok {p.current_quantity}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="truncate text-xs text-muted-foreground" title={l.text}>Sohbette: {l.text}</span>
              </div>
              <Input inputMode="numeric" value={l.qty} onChange={(e) => update(i, { qty: e.target.value.replace(/[^\d]/g, '') })} />
              <Input inputMode="decimal" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={() => void confirm()} disabled={!valid || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <PackageMinus className="size-4" />} Evet, stoktan düş
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
