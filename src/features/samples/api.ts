import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { recordStockMovement } from '@/features/stock/api'
import type { SampleItem, SampleRequest, SampleRequestStatus } from '@/types/database'

export type SampleItemWithProduct = SampleItem & { products: { name: string } | null }

export type SampleRequestWithRelations = SampleRequest & {
  customers: { full_name: string } | null
  sales_reps: { name: string } | null
  sample_items: SampleItemWithProduct[]
}

export interface SampleRequestFilters {
  customerId?: string
}

export async function fetchSampleRequests(filters: SampleRequestFilters = {}): Promise<SampleRequestWithRelations[]> {
  let query = supabase
    .from('sample_requests')
    .select('*, customers(full_name), sales_reps(name), sample_items(*, products(name))')
    .order('request_date', { ascending: false })
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as SampleRequestWithRelations[]
}

export interface SampleItemInput {
  product_id: string
  lot_no?: string | null
  expiry_date?: string | null
  quantity: number
  unit_price: number
}

export interface SampleRequestInput {
  customer_id: string
  sales_rep_id?: string | null
  request_date: string
  note?: string | null
  items: SampleItemInput[]
}

export async function createSampleRequest(input: SampleRequestInput): Promise<SampleRequest> {
  const createdBy = await getCurrentUserId()
  const request = await offlineInsert<SampleRequest>(
    'sample_requests',
    {
      customer_id: input.customer_id,
      sales_rep_id: input.sales_rep_id ?? null,
      request_date: input.request_date,
      note: input.note ?? null,
      created_by: createdBy,
    },
    'Numune talebi',
  )

  for (const item of input.items) {
    await offlineInsert(
      'sample_items',
      { sample_request_id: request.id, ...item },
      `Numune ürünü: ${item.product_id}`,
    )
    await recordStockMovement({
      product_id: item.product_id,
      movement_type: 'sample',
      quantity: item.quantity,
      reason: 'Numune',
      customer_id: input.customer_id,
      note: `Numune talebi #${request.id}`,
    })
  }

  return request
}

export interface SampleRequestStatusInput {
  status: SampleRequestStatus
  tracking_number?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  delivered_to?: string | null
}

export async function updateSampleRequestStatus(id: string, input: SampleRequestStatusInput): Promise<SampleRequest> {
  return offlineUpdate<SampleRequest>('sample_requests', id, { ...input }, 'Numune talebi durumu güncelleme')
}

export async function deleteSampleRequest(id: string): Promise<void> {
  return offlineDelete('sample_requests', id, 'Numune talebi silme')
}
