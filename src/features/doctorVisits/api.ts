import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { DoctorVisit } from '@/types/database'

export interface DoctorVisitInput {
  visit_date: string
  doctor_name: string
  phone?: string | null
  email?: string | null
  social_media?: string | null
  notes?: string | null
  sales_rep_id: string
}

export async function fetchVisitsInRange(from: string, to: string, salesRepId?: string): Promise<DoctorVisit[]> {
  let query = supabase
    .from('doctor_visits')
    .select('*')
    .gte('visit_date', from)
    .lte('visit_date', to)
    .order('visit_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (salesRepId) query = query.eq('sales_rep_id', salesRepId)
  const { data, error } = await query
  if (error) throw error
  return data as DoctorVisit[]
}

/**
 * doctor_visits'te henüz customer_id FK'si yok (doctor_name serbest metin) — doktor
 * detay sayfasının ZİYARETLER sekmesi bu yüzden isim eşleştirmesiyle çalışır.
 */
export async function fetchVisitsByDoctorName(doctorName: string): Promise<DoctorVisit[]> {
  const { data, error } = await supabase
    .from('doctor_visits')
    .select('*')
    .eq('doctor_name', doctorName)
    .order('visit_date', { ascending: false })
  if (error) throw error
  return data as DoctorVisit[]
}

export async function createVisit(input: DoctorVisitInput): Promise<DoctorVisit> {
  return offlineInsert<DoctorVisit>('doctor_visits', { ...input }, `Doktor ziyareti: ${input.doctor_name}`)
}

export async function updateVisit(id: string, input: DoctorVisitInput): Promise<DoctorVisit> {
  return offlineUpdate<DoctorVisit>('doctor_visits', id, { ...input }, `Doktor ziyareti güncelleme: ${input.doctor_name}`)
}

export async function deleteVisit(id: string): Promise<void> {
  return offlineDelete('doctor_visits', id, 'Doktor ziyareti silme')
}
