import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { DoctorVisit } from '@shared/types/database'

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
  const userId = await getCurrentUserId()
  return offlineInsert<DoctorVisit>('doctor_visits', {
    ...input,
    sales_rep_id: userId,
  }, `Ziyaret: ${input.doctor_name}`)
}

export async function deleteVisit(id: string): Promise<void> {
  return offlineDelete('doctor_visits', id, 'Doktor ziyareti silme')
}
