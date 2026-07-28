import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type {
  Congress,
  CongressParticipant,
  CongressParticipantProduct,
  CongressRemainingProduct,
} from '@/types/database'

export interface CongressInput {
  name: string
  start_date?: string | null
  end_date?: string | null
  notes?: string | null
  will_attend?: boolean
  single_person_price?: number | null
  two_person_price?: number | null
  image_url?: string | null
}

export async function fetchCongresses(): Promise<Congress[]> {
  const { data, error } = await supabase
    .from('congresses')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data as Congress[]
}

export async function fetchCongress(id: string): Promise<Congress> {
  const { data, error } = await supabase.from('congresses').select('*').eq('id', id).single()
  if (error) throw error
  return data as Congress
}

export async function createCongress(input: CongressInput): Promise<Congress> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Congress>('congresses', { ...input, created_by: createdBy }, `Kongre: ${input.name}`)
}

export async function updateCongress(id: string, input: CongressInput): Promise<Congress> {
  return offlineUpdate<Congress>('congresses', id, { ...input }, `Kongre güncelleme: ${input.name}`)
}

export async function deleteCongress(id: string): Promise<void> {
  return offlineDelete('congresses', id, 'Kongre silme')
}

export interface ParticipantInput {
  congress_id: string
  doctor_name: string
  flight_cost: number
  registration_cost: number
  accommodation_cost: number
  notes?: string | null
}

export type ParticipantProductWithRep = CongressParticipantProduct & { sales_reps: { name: string } | null }

export type ParticipantWithProducts = CongressParticipant & {
  congress_participant_products: ParticipantProductWithRep[]
}

export async function fetchParticipants(congressId: string): Promise<ParticipantWithProducts[]> {
  const { data, error } = await supabase
    .from('congress_participants')
    .select('*, congress_participant_products(*, sales_reps(name))')
    .eq('congress_id', congressId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as ParticipantWithProducts[]
}

export async function createParticipant(input: ParticipantInput): Promise<CongressParticipant> {
  return offlineInsert<CongressParticipant>(
    'congress_participants',
    { ...input },
    `Kongre katılımcısı: ${input.doctor_name}`,
  )
}

export async function updateParticipant(
  id: string,
  input: Omit<ParticipantInput, 'congress_id'>,
): Promise<CongressParticipant> {
  return offlineUpdate<CongressParticipant>(
    'congress_participants',
    id,
    { ...input },
    `Katılımcı güncelleme: ${input.doctor_name}`,
  )
}

export async function deleteParticipant(id: string): Promise<void> {
  return offlineDelete('congress_participants', id, 'Katılımcı silme')
}

export interface ParticipantProductInput {
  participant_id: string
  product_name: string
  quantity: number
  unit_price: number
  sales_rep_id?: string | null
}

export async function createParticipantProduct(
  input: ParticipantProductInput,
): Promise<CongressParticipantProduct> {
  return offlineInsert<CongressParticipantProduct>(
    'congress_participant_products',
    { ...input },
    `Kongre ürünü: ${input.product_name}`,
  )
}

export async function deleteParticipantProduct(id: string): Promise<void> {
  return offlineDelete('congress_participant_products', id, 'Kongre ürünü silme')
}

export type ParticipantProductSaleRow = CongressParticipantProduct & {
  sales_reps: { name: string } | null
  congress_participants: { doctor_name: string } | null
}

export async function fetchAllParticipantProductSales(): Promise<ParticipantProductSaleRow[]> {
  const { data, error } = await supabase
    .from('congress_participant_products')
    .select('*, sales_reps(name), congress_participants(doctor_name)')
    .not('sales_rep_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as ParticipantProductSaleRow[]
}

export interface RemainingProductInput {
  congress_id: string
  product_name: string
  quantity: number
  unit_price: number
}

export async function fetchRemainingProducts(congressId: string): Promise<CongressRemainingProduct[]> {
  const { data, error } = await supabase
    .from('congress_remaining_products')
    .select('*')
    .eq('congress_id', congressId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as CongressRemainingProduct[]
}

export async function createRemainingProduct(input: RemainingProductInput): Promise<CongressRemainingProduct> {
  return offlineInsert<CongressRemainingProduct>(
    'congress_remaining_products',
    { ...input },
    `Kalan ürün: ${input.product_name}`,
  )
}

export async function deleteRemainingProduct(id: string): Promise<void> {
  return offlineDelete('congress_remaining_products', id, 'Kalan ürün silme')
}

