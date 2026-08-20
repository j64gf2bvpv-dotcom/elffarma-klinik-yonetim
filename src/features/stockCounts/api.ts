import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { Product, StockCount, StockCountItem } from '@/types/database'

export type StockCountItemWithProduct = StockCountItem & {
  products: Pick<Product, 'name' | 'unit' | 'brand_line' | 'current_quantity' | 'flakon_quantity'>
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
    .select('*, products(name, unit, brand_line, current_quantity, flakon_quantity)')
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
    .select('id, current_quantity, flakon_quantity')
    .eq('is_active', true)
  if (productsError) throw productsError

  if (products && products.length > 0) {
    const items = products.map((p) => ({
      stock_count_id: count.id,
      product_id: p.id,
      expected_quantity: p.current_quantity,
      expected_quantity_flakon: p.flakon_quantity,
    }))
    const { error: itemsError } = await supabase.from('stock_count_items').insert(items)
    if (itemsError) throw itemsError
  }

  return count
}

/** Sayım başladıktan sonra unutulan/yanlışlıkla dahil edilmiş (ör. örnek/demo
 * ürünler) bir kalemi tek tek eklemek/çıkarmak için — `startTodayCount` tüm
 * aktif ürünleri toplu ekliyor ama sayım açıkken liste elle de düzenlenebilsin. */
export async function addCountItem(stockCountId: string, product: Pick<Product, 'id' | 'current_quantity' | 'flakon_quantity'>): Promise<void> {
  await offlineInsert(
    'stock_count_items',
    {
      stock_count_id: stockCountId,
      product_id: product.id,
      expected_quantity: product.current_quantity,
      expected_quantity_flakon: product.flakon_quantity,
    },
    'Sayıma ürün ekleme',
  )
}

export async function deleteCountItem(id: string): Promise<void> {
  await offlineDelete('stock_count_items', id, 'Sayımdan ürün çıkarma')
}

export async function updateCountItem(id: string, counted_quantity: number | null): Promise<void> {
  await offlineUpdate('stock_count_items', id, { counted_quantity }, 'Sayım kalemi güncelleme (paket)')
}

export async function updateCountItemFlakon(id: string, counted_quantity_flakon: number | null): Promise<void> {
  await offlineUpdate(
    'stock_count_items',
    id,
    { counted_quantity_flakon },
    'Sayım kalemi güncelleme (flakon)',
  )
}

/**
 * "Sistemdeki Miktar" salt okunur — sayım başladığındaki donmuş bir anlık
 * görüntü değil, HER ZAMAN products.current_quantity/flakon_quantity'nin
 * canlı halini gösterir (bkz. fetchCountItems'ın products join'i).
 *
 * Paket/Flakon Sayımı kutusu bir YENİDEN SAYIM (recount) değil, o gün
 * EKLENEN miktarı ifade eder — "Son Stok" = Sistemdeki + Sayım (bkz.
 * DailyCountPanel'deki aynı toplama mantığı). Bu yüzden Sayımı Tamamla,
 * girilen her pozitif değeri doğrudan bir 'in' (giriş) hareketi olarak
 * kaydeder — eski sürümdeki "sayılanla sistemdeki arasındaki farkı uygula"
 * mantığı (recount semantiği) artık geçerli değil.
 */
export async function completeCount(stockCountId: string): Promise<void> {
  const items = await fetchCountItems(stockCountId)
  for (const item of items) {
    if (item.counted_quantity != null && item.counted_quantity > 0) {
      await recordStockMovement({
        product_id: item.product_id,
        movement_type: 'in',
        quantity: item.counted_quantity,
        reason: 'Günlük sayım',
        note: `Paket eklendi — Sistemdeki: ${item.products.current_quantity}, Eklenen: ${item.counted_quantity}`,
        unit_kind: 'paket',
      })
    }
    if (item.counted_quantity_flakon != null && item.counted_quantity_flakon > 0) {
      await recordStockMovement({
        product_id: item.product_id,
        movement_type: 'in',
        quantity: item.counted_quantity_flakon,
        reason: 'Günlük sayım',
        note: `Flakon eklendi — Sistemdeki: ${item.products.flakon_quantity}, Eklenen: ${item.counted_quantity_flakon}`,
        unit_kind: 'flakon',
      })
    }
  }
  await offlineUpdate(
    'stock_counts',
    stockCountId,
    { status: 'completed', completed_at: new Date().toISOString() },
    'Sayımı tamamlama',
  )
}

export async function reopenCount(stockCountId: string): Promise<void> {
  await offlineUpdate('stock_counts', stockCountId, { status: 'open', completed_at: null }, 'Sayımı yeniden açma')
}
