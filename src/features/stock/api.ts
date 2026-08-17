import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineRpc } from '@/lib/offlineMutation'
import type { BrandLine, MovementType, Product, ProductCatalog, ProductLot, StockMovement, StockUnitKind } from '@/types/database'

export async function fetchProductCatalogs(): Promise<ProductCatalog[]> {
  const { data, error } = await supabase.from('product_catalogs').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return data as ProductCatalog[]
}

export async function createProductCatalog(name: string, sortOrder: number): Promise<ProductCatalog> {
  return offlineInsert<ProductCatalog>('product_catalogs', { name, sort_order: sortOrder }, `Katalog: ${name}`)
}

export interface ProductInput {
  name: string
  sku?: string | null
  category?: string | null
  unit: string
  critical_stock_threshold: number
  /** Paket içinde kaç flakon var (opsiyonel) — boş bırakılırsa bu üründe flakon takibi kullanılmaz. */
  flakon_per_package?: number | null
  unit_cost?: number | null
  unit_price?: number | null
  campaign?: string | null
  expiry_date?: string | null
  barcode?: string | null
  brand_line?: BrandLine | null
  image_url?: string | null
}

export async function fetchProducts(search: string, brandLine?: BrandLine): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name')
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
  if (brandLine) query = query.eq('brand_line', brandLine)
  const { data, error } = await query
  if (error) throw error
  return data as Product[]
}

/**
 * Ürünler tablosunda sürükle-bırak sıralama — her satır için yeni sort_order
 * değerini tek tek yazıyor (Supabase'te tek istekte "farklı satıra farklı
 * değer" upsert'i product'ın DİĞER tüm alanlarını da göndermeyi gerektirirdi,
 * bu yüzden CLAUDE.md'deki offline-yazma desenine uyan basit bir döngü tercih
 * edildi — tipik bir marka listesindeki ürün sayısı için maliyeti önemsiz).
 */
export async function reorderProducts(updates: { id: string; sort_order: number }[]): Promise<void> {
  for (const u of updates) {
    await offlineUpdate('products', u.id, { sort_order: u.sort_order }, 'Ürün sırası güncelleme')
  }
}

export async function createProduct(input: ProductInput): Promise<Product> {
  return offlineInsert<Product>(
    'products',
    { ...input, current_quantity: 0, flakon_quantity: 0 },
    `Ürün: ${input.name}`,
  )
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  return offlineUpdate<Product>('products', id, { ...input }, `Ürün güncelleme: ${input.name}`)
}

export async function updateProductCampaign(id: string, campaign: string | null): Promise<Product> {
  return offlineUpdate<Product>('products', id, { campaign }, `Kampanya güncelleme`)
}

export async function updateProductCategory(id: string, category: string | null): Promise<Product> {
  return offlineUpdate<Product>('products', id, { category }, `Kategori güncelleme`)
}

export async function updateProductPrice(id: string, unit_price: number | null): Promise<Product> {
  return offlineUpdate<Product>('products', id, { unit_price }, `Satış fiyatı güncelleme`)
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

export type StockMovementWithProduct = StockMovementWithStaff & { products: { name: string; sku: string | null } | null }

/**
 * Stok Kartı raporu için TÜM ürünlerin hareket geçmişi — `fetchStockMovements`
 * (tek ürün, 50 kayıt sınırlı geçmiş dialogu) ile karıştırılmasın. Burada
 * limit yok ve `products` ilişkisi de geliyor çünkü Tüm Ürünler modunda hangi
 * hareketin hangi ürüne ait olduğu gösteriliyor.
 */
export async function fetchAllStockMovements(): Promise<StockMovementWithProduct[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, staff(full_name), customers(full_name), products(name, sku)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as StockMovementWithProduct[]
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
  /** Varsayılan 'paket' — flakon oranı tanımlı bir üründe otomatik orantılı senkron. 'flakon' verilirse sadece flakon sayacı değişir, paket ve parti etkilenmez. */
  unit_kind?: StockUnitKind
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
      p_unit_kind: input.unit_kind ?? 'paket',
    },
    `Stok hareketi: ${input.movement_type} × ${input.quantity}`,
  )
}

export interface UpdateMovementInput extends RecordMovementInput {
  id: string
}

/**
 * Var olan bir stok hareketini düzenler — eski etkiyi geri alıp yeni etkiyi
 * uygulayarak products.current_quantity'yi senkron tutan `update_stock_movement`
 * RPC'sini çağırır (bkz. schema.sql böl. 41). Doğrudan tabloya update YAPILMAZ,
 * aksi halde current_quantity denetim kaydından sapar.
 */
export async function updateStockMovement(input: UpdateMovementInput): Promise<void> {
  return offlineRpc(
    'update_stock_movement',
    {
      p_movement_id: input.id,
      p_movement_type: input.movement_type,
      p_quantity: input.quantity,
      p_reason: input.reason ?? null,
      p_customer_id: input.customer_id ?? null,
      p_note: input.note ?? null,
      p_lot_id: input.lot_id ?? null,
      p_unit_price: input.unit_price ?? null,
      p_unit_kind: input.unit_kind ?? 'paket',
    },
    `Stok hareketi güncelleme: ${input.movement_type} × ${input.quantity}`,
  )
}

export async function deleteStockMovement(id: string): Promise<void> {
  return offlineRpc('delete_stock_movement', { p_movement_id: id }, 'Stok hareketi silme')
}

export async function fetchProductLots(productId: string): Promise<ProductLot[]> {
  const { data, error } = await supabase
    .from('product_lots')
    .select('*')
    .eq('product_id', productId)
    .order('expiry_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as ProductLot[]
}

export interface ProductLotInput {
  product_id: string
  lot_no?: string | null
  barcode?: string | null
  qr_code?: string | null
  production_date?: string | null
  expiry_date?: string | null
  warehouse?: string | null
  shelf?: string | null
  supplier?: string | null
}

export async function createProductLot(input: ProductLotInput): Promise<ProductLot> {
  return offlineInsert<ProductLot>('product_lots', { ...input, quantity: 0 }, `Lot: ${input.lot_no ?? input.product_id}`)
}

export type ProductLotWithProduct = ProductLot & { products: { name: string } | null }

export async function fetchAllProductLots(): Promise<ProductLotWithProduct[]> {
  const { data, error } = await supabase
    .from('product_lots')
    .select('*, products(name)')
    .order('expiry_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as unknown as ProductLotWithProduct[]
}
