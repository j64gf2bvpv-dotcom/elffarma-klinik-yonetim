import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Sale, SaleStatus } from '@shared/types/database'

export interface SaleWithCustomer extends Sale {
  customers: { full_name: string } | null
}

export interface CreateSaleInput {
  type: 'sale' | 'return'
  customer_id: string
  product_id?: string | null
  product_name: string
  quantity: number
  unit_price: number
  sale_date: string
  note?: string | null
  status?: SaleStatus
}

export async function fetchSales(): Promise<SaleWithCustomer[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customers(full_name)')
    .order('sale_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return data as unknown as SaleWithCustomer[]
}

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const userId = await getCurrentUserId()
  return offlineInsert<Sale>('sales', { ...input, created_by: userId }, `Satış: ${input.product_name}`)
}

export type UpdateSaleInput = Partial<
  Pick<CreateSaleInput, 'type' | 'product_id' | 'product_name' | 'quantity' | 'unit_price' | 'note' | 'status'>
>

export async function updateSale(id: string, patch: UpdateSaleInput): Promise<Sale> {
  return offlineUpdate<Sale>('sales', id, patch, 'Sipariş güncelleme')
}

export async function deleteSale(id: string): Promise<void> {
  return offlineDelete('sales', id, 'Sipariş silme')
}
