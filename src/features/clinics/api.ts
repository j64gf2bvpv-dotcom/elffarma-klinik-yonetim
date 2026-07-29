import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Clinic } from '@/types/database'

export interface ClinicInput {
  name: string
  authorized_persons?: string | null
  address?: string | null
  phone?: string | null
  tax_office?: string | null
  tax_number?: string | null
  employee_count?: number | null
  branch_count?: number | null
  sales_rep_id?: string | null
  region_id?: string | null
  category?: string | null
  is_vip: boolean
  risk_limit?: number | null
  discount_rate?: number | null
  payment_method?: string | null
  working_days: string[]
  maps_url?: string | null
  notes?: string | null
}

export async function fetchClinics(search = ''): Promise<Clinic[]> {
  let query = supabase.from('clinics').select('*').order('name', { ascending: true })
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
  const { data, error } = await query
  if (error) throw error
  return data as Clinic[]
}

export async function fetchClinic(id: string): Promise<Clinic> {
  const { data, error } = await supabase.from('clinics').select('*').eq('id', id).single()
  if (error) throw error
  return data as Clinic
}

export async function createClinic(input: ClinicInput): Promise<Clinic> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Clinic>('clinics', { ...input, created_by: createdBy }, `Klinik: ${input.name}`)
}

export async function updateClinic(id: string, input: ClinicInput): Promise<Clinic> {
  return offlineUpdate<Clinic>('clinics', id, { ...input }, `Klinik güncelleme: ${input.name}`)
}

export async function deleteClinic(id: string): Promise<void> {
  return offlineDelete('clinics', id, 'Klinik silme')
}
