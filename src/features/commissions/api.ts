import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { CommissionAdjustment, CommissionAdjustmentType, CommissionBasis, CommissionRule, CommissionScopeType } from '@/types/database'

export interface CommissionRuleInput {
  name: string
  scope_type: CommissionScopeType
  scope_value?: string | null
  basis: CommissionBasis
  rate_percent: number
  is_active: boolean
}

export async function fetchCommissionRules(): Promise<CommissionRule[]> {
  const { data, error } = await supabase.from('commission_rules').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as CommissionRule[]
}

export async function createCommissionRule(input: CommissionRuleInput): Promise<CommissionRule> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<CommissionRule>(
    'commission_rules',
    { ...input, created_by: createdBy },
    `Prim kuralı: ${input.name}`,
  )
}

export async function updateCommissionRule(id: string, input: CommissionRuleInput): Promise<CommissionRule> {
  return offlineUpdate<CommissionRule>('commission_rules', id, { ...input }, `Prim kuralı güncelleme: ${input.name}`)
}

export async function deleteCommissionRule(id: string): Promise<void> {
  return offlineDelete('commission_rules', id, 'Prim kuralı silme')
}

export interface CommissionAdjustmentInput {
  sales_rep_id: string
  adjustment_type: CommissionAdjustmentType
  amount: number
  period_start: string
  period_end: string
  note?: string | null
}

export type AdjustmentWithRep = CommissionAdjustment & { sales_reps: { name: string } | null }

export async function fetchCommissionAdjustments(from: string, to: string): Promise<AdjustmentWithRep[]> {
  const { data, error } = await supabase
    .from('commission_adjustments')
    .select('*, sales_reps(name)')
    .lte('period_start', to)
    .gte('period_end', from)
    .order('period_start', { ascending: false })
  if (error) throw error
  return data as unknown as AdjustmentWithRep[]
}

export async function createCommissionAdjustment(input: CommissionAdjustmentInput): Promise<CommissionAdjustment> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<CommissionAdjustment>(
    'commission_adjustments',
    { ...input, created_by: createdBy },
    `Prim ${input.adjustment_type === 'bonus' ? 'bonusu' : 'cezası'}: ${input.amount} TL`,
  )
}

export async function deleteCommissionAdjustment(id: string): Promise<void> {
  return offlineDelete('commission_adjustments', id, 'Prim düzeltmesi silme')
}
