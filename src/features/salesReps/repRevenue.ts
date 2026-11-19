import type { Sale } from '@/types/database'

/**
 * Temsilci raporunda "Stoktan düşülsün mü? → Evet" ile açılan satışlar (SaleStockDialog). Bunlar temsilcinin
 * cirosuna eklenir (kullanıcı isteği, 2026-11-19: "ürünler stoktan düşülünce otomatik satış temsilcinin ciro
 * kısmına işlensin"). Ciro = temsilciye bağlı tahsilatlar + bu satışlar.
 */
export const REP_REPORT_SALE_NOTE = 'Temsilci raporu (WhatsApp)'

export function isRepReportSale(s: Pick<Sale, 'note' | 'type'>): boolean {
  return s.type === 'sale' && !!s.note?.startsWith(REP_REPORT_SALE_NOTE)
}

/** Dönemdeki (yyyy-MM-dd, iki uç dahil) temsilci raporu satış tutarları, temsilci id'sine göre */
export function repReportSalesByRep(sales: Pick<Sale, 'note' | 'type' | 'sales_rep_id' | 'sale_date' | 'quantity' | 'unit_price'>[], from: string, to: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of sales) {
    if (!s.sales_rep_id || !isRepReportSale(s)) continue
    const d = s.sale_date.slice(0, 10)
    if (d < from || d > to) continue
    map.set(s.sales_rep_id, (map.get(s.sales_rep_id) ?? 0) + Number(s.quantity) * Number(s.unit_price))
  }
  return map
}
