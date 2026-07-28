import { supabase } from '@/lib/supabaseClient'
import { offlineUpdate } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { Product, StockCount, StockCountItem } from '@/types/database'

export type StockCountItemWithProduct = StockCountItem & { products: Pick<Product, 'name' | 'unit'> }

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
    .select('*, products(name, unit)')
    .eq('stock_count_id', stockCountId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as StockCountItemWithProduct[]
}

export async function startTodayCount(): Promise<StockCount> {
  const { data: userData } = await supabase.auth.getUser()
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, current_quantity')
    .eq('is_active', true)
  if (productsError) throw productsError

  const { data: count, error: countError } = await supabase
    .from('stock_counts')
    .insert({ count_date: todayDate(), created_by: userData.user?.id })
    .select()
    .single()
  if (countError) throw countError

  if (products && products.length > 0) {
    const items = products.map((p) => ({
      stock_count_id: count.id,
      product_id: p.id,
      expected_quantity: p.current_quantity,
    }))
    const { error: itemsError } = await supabase.from('stock_count_items').insert(items)
    if (itemsError) throw itemsError
  }

  return count as StockCount
}

export async function updateCountItem(id: string, counted_quantity: number | null): Promise<void> {
  await offlineUpdate('stock_count_items', id, { counted_quantity }, 'Sayım kalemi güncelleme')
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
  const { error } = await supabase
    .from('stock_counts')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', stockCountId)
  if (error) throw error
}
