import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { SampleRequest, SampleItem, SampleRequestStatus } from '@shared/types/database'

export interface SampleRequestWithCustomer extends SampleRequest {
  customer_name: string
  items: SampleItem[]
}

export interface CreateSampleRequestInput {
  customer_id: string
  sales_rep_id?: string | null
  note?: string | null
}

export async function fetchSampleRequests(): Promise<SampleRequestWithCustomer[]> {
  const { data, error } = await supabase
    .from('sample_requests')
    .select('*, customers(full_name), sample_items(*)')
    .order('request_date', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    customer_name: (r as { customers?: { full_name: string | null } }).customers?.full_name ?? 'Bilinmeyen',
    items: (r as { sample_items?: SampleItem[] }).sample_items ?? [],
  })) as SampleRequestWithCustomer[]
}

export async function createSampleRequest(input: CreateSampleRequestInput): Promise<SampleRequest> {
  const userId = await getCurrentUserId()
  return offlineInsert<SampleRequest>('sample_requests', {
    customer_id: input.customer_id,
    sales_rep_id: input.sales_rep_id ?? null,
    note: input.note ?? null,
    created_by: userId,
  }, 'Numune talebi')
}

export async function updateSampleRequestStatus(id: string, status: SampleRequestStatus, extra?: { tracking_number?: string; shipped_at?: string; delivered_at?: string; delivered_to?: string }): Promise<SampleRequest> {
  return offlineUpdate<SampleRequest>('sample_requests', id, { status, ...extra }, 'Numune durumu güncelleme')
}

export async function deleteSampleRequest(id: string): Promise<void> {
  return offlineDelete('sample_requests', id, 'Numune talebi silme')
}
