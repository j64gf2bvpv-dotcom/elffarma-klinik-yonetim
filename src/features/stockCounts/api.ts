import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, getCurrentUserId } from '@/lib/offlineMutation'
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
 * "Sistemdeki Miktar" artık salt okunur — sayım başladığındaki donmuş bir
 * anlık görüntü değil, HER ZAMAN products.current_quantity/flakon_quantity'nin
 * canlı halini gösterir (bkz. fetchCountItems'ın products join'i). Sayımı
 * Tamamla da bu yüzden karşılaştırmayı expected_quantity yerine sayım anında
 * TEKRAR çekilen (fetchCountItems) canlı ürün stoğuna göre yapıyor — kullanıcı
 * amacı basit: canlı stoğu gör, yanına say, farkı depoya uygula.
 *
 * 'adjustment' hareket tipiyle imzalı (negatif olabilen) diff göndermek,
 * record_stock_movement RPC'sinin stock_movements.quantity'ye HER ZAMAN abs()
 * uygulaması yüzünden Stok Kartı defterinde işareti kaybediyordu — negatif
 * farklar (sayımda eksik çıkan stok) ledger'da artış gibi görünüyordu. Bunun
 * yerine in/out + mutlak değer kullanmak işareti hem gerçek stokta hem
 * denetim kaydında doğru tutar.
 */
export async function completeCount(stockCountId: string): Promise<void> {
  const items = await fetchCountItems(stockCountId)
  for (const item of items) {
    if (item.counted_quantity != null) {
      const diff = item.counted_quantity - item.products.current_quantity
      if (diff !== 0) {
        await recordStockMovement({
          product_id: item.product_id,
          movement_type: diff > 0 ? 'in' : 'out',
          quantity: Math.abs(diff),
          reason: 'Günlük sayım',
          note: `Paket — Sistemdeki: ${item.products.current_quantity}, Sayılan: ${item.counted_quantity}`,
          unit_kind: 'paket',
        })
      }
    }
    if (item.counted_quantity_flakon != null) {
      const diffFlakon = item.counted_quantity_flakon - item.products.flakon_quantity
      if (diffFlakon !== 0) {
        await recordStockMovement({
          product_id: item.product_id,
          movement_type: diffFlakon > 0 ? 'in' : 'out',
          quantity: Math.abs(diffFlakon),
          reason: 'Günlük sayım',
          note: `Flakon — Sistemdeki: ${item.products.flakon_quantity}, Sayılan: ${item.counted_quantity_flakon}`,
          unit_kind: 'flakon',
        })
      }
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
