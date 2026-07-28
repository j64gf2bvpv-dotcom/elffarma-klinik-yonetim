import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineRpc } from '@/lib/offlineMutation'
import type { BrandLine, MovementType, Product, StockMovement } from '@/types/database'

export interface ProductInput {
  name: string
  sku?: string | null
  category?: string | null
  unit: string
  critical_stock_threshold: number
  unit_cost?: number | null
  unit_price?: number | null
  campaign?: string | null
  expiry_date?: string | null
  barcode?: string | null
  brand_line?: BrandLine | null
  image_url?: string | null
}

export async function fetchProducts(search: string, brandLine?: BrandLine): Promise<Product[]> {
  let query = supabase.from('products').select('*').eq('is_active', true).order('name')
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
  if (brandLine) query = query.eq('brand_line', brandLine)
  const { data, error } = await query
  if (error) throw error
  return data as Product[]
}

export async function createProduct(input: ProductInput): Promise<Product> {
  return offlineInsert<Product>('products', { ...input, current_quantity: 0 }, `Ürün: ${input.name}`)
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  return offlineUpdate<Product>('products', id, { ...input }, `Ürün güncelleme: ${input.name}`)
}

export async function deactivateProduct(id: string): Promise<void> {
  await offlineUpdate('products', id, { is_active: false }, 'Ürün kaldırma')
}

export type StockMovementWithStaff = StockMovement & {
  staff: { full_name: string } | null
  customers: { full_name: string } | null
}

export async function fetchStockMovements(productId: string): Promise<StockMovementWithStaff[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, staff(full_name), customers(full_name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as unknown as StockMovementWithStaff[]
}

export interface RecordMovementInput {
  product_id: string
  movement_type: MovementType
  quantity: number
  reason?: string | null
  customer_id?: string | null
  note?: string | null
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
    },
    `Stok hareketi: ${input.movement_type} × ${input.quantity}`,
  )
}
