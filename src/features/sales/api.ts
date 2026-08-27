import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineRpc, getCurrentUserId } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { Sale, SaleType } from '@/types/database'

export interface SaleInput {
  type: SaleType
  customer_id: string
  sales_rep_id?: string | null
  product_id?: string | null
  product_name: string
  quantity: number
  unit_price: number
  sale_date: string
  note?: string | null
  congress_name?: string | null
  /** Uygulanacak stok hareketinin denetim kaydındaki notu — verilmezse product_name kullanılır. */
  movement_note?: string
}

export type SaleWithRelations = Sale & {
  customers: { full_name: string } | null
  sales_reps: { name: string } | null
}

export interface SaleFilters {
  from?: string
  to?: string
}

export async function fetchSales(filters: SaleFilters = {}): Promise<SaleWithRelations[]> {
  let query = supabase
    .from('sales')
    .select('*, customers(full_name), sales_reps(name)')
    .order('sale_date', { ascending: false })
  if (filters.from) query = query.gte('sale_date', filters.from)
  if (filters.to) query = query.lte('sale_date', filters.to)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as SaleWithRelations[]
}

/**
 * Kaydın kendisine ek olarak gerçek bir stok hareketi de uygular — satış
 * stoktan düşer, iade stoğa eklenir. Önceden bu, api.ts değil ÇAĞIRAN taraf
 * (SaleForm.tsx, CustomerForm.tsx) tarafından ayrıca yapılıyordu; buraya
 * taşınıp merkezîleştirildi (kullanıcı isteği, 2026-08-25: "satışlar iadeler
 * stokla bağlantılı çalışmalı" — çağıran tarafların HER İKİSİ de zaten
 * kendileri hareketi tetikliyordu, mükerrer uygulamayı önlemek için oradaki
 * ayrı çağrılar kaldırıldı, bkz. o dosyalardaki commit). Silme/iptal tarafı
 * (SalesPage.tsx handleDelete, DailyCountPanel.tsx handleCancel) bunun
 * TERSİNİ uyguluyor.
 */
export async function createSale(input: SaleInput): Promise<Sale> {
  const createdBy = await getCurrentUserId()
  // movement_note istemci-tarafı bir alan — sales tablosunda karşılığı yok,
  // insert payload'ına dahil edilmemeli (dahil edilirse "Could not find the
  // 'movement_note' column of 'sales'" hatasıyla kayıt tamamen başarısız
  // oluyordu, kullanıcı isteği/hata raporu, 2026-08-26).
  const { movement_note, ...saleRow } = input
  const sale = await offlineInsert<Sale>(
    'sales',
    { ...saleRow, created_by: createdBy },
    `${input.type === 'sale' ? 'Satış' : 'İade'}: ${input.product_name}`,
  )
  if (input.product_id) {
    await recordStockMovement({
      product_id: input.product_id,
      movement_type: input.type === 'sale' ? 'out' : 'in',
      quantity: input.quantity,
      reason: input.type === 'sale' ? 'Satış' : 'İade',
      customer_id: input.customer_id,
      unit_price: input.unit_price,
      note: movement_note ?? input.product_name,
    })
  }
  return sale
}

export async function updateSaleRep(id: string, salesRepId: string | null): Promise<Sale> {
  return offlineUpdate<Sale>('sales', id, { sales_rep_id: salesRepId }, 'Satış/iade temsilcisini değiştirme')
}

/**
 * Kaydı siler ve stok etkisini tersine çevirir — `delete_sale` RPC'si
 * (sunucu tarafında) bunu guard'sız, 0'a kenetlenen bir hareketle yapar,
 * böylece stok ARADAN GEÇEN ZAMANDA başka hareketlerle tükenmiş olsa bile
 * silme asla "yetersiz stok" diye reddedilmez (kullanıcı isteği, 2026-08-25:
 * "satışta iade olan kısmındaki ürünü silmiyor hata veriyor"). Önceden bu
 * tersine çevirme çağıran tarafta (SalesPage.tsx, DailyCountPanel.tsx) ayrı
 * bir record_stock_movement çağrısıyla yapılıyordu — buraya taşındı.
 */
export async function deleteSale(id: string): Promise<void> {
  return offlineRpc('delete_sale', { p_sale_id: id }, 'Satış kaydı silme')
}

/** "Tümünü Sil" — kullanıcı isteği, 2026-08-25. */
export async function deleteAllSales(reason: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_all_sales', { p_reason: reason })
  if (error) throw error
  return data ?? 0
}
