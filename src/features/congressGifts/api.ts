import { supabase } from '@/lib/supabaseClient'
import { offlineDelete, offlineInsert, offlineUpdate } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { CongressGivenProduct } from '@/types/database'

export async function fetchCongressGivenProducts(): Promise<CongressGivenProduct[]> {
  const { data, error } = await supabase
    .from('congress_given_products')
    .select('*')
    .order('congress_name', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CongressGivenProduct[]
}

export type CongressGivenInput = Omit<
  CongressGivenProduct,
  'id' | 'created_by' | 'created_at' | 'updated_at' | 'stock_deducted_quantity' | 'stock_deducted_at'
>

export async function createCongressGivenProduct(input: CongressGivenInput): Promise<CongressGivenProduct> {
  return offlineInsert<CongressGivenProduct>(
    'congress_given_products',
    { ...input },
    `Kongre ürünü: ${input.doctor_name} — ${input.product_name}`,
  )
}

export async function updateCongressGivenProduct(
  id: string,
  patch: Partial<CongressGivenInput>,
): Promise<CongressGivenProduct> {
  return offlineUpdate<CongressGivenProduct>('congress_given_products', id, { ...patch }, 'Kongre ürünü güncelleme')
}

export async function deleteCongressGivenProduct(id: string): Promise<void> {
  return offlineDelete('congress_given_products', id, 'Kongre ürünü silme')
}

/** Stoktan düşülecek adet: teslim edilenden henüz düşülmemiş kısım. */
export function pendingDeduct(r: CongressGivenProduct): number {
  return Math.max(0, r.delivered_quantity - r.stock_deducted_quantity)
}

/**
 * Teslim edilenden henüz düşülmemiş adedi stoktan düşer ve kaydı işaretler — aynı ürün iki kez düşülmez,
 * sonradan teslim adedi artarsa yalnız farkı düşer.
 */
export async function deductCongressGivenProduct(r: CongressGivenProduct, productId: string): Promise<number> {
  const qty = pendingDeduct(r)
  if (qty <= 0) return 0
  await recordStockMovement({
    product_id: productId,
    movement_type: 'out',
    quantity: qty,
    reason: `Kongre — hocaya verilen (${r.congress_name})`,
    customer_id: r.customer_id,
    note: [r.doctor_name, r.description].filter(Boolean).join(' · '),
  })
  await offlineUpdate<CongressGivenProduct>(
    'congress_given_products',
    r.id,
    { product_id: productId, stock_deducted_quantity: r.stock_deducted_quantity + qty, stock_deducted_at: new Date().toISOString() },
    'Kongre ürünü stoktan düşüldü',
  )
  return qty
}
