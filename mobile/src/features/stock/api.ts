// Masaüstündeki src/features/stock/api.ts'in Faz 1 alt kümesi — ürün listesi
// (okuma) + record_stock_movement RPC'si (CLAUDE.md kuralı: current_quantity'ye
// ASLA doğrudan yazılmaz, her zaman bu RPC üzerinden). Ürün oluşturma/
// düzenleme, lot/barkod yönetimi Faz 2+'ya bırakıldı.
import { supabase } from '@/lib/supabaseClient'
import { offlineRpc } from '@/lib/offlineMutation'
import type { BrandLine, MovementType, Product } from '@shared/types/database'

export async function fetchProducts(search: string, brandLine?: BrandLine): Promise<Product[]> {
  let query = supabase.from('products').select('*').eq('is_active', true).order('name')
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
  if (brandLine) query = query.eq('brand_line', brandLine)
  const { data, error } = await query
  if (error) throw error
  return data as Product[]
}

export interface RecordMovementInput {
  product_id: string
  movement_type: MovementType
  quantity: number
  reason?: string | null
  customer_id?: string | null
  note?: string | null
  lot_id?: string | null
  unit_price?: number | null
}

export async function recordStockMovement(input: RecordMovementInput): Promise<void> {
  return offlineRpc(
    'record_stock_movement',
    {
      p_product_id: input.product_id,
      p_movement_type: input.movement_type,
      p_quantity: input.quantity,
      p_reason: input.reason ?? null,
      p_customer_id: input.customer_id ?? null,
      p_note: input.note ?? null,
      p_lot_id: input.lot_id ?? null,
      p_unit_price: input.unit_price ?? null,
    },
    `Stok hareketi: ${input.movement_type} × ${input.quantity}`,
  )
}
