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
  flakonBalance: number
}

const INCREASES_STOCK: ReadonlySet<MovementType> = new Set(['in', 'return', 'adjustment'])

/**
 * "Stok Kartı" — gerçek `stock_movements` denetim kaydından, ürün başına
 * kronolojik Giriş/Çıkış/Güncel Stok defteri kurar. Her ürünün kendi hareketleri
 * tarihe göre artan sırayla gezilip bakiye 0'dan biriktirilir. `productId`
 * verilmezse tüm ürünler için (toplu rapor), verilirse sadece o ürün için
 * döner — ama bakiye her zaman o ürünün TÜM geçmişinden hesaplanır, filtre
 * bakiyeyi etkilemez.
 *
 * ÖNEMLİ — `productQuantities`: bir hareket düzenlenip/silinip sonuç negatife
 * düşecekse veritabanı o ANKİ current_quantity/flakon_quantity üzerinden
 * kırpıyor (greatest(0,...)), bu ANLIK bir işlem — hangi satırın "üzerine"
 * uygulandığı, o satırın created_at'ine göre kronolojik sırada YENİDEN
 * OYNATILDIĞINDA aynı sonucu vermeyebilir (satırlar arası düzenleme/silme
 * geçmişi stock_movements'ta saklanmıyor, sadece son hâl var). Yani bu
 * fonksiyonun kendi kronolojik-kırpmalı toplamı ürünün GERÇEK güncel
 * stoğundan sapabilir. Bunu telafi etmek için: her ürünün PAKET ve FLAKON
 * için en son (en yeni created_at'li) satırının bakiyesi, hesaplanan değer
 * ne olursa olsun, `productQuantities`'teki gerçek `products.current_quantity`/
 * `flakon_quantity` ile DEĞİŞTİRİLİYOR — "Güncel Stok" asla veritabanından
 * sapmasın diye (daha eski satırlar en iyi çaba tahminidir, tam bir geçmiş
 * denetim izni olmadan mükemmel yeniden üretilemez).
 */
export function buildStockLedger(
  movements: StockMovementWithProduct[],
  productQuantities: Map<string, { current_quantity: number; flakon_quantity: number }>,
  productId?: string,
): StockCardRow[] {
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
    let flakonBalance = 0
    const productRows: StockCardRow[] = []
    let lastPaketRow: StockCardRow | null = null
    let lastFlakonRow: StockCardRow | null = null
    for (const m of sorted) {
      // Bakiye (current_quantity/paket) yalnızca paket birimli hareketlerle ilerler —
      // flakon birimli hareketler ayrı bir sayacı (flakon_quantity, flakonBalance)
      // etkiler, bu deftere karışırsa paket bakiyesi yanlış hesaplanır. Ama Giriş/Çıkış
      // miktarları (inQty/outQty) HER hareketin kendi yönünü yansıtmalı — flakon
      // hareketlerinde bunları 0'a sabitlemek hem "Hareket Dökümü"nde flakon
      // miktarını görünmez kılıyordu hem de StockCardPanel'deki satır-içi
      // düzenlemenin (handleInlineQtyChange) yön tespitini (rowIsInSide =
      // row.inQty > 0) flakon satırlarında hep "false" gösterip yanlışlıkla
      // giriş↔çıkış yönünü çevirmesine yol açıyordu.
      // `update_stock_movement`/`delete_stock_movement` bir düzenleme/silme
      // sonucu miktarı negatife düşürecekse veritabanında `greatest(0, ...)`
      // ile 0'a kırpıyor (bkz. clamp_negative_stock_on_edit_delete migration'ı)
      // — burada da HER adımda aynı kırpmayı uygulamazsak (sadece toplamda
      // değil), geçmişte bir kırpma yaşanmış bir üründe bu defter kalıcı
      // olarak products.current_quantity'den sapar (negatif de gösterebilir).
      const isFlakon = m.unit_kind === 'flakon'
      const isIn = INCREASES_STOCK.has(m.movement_type)
      if (isFlakon) flakonBalance = Math.max(0, flakonBalance + (isIn ? m.quantity : -m.quantity))
      else balance = Math.max(0, balance + (isIn ? m.quantity : -m.quantity))
      const row: StockCardRow = {
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
        inQty: isIn ? m.quantity : 0,
        outQty: !isIn ? m.quantity : 0,
        balance,
        flakonBalance,
      }
      productRows.push(row)
      if (isFlakon) lastFlakonRow = row
      else lastPaketRow = row
    }

    const real = productQuantities.get(pid)
    if (real) {
      if (lastPaketRow) lastPaketRow.balance = real.current_quantity
      if (lastFlakonRow) lastFlakonRow.flakonBalance = real.flakon_quantity
    }
    rows.push(...productRows)
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
