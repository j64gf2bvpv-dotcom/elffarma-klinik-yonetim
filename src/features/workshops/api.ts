import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Workshop, WorkshopParticipant, WorkshopProduct } from '@/types/database'

export interface WorkshopInput {
  name: string
  congress_id?: string | null
  workshop_date?: string | null
  location?: string | null
  notes?: string | null
  cost?: number | null
}

export type WorkshopWithCongress = Workshop & { congresses: { name: string } | null }

export async function fetchWorkshops(): Promise<WorkshopWithCongress[]> {
  const { data, error } = await supabase
    .from('workshops')
    .select('*, congresses(name)')
    .order('workshop_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data as unknown as WorkshopWithCongress[]
}

export async function fetchWorkshop(id: string): Promise<Workshop> {
  const { data, error } = await supabase.from('workshops').select('*').eq('id', id).single()
  if (error) throw error
  return data as Workshop
}

export async function createWorkshop(input: WorkshopInput): Promise<Workshop> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Workshop>('workshops', { ...input, created_by: createdBy }, `Workshop: ${input.name}`)
}

export async function updateWorkshop(id: string, input: WorkshopInput): Promise<Workshop> {
  return offlineUpdate<Workshop>('workshops', id, { ...input }, `Workshop güncelleme: ${input.name}`)
}

export async function deleteWorkshop(id: string): Promise<void> {
  return offlineDelete('workshops', id, 'Workshop silme')
}

export interface WorkshopParticipantInput {
  workshop_id: string
  customer_id: string
  notes?: string | null
}

export type WorkshopProductWithRep = WorkshopProduct & {
  sales_reps: { name: string } | null
  products: { name: string; unit: string } | null
}

export type WorkshopParticipantWithProducts = WorkshopParticipant & {
  customers: { full_name: string } | null
  workshop_products: WorkshopProductWithRep[]
}

export async function fetchWorkshopParticipants(workshopId: string): Promise<WorkshopParticipantWithProducts[]> {
  const { data, error } = await supabase
    .from('workshop_participants')
    .select('*, customers(full_name), workshop_products(*, sales_reps(name), products(name, unit))')
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as WorkshopParticipantWithProducts[]
}

export type WorkshopParticipantWithWorkshop = WorkshopParticipant & {
  workshops: { name: string; workshop_date: string | null } | null
}

export async function fetchWorkshopParticipationsByCustomer(customerId: string): Promise<WorkshopParticipantWithWorkshop[]> {
  const { data, error } = await supabase
    .from('workshop_participants')
    .select('*, workshops(name, workshop_date)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as WorkshopParticipantWithWorkshop[]
}

export async function createWorkshopParticipant(input: WorkshopParticipantInput): Promise<WorkshopParticipant> {
  return offlineInsert<WorkshopParticipant>('workshop_participants', { ...input }, 'Workshop katılımcısı')
}

export async function deleteWorkshopParticipant(id: string): Promise<void> {
  return offlineDelete('workshop_participants', id, 'Workshop katılımcısı silme')
}

export interface WorkshopProductInput {
  workshop_id: string
  participant_id?: string | null
  product_id: string
  quantity: number
  unit_price: number
  sales_rep_id?: string | null
}

export async function createWorkshopProduct(input: WorkshopProductInput): Promise<WorkshopProduct> {
  return offlineInsert<WorkshopProduct>('workshop_products', { ...input }, 'Workshop ürünü')
}

export async function deleteWorkshopProduct(id: string): Promise<void> {
  return offlineDelete('workshop_products', id, 'Workshop ürünü silme')
}
