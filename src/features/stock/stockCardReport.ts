import type { StockMovementWithProduct } from './api'
import type { MovementType, StockUnitKind } from '@/types/database'

export interface StockCardRow {
  id: string
  date: string
  productId: string
  productName: string
  productSku: string | null
  doctorId: string | null
  doctorName: string | null
  kind: MovementType
  reason: string | null
  note: string | null
  unitPrice: number | null
  lotId: string | null
  unitKind: StockUnitKind
  /** Hareketin gerçek miktarı (paket ya da flakon birimiyle, birime bakılmaksızın) — düzenleme diyaloğu bunu kullanır. */
  quantity: number
  inQty: number
  outQty: number
  balance: number
}

const INCREASES_STOCK: ReadonlySet<MovementType> = new Set(['in', 'return', 'adjustment'])

/**
 * "Stok Kartı" — gerçek `stock_movements` denetim kaydından, ürün başına
 * kronolojik Giriş/Çıkış/Güncel Stok defteri kurar. Her ürünün kendi hareketleri
 * tarihe göre artan sırayla gezilip bakiye 0'dan biriktirilir — ürünler her
 * zaman `record_stock_movement` RPC'siyle 0 stokla oluşturulduğu için (bkz.
 * `createProduct`) bu, ürünün en son hareketindeki bakiyeyi `products.
 * current_quantity` ile birebir eşleştirir (yani rapor gerçekten "stokla
 * entegre"). `productId` verilmezse tüm ürünler için (toplu rapor), verilirse
 * sadece o ürün için döner — ama bakiye her zaman o ürünün TÜM geçmişinden
 * hesaplanır, filtre bakiyeyi etkilemez.
 */
export function buildStockLedger(movements: StockMovementWithProduct[], productId?: string): StockCardRow[] {
  const byProduct = new Map<string, StockMovementWithProduct[]>()
  for (const m of movements) {
    const list = byProduct.get(m.product_id)
    if (list) list.push(m)
    else byProduct.set(m.product_id, [m])
  }

  const rows: StockCardRow[] = []
  for (const [pid, list] of byProduct) {
    if (productId && pid !== productId) continue
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))
    let balance = 0
    for (const m of sorted) {
      // Bakiye (current_quantity/paket) yalnızca paket birimli hareketlerle ilerler —
      // flakon birimli hareketler ayrı bir sayacı (flakon_quantity) etkiler, bu
      // deftere karışırsa paket bakiyesi yanlış hesaplanır.
      const isFlakon = m.unit_kind === 'flakon'
      const isIn = INCREASES_STOCK.has(m.movement_type)
      if (!isFlakon) balance += isIn ? m.quantity : -m.quantity
      rows.push({
        id: m.id,
        date: m.created_at,
        productId: m.product_id,
        productName: m.products?.name ?? 'Bilinmeyen ürün',
        productSku: m.products?.sku ?? null,
        doctorId: m.customer_id,
        doctorName: m.customers?.full_name ?? null,
        kind: m.movement_type,
        reason: m.reason,
        note: m.note,
        unitPrice: m.unit_price != null ? Number(m.unit_price) : null,
        lotId: m.lot_id,
        unitKind: m.unit_kind,
        quantity: m.quantity,
        inQty: !isFlakon && isIn ? m.quantity : 0,
        outQty: !isFlakon && !isIn ? m.quantity : 0,
        balance,
      })
    }
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export interface StockCardSummary {
  inQty: number
  outQty: number
  currentStock: number
  doctorCount: number
  productCount: number
}

/** `rows` en yeniden en eskiye sıralı geldiği için her ürünün İLK karşılaşılan satırı en güncel bakiyesidir. */
export function summarizeStockLedger(rows: StockCardRow[]): StockCardSummary {
  const doctors = new Set<string>()
  const latestBalanceByProduct = new Map<string, number>()
  let inQty = 0
  let outQty = 0
  for (const r of rows) {
    if (r.doctorId) doctors.add(r.doctorId)
    if (!latestBalanceByProduct.has(r.productId)) latestBalanceByProduct.set(r.productId, r.balance)
    inQty += r.inQty
    outQty += r.outQty
  }
  const currentStock = [...latestBalanceByProduct.values()].reduce((sum, v) => sum + v, 0)
  return {
    inQty,
    outQty,
    currentStock,
    doctorCount: doctors.size,
    productCount: latestBalanceByProduct.size,
  }
}
