import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, getCurrentUserId } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { Product, StockCount, StockCountItem } from '@/types/database'

export type StockCountItemWithProduct = StockCountItem & {
  products: Pick<Product, 'name' | 'unit' | 'brand_line'>
}

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export async function fetchTodayCount(): Promise<StockCount | null> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('count_date', todayDate())
    .maybeSingle()
  if (error) throw error
  return data as StockCount | null
}

export async function fetchPastCounts(): Promise<StockCount[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .order('count_date', { ascending: false })
    .limit(30)
  if (error) throw error
  return data as StockCount[]
}

export async function fetchCountItems(stockCountId: string): Promise<StockCountItemWithProduct[]> {
  const { data, error } = await supabase
    .from('stock_count_items')
    .select('*, products(name, unit, brand_line)')
    .eq('stock_count_id', stockCountId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as StockCountItemWithProduct[]
}

export async function startTodayCount(): Promise<StockCount> {
  const createdBy = await getCurrentUserId()
  const count = await offlineInsert<StockCount>(
    'stock_counts',
    { count_date: todayDate(), created_by: createdBy },
    'Günlük sayım başlatma',
  )

  // Sayım kalemleri, o anki ürün stoklarının canlı bir okumasına dayanıyor —
  // bu yüzden (AI sohbeti/ayarlar gibi) bağlantı gerektiren makul bir istisna:
  // offline'da anlamlı bir "o anki stok" listesi oluşturulamaz.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, current_quantity')
    .eq('is_active', true)
  if (productsError) throw productsError

  if (products && products.length > 0) {
    const items = products.map((p) => ({
      stock_count_id: count.id,
      product_id: p.id,
      expected_quantity: p.current_quantity,
    }))
    const { error: itemsError } = await supabase.from('stock_count_items').insert(items)
    if (itemsError) throw itemsError
  }

  return count
}

export async function updateCountItem(id: string, counted_quantity: number | null): Promise<void> {
  await offlineUpdate('stock_count_items', id, { counted_quantity }, 'Sayım kalemi güncelleme')
}

/**
 * Günlük Sayım'da "Sistemdeki Miktar" üzerine tıklayıp doğrudan stok ekleme/
 * düşme için — record_stock_movement RPC'siyle ürünün gerçek stoğu güncellenir
 * (CLAUDE.md kuralı: current_quantity'ye asla doğrudan yazılmaz), ardından bu
 * sayım kaleminin expected_quantity'si (o günkü referans miktar) aynı farkla
 * güncellenir ki "Fark" hesaplaması gün sonuna kadar doğru kalsın.
 */
export async function addStockToCountItem(item: StockCountItemWithProduct, diff: number): Promise<void> {
  await recordStockMovement({
    product_id: item.product_id,
    movement_type: diff > 0 ? 'in' : 'out',
    quantity: Math.abs(diff),
    reason: 'Günlük sayım — stok ekleme',
  })
  await offlineUpdate(
    'stock_count_items',
    item.id,
    { expected_quantity: item.expected_quantity + diff },
    'Sayım kalemi stok ekleme',
  )
}

export async function completeCount(stockCountId: string): Promise<void> {
  const items = await fetchCountItems(stockCountId)
  for (const item of items) {
    if (item.counted_quantity == null) continue
    const diff = item.counted_quantity - item.expected_quantity
    if (diff === 0) continue
    await recordStockMovement({
      product_id: item.product_id,
      movement_type: 'adjustment',
      quantity: diff,
      reason: 'Günlük sayım',
      note: `Beklenen: ${item.expected_quantity}, Sayılan: ${item.counted_quantity}`,
    })
  }
  await offlineUpdate(
    'stock_counts',
    stockCountId,
    { status: 'completed', completed_at: new Date().toISOString() },
    'Sayımı tamamlama',
  )
}

/** Tamamlanmış bir sayımı düzenlemeye açmak için — "Sistemdeki Miktar" üzerinden
 * stok eklemek gibi işlemler sadece 'open' durumundaki sayımlarda çalışır. */
export async function reopenCount(stockCountId: string): Promise<void> {
  await offlineUpdate('stock_counts', stockCountId, { status: 'open', completed_at: null }, 'Sayımı yeniden açma')
}
