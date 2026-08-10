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

export interface StockMovementWithDetails {
  id: string
  product_id: string
  movement_type: MovementType
  quantity: number
  customer_id: string | null
  staff_id: string | null
  note: string | null
  created_at: string
  product_name: string
  customer_name: string | null
}

/** Haftalık Rapor ekranı için — bir personelin bir tarih aralığında verdiği
 * numuneleri (veya istenen hareket tiplerini) ürün+doktor adıyla getirir. */
export async function fetchStockMovements(filters: {
  staffId: string
  from: string
  to: string
  movementTypes?: MovementType[]
}): Promise<StockMovementWithDetails[]> {
  let query = supabase
    .from('stock_movements')
    .select('*, products(name), customers(full_name)')
    .eq('staff_id', filters.staffId)
    .gte('created_at', filters.from)
    .lte('created_at', filters.to)
    .order('created_at', { ascending: true })
  if (filters.movementTypes?.length) query = query.in('movement_type', filters.movementTypes)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string
      product_id: string
      movement_type: MovementType
      quantity: number
      customer_id: string | null
      staff_id: string | null
      note: string | null
      created_at: string
      products?: { name: string } | null
      customers?: { full_name: string } | null
    }
    return {
      id: row.id,
      product_id: row.product_id,
      movement_type: row.movement_type,
      quantity: row.quantity,
      customer_id: row.customer_id,
      staff_id: row.staff_id,
      note: row.note,
      created_at: row.created_at,
      product_name: row.products?.name ?? 'Bilinmeyen ürün',
      customer_name: row.customers?.full_name ?? null,
    }
  })
}
