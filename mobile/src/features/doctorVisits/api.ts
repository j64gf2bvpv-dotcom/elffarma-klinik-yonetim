import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, offlineUpdate, getCurrentUserId } from '@/lib/offlineMutation'
import type { DoctorVisit } from '@shared/types/database'

// doctor_visits.sales_rep_id, staff(id)'e değil sales_reps(id)'ye FK'lı
// (bkz. supabase/schema.sql "doctor_visits_sales_rep_id_fkey") — staff↔
// sales_reps arasında FK yok, sadece isim eşleşmesi (uygulamanın her
// yerinde aynı desen: TargetsScreen, DoctorsListScreen "Benim Doktorlarım").
// Giriş yapan personelin auth id'sini doğrudan buraya yazmak (eski davranış)
// FK ihlaline (23503) yol açıp "Ziyarete Başla"yı kalıcı olarak
// kırıyordu — eşleşen bir sales_reps kaydı yoksa null yazılır, uydurma id
// kullanılmaz.
async function resolveSalesRepId(): Promise<string | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null
  const { data: staffRow } = await supabase.from('staff').select('full_name').eq('id', userId).maybeSingle()
  const fullName = staffRow?.full_name?.trim().toLowerCase()
  if (!fullName) return null
  const { data: reps } = await supabase.from('sales_reps').select('id, name')
  const match = reps?.find((r) => r.name.trim().toLowerCase() === fullName)
  return match?.id ?? null
}

export interface CreateVisitInput {
  doctor_name: string
  phone?: string | null
  email?: string | null
  notes?: string | null
  customer_id?: string | null
  visit_date: string
  next_visit_date?: string | null
  discussed_products?: string | null
  competitor_products?: string | null
}

export async function fetchVisits(from?: string, to?: string): Promise<DoctorVisit[]> {
  let query = supabase.from('doctor_visits').select('*').order('visit_date', { ascending: false }).limit(100)
  if (from) query = query.gte('visit_date', from)
  if (to) query = query.lte('visit_date', to)
  const { data, error } = await query
  if (error) throw error
  return data as DoctorVisit[]
}

export async function createVisit(input: CreateVisitInput): Promise<DoctorVisit> {
  const salesRepId = await resolveSalesRepId()
  return offlineInsert<DoctorVisit>('doctor_visits', {
    ...input,
    sales_rep_id: salesRepId,
  }, `Ziyaret: ${input.doctor_name}`)
}

export async function checkInVisit(id: string, coords?: { lat: number; lng: number }): Promise<DoctorVisit> {
  return offlineUpdate<DoctorVisit>('doctor_visits', id, {
    check_in_at: new Date().toISOString(),
    check_out_at: null,
    check_in_lat: coords?.lat ?? null,
    check_in_lng: coords?.lng ?? null,
  }, 'Ziyaret check-in')
}

export interface CompleteVisitInput {
  notes?: string | null
  discussed_products?: string | null
  next_visit_date?: string | null
}

export async function checkOutVisit(id: string, completion?: CompleteVisitInput): Promise<DoctorVisit> {
  return offlineUpdate<DoctorVisit>('doctor_visits', id, {
    check_out_at: new Date().toISOString(),
    ...(completion ?? {}),
  }, 'Ziyaret check-out')
}

/** Doktor kartından "Ziyaret Başlat" ile açılan akış — customer_id zorunlu,
 * doktor adı customer'dan otomatik dolar (serbest metin girişi yok). */
export async function startVisitForCustomer(customerId: string, doctorName: string): Promise<DoctorVisit> {
  const salesRepId = await resolveSalesRepId()
  return offlineInsert<DoctorVisit>('doctor_visits', {
    customer_id: customerId,
    doctor_name: doctorName,
    visit_date: new Date().toISOString().slice(0, 10),
    sales_rep_id: salesRepId,
  }, `Ziyaret: ${doctorName}`)
}

export async function deleteVisit(id: string): Promise<void> {
  return offlineDelete('doctor_visits', id, 'Doktor ziyareti silme')
}
