import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { CongressShipment } from '@/types/database'

export type CongressShipmentWithCongress = CongressShipment & {
  congresses: { name: string; start_date: string | null; end_date: string | null } | null
}

export async function fetchCongressShipments(): Promise<CongressShipmentWithCongress[]> {
  const { data, error } = await supabase
    .from('congress_shipments')
    .select('*, congresses(name, start_date, end_date)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as CongressShipmentWithCongress[]
}

export interface CongressShipmentInput {
  congress_id: string
  product_id: string
  product_name: string
  quantity_taken: number
  quantity_returned_sealed?: number
  quantity_returned_open?: number
  note?: string | null
}

export async function createCongressShipment(input: CongressShipmentInput): Promise<CongressShipment> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<CongressShipment>(
    'congress_shipments',
    { ...input, created_by: createdBy },
    `Kongre/workshop sevkiyatı: ${input.product_name}`,
  )
}

export async function updateCongressShipmentReturns(
  id: string,
  returns: { quantity_returned_sealed: number; quantity_returned_open: number },
): Promise<CongressShipment> {
  return offlineUpdate<CongressShipment>('congress_shipments', id, returns, 'Kongre/workshop dönüş miktarı güncelleme')
}

export async function updateCongressShipment(id: string, input: CongressShipmentInput): Promise<CongressShipment> {
  return offlineUpdate<CongressShipment>(
    'congress_shipments',
    id,
    { ...input },
    `Kongre/workshop sevkiyatı düzenleme: ${input.product_name}`,
  )
}

export async function deleteCongressShipment(id: string): Promise<void> {
  return offlineDelete('congress_shipments', id, 'Kongre/workshop sevkiyat kaydı silme')
}
