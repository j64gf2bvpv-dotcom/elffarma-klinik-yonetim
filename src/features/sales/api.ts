import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
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

export async function createSale(input: SaleInput): Promise<Sale> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Sale>(
    'sales',
    { ...input, created_by: createdBy },
    `${input.type === 'sale' ? 'Satış' : 'İade'}: ${input.product_name}`,
  )
}

export async function deleteSale(id: string): Promise<void> {
  return offlineDelete('sales', id, 'Satış kaydı silme')
}
