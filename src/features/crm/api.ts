import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { createReminder } from '@/features/reminders/api'
import type { CrmActivity, CrmActivityType, CrmOpportunity, CrmOpportunityStage } from '@/types/database'

export type CrmActivityWithRelations = CrmActivity & {
  customers: { full_name: string } | null
  sales_reps: { name: string } | null
}

export interface CrmActivityFilters {
  customerId?: string
}

export async function fetchCrmActivities(filters: CrmActivityFilters = {}): Promise<CrmActivityWithRelations[]> {
  let query = supabase
    .from('crm_activities')
    .select('*, customers(full_name), sales_reps(name)')
    .order('occurred_at', { ascending: false })
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as CrmActivityWithRelations[]
}

export interface CrmActivityInput {
  customer_id: string
  activity_type: CrmActivityType
  subject?: string | null
  note?: string | null
  occurred_at: string
  follow_up_date?: string | null
  sales_rep_id?: string | null
}

export async function createCrmActivity(input: CrmActivityInput): Promise<CrmActivity> {
  const createdBy = await getCurrentUserId()
  const activity = await offlineInsert<CrmActivity>(
    'crm_activities',
    { ...input, created_by: createdBy },
    `CRM aktivitesi: ${input.activity_type}`,
  )

  if (input.follow_up_date) {
    await createReminder({
      title: `Takip: ${input.subject || input.activity_type}`,
      note: input.note ?? null,
      due_date: input.follow_up_date,
    })
  }

  return activity
}

export async function deleteCrmActivity(id: string): Promise<void> {
  return offlineDelete('crm_activities', id, 'CRM aktivitesi silme')
}

export type CrmOpportunityWithRelations = CrmOpportunity & {
  customers: { full_name: string } | null
  sales_reps: { name: string } | null
}

export interface CrmOpportunityFilters {
  customerId?: string
}

export async function fetchCrmOpportunities(filters: CrmOpportunityFilters = {}): Promise<CrmOpportunityWithRelations[]> {
  let query = supabase
    .from('crm_opportunities')
    .select('*, customers(full_name), sales_reps(name)')
    .order('created_at', { ascending: false })
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as CrmOpportunityWithRelations[]
}

export interface CrmOpportunityInput {
  customer_id: string
  title: string
  stage: CrmOpportunityStage
  amount?: number | null
  expected_close_date?: string | null
  sales_rep_id?: string | null
  notes?: string | null
}

export async function createCrmOpportunity(input: CrmOpportunityInput): Promise<CrmOpportunity> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<CrmOpportunity>(
    'crm_opportunities',
    { ...input, created_by: createdBy },
    `Fırsat: ${input.title}`,
  )
}

export async function updateCrmOpportunity(id: string, input: CrmOpportunityInput): Promise<CrmOpportunity> {
  return offlineUpdate<CrmOpportunity>('crm_opportunities', id, { ...input }, `Fırsat güncelleme: ${input.title}`)
}

export async function deleteCrmOpportunity(id: string): Promise<void> {
  return offlineDelete('crm_opportunities', id, 'Fırsat silme')
}
