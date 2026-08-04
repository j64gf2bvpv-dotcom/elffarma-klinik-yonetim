import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { resizeImageFile } from '@/lib/resizeImage'
import type {
  AttendanceStatus,
  Congress,
  CongressChecklistItem,
  CongressParticipant,
  CongressParticipantProduct,
  CongressRemainingProduct,
  CongressStockItem,
  CongressStockItemStatus,
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
  city?: string | null
  venue?: string | null
  hotel?: string | null
  capacity?: number | null
  sponsorship_info?: string | null
  speakers?: string | null
  trainers?: string | null
  meal_plan?: string | null
  transfer_info?: string | null
  stand_info?: string | null
  budget?: number | null
  campaign_info?: string | null
  video_urls?: string[]
}

/**
 * profile-images bucket'ı PUBLIC (invoices/documents'ın aksine) — kongre/
 * workshop görselleri gizli belge değil, tanıtım görseli olduğu için imzalı
 * URL yerine doğrudan kalıcı bir public URL alınıp congresses.image_url'e
 * yazılıyor. Yüklenen görsel, çözünürlüğü/boyutu ne olursa olsun önce
 * resizeImageFile ile küçük bir JPEG'e indirgeniyor (büyük orijinal
 * dosyaları olduğu gibi Storage'a atmamak için).
 */
export async function uploadCongressImage(file: File): Promise<string> {
  const resized = await resizeImageFile(file)
  const path = `congress/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('profile-images').upload(path, resized, {
    contentType: 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from('profile-images').getPublicUrl(path)
  return data.publicUrl
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
  attendance_status?: AttendanceStatus
  certificate_issued?: boolean
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

export type ParticipationWithCongress = CongressParticipant & { congresses: { name: string; start_date: string | null } | null }

/**
 * congress_participants doktora customer_id FK'si ile değil doctor_name serbest metniyle
 * bağlı (henüz FK'ye geçirilmedi) — doktor detay sayfasının KONGRELER sekmesi bu yüzden
 * isim eşleştirmesiyle çalışır.
 */
export async function fetchParticipationsByDoctorName(doctorName: string): Promise<ParticipationWithCongress[]> {
  const { data, error } = await supabase
    .from('congress_participants')
    .select('*, congresses(name, start_date)')
    .eq('doctor_name', doctorName)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as ParticipationWithCongress[]
}

export async function createParticipant(input: ParticipantInput): Promise<CongressParticipant> {
  return offlineInsert<CongressParticipant>(
    'congress_participants',
    { ...input, qr_code: crypto.randomUUID() },
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

export async function fetchChecklistItems(congressId: string): Promise<CongressChecklistItem[]> {
  const { data, error } = await supabase
    .from('congress_checklist_items')
    .select('*')
    .eq('congress_id', congressId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as CongressChecklistItem[]
}

export async function createChecklistItem(congressId: string, label: string): Promise<CongressChecklistItem> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<CongressChecklistItem>(
    'congress_checklist_items',
    { congress_id: congressId, label, created_by: createdBy },
    `Kontrol listesi: ${label}`,
  )
}

export async function createChecklistItemsBulk(congressId: string, labels: string[]): Promise<CongressChecklistItem[]> {
  const createdBy = await getCurrentUserId()
  const created: CongressChecklistItem[] = []
  for (const label of labels) {
    created.push(
      await offlineInsert<CongressChecklistItem>(
        'congress_checklist_items',
        { congress_id: congressId, label, created_by: createdBy },
        `Kontrol listesi: ${label}`,
      ),
    )
  }
  return created
}

export async function fetchAllChecklistItems(): Promise<CongressChecklistItem[]> {
  const { data, error } = await supabase.from('congress_checklist_items').select('*')
  if (error) throw error
  return data as CongressChecklistItem[]
}

export async function setChecklistItemDone(id: string, is_done: boolean): Promise<void> {
  await offlineUpdate('congress_checklist_items', id, { is_done }, 'Kontrol listesi öğesi güncelleme')
}

export async function deleteChecklistItem(id: string): Promise<void> {
  return offlineDelete('congress_checklist_items', id, 'Kontrol listesi öğesi silme')
}

export interface CongressStockItemInput {
  congress_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number | null
  note?: string | null
}

export async function fetchCongressStockItems(congressId: string): Promise<CongressStockItem[]> {
  const { data, error } = await supabase
    .from('congress_stock_items')
    .select('*')
    .eq('congress_id', congressId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as CongressStockItem[]
}

export type CongressStockItemWithCongress = CongressStockItem & {
  congresses: { name: string; start_date: string | null; end_date: string | null } | null
}

export async function fetchAllCongressStockItems(): Promise<CongressStockItemWithCongress[]> {
  const { data, error } = await supabase
    .from('congress_stock_items')
    .select('*, congresses(name, start_date, end_date)')
  if (error) throw error
  return data as unknown as CongressStockItemWithCongress[]
}

export async function createCongressStockItem(input: CongressStockItemInput): Promise<CongressStockItem> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<CongressStockItem>(
    'congress_stock_items',
    { ...input, status: 'goturuldu', created_by: createdBy },
    `Kongre/workshop ürün: ${input.product_name}`,
  )
}

export async function updateCongressStockItemStatus(
  id: string,
  status: CongressStockItemStatus,
): Promise<CongressStockItem> {
  return offlineUpdate<CongressStockItem>('congress_stock_items', id, { status }, 'Ürün durumu güncelleme')
}

export async function deleteCongressStockItem(id: string): Promise<void> {
  return offlineDelete('congress_stock_items', id, 'Kongre/workshop ürün silme')
}

