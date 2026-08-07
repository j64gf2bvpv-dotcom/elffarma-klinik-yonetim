import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { CrmOpportunity, CrmOpportunityStage } from '@shared/types/database'

export interface OpportunityWithCustomer extends CrmOpportunity {
  customer_name: string
}

export interface CreateOpportunityInput {
  customer_id: string
  title: string
  stage?: CrmOpportunityStage
  amount?: number | null
  expected_close_date?: string | null
  sales_rep_id?: string | null
  notes?: string | null
}

export async function fetchOpportunities(stage?: CrmOpportunityStage | 'all'): Promise<OpportunityWithCustomer[]> {
  let query = supabase
    .from('crm_opportunities')
    .select('*, customers(full_name)')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (stage && stage !== 'all') query = query.eq('stage', stage)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    customer_name: (r as { customers?: { full_name: string | null } }).customers?.full_name ?? 'Bilinmeyen',
  })) as OpportunityWithCustomer[]
}

export async function createOpportunity(input: CreateOpportunityInput): Promise<CrmOpportunity> {
  const userId = await getCurrentUserId()
  return offlineInsert<CrmOpportunity>('crm_opportunities', {
    customer_id: input.customer_id,
    title: input.title,
    stage: input.stage ?? 'yeni',
    amount: input.amount ?? null,
    expected_close_date: input.expected_close_date ?? null,
    sales_rep_id: input.sales_rep_id ?? null,
    notes: input.notes ?? null,
    created_by: userId,
  }, `Fırsat: ${input.title}`)
}

export async function updateOpportunity(id: string, patch: Partial<Pick<CrmOpportunity, 'stage' | 'amount' | 'expected_close_date' | 'notes' | 'title'>>): Promise<CrmOpportunity> {
  return offlineUpdate<CrmOpportunity>('crm_opportunities', id, patch, 'Fırsat güncelleme')
}

export async function deleteOpportunity(id: string): Promise<void> {
  return offlineDelete('crm_opportunities', id, 'Fırsat silme')
}
