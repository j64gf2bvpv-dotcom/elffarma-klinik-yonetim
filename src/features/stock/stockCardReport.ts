import type { SaleWithRelations } from '@/features/sales/api'
import type { SampleRequestWithRelations } from '@/features/samples/api'

export type StockCardRowKind = 'satis' | 'iade' | 'numune'

export interface StockCardRow {
  id: string
  date: string
  productId: string
  productName: string
  doctorId: string
  doctorName: string
  kind: StockCardRowKind
  quantity: number
  unitPrice: number
  total: number
}

export const stockCardRowKindLabels: Record<StockCardRowKind, string> = {
  satis: 'Satış',
  iade: 'İade',
  numune: 'Numune',
}

/**
 * "Stok Kartı" dökümü: hangi ürünün hangi doktora, ne zaman, hangi fiyattan
 * satıldığını/numune verildiğini tek bir kronolojik listede birleştirir.
 * `sales` (satış/iade, gerçek fiyatlı) ve `sample_requests` + `sample_items`
 * (numune, gerçek fiyatlı ama stok_movements'ta fiyat yok) ayrı tablolar
 * olduğu için burada client tarafında birleştiriliyor — DB'de ikisini
 * birleştiren ortak bir görünüm yok. `productId` verilmezse TÜM ürünler
 * için (toplu rapor), verilirse sadece o ürün için döner.
 */
export function buildStockCardReport(
  sales: SaleWithRelations[],
  sampleRequests: SampleRequestWithRelations[],
  productId?: string,
): StockCardRow[] {
  const rows: StockCardRow[] = []

  for (const s of sales) {
    if (!s.product_id) continue
    if (productId && s.product_id !== productId) continue
    rows.push({
      id: `sale-${s.id}`,
      date: s.sale_date,
      productId: s.product_id,
      productName: s.product_name,
      doctorId: s.customer_id,
      doctorName: s.customers?.full_name ?? 'Bilinmeyen',
      kind: s.type === 'return' ? 'iade' : 'satis',
      quantity: s.quantity,
      unitPrice: Number(s.unit_price),
      total: s.quantity * Number(s.unit_price),
    })
  }

  for (const request of sampleRequests) {
    for (const item of request.sample_items) {
      if (productId && item.product_id !== productId) continue
      rows.push({
        id: `sample-${item.id}`,
        date: request.request_date,
        productId: item.product_id,
        productName: item.products?.name ?? 'Bilinmeyen ürün',
        doctorId: request.customer_id,
        doctorName: request.customers?.full_name ?? 'Bilinmeyen',
        kind: 'numune',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        total: item.quantity * Number(item.unit_price),
      })
    }
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export interface StockCardSummary {
  soldQty: number
  returnedQty: number
  sampleQty: number
  soldRevenue: number
  sampleValue: number
  doctorCount: number
  productCount: number
}

export function summarizeStockCard(rows: StockCardRow[]): StockCardSummary {
  const doctors = new Set<string>()
  const productsSeen = new Set<string>()
  let soldQty = 0
  let returnedQty = 0
  let sampleQty = 0
  let soldRevenue = 0
  let sampleValue = 0
  for (const r of rows) {
    doctors.add(r.doctorId)
    productsSeen.add(r.productId)
    if (r.kind === 'satis') {
      soldQty += r.quantity
      soldRevenue += r.total
    } else if (r.kind === 'iade') {
      returnedQty += r.quantity
      soldRevenue -= r.total
    } else {
      sampleQty += r.quantity
      sampleValue += r.total
    }
  }
  return { soldQty, returnedQty, sampleQty, soldRevenue, sampleValue, doctorCount: doctors.size, productCount: productsSeen.size }
}
