import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert, getCurrentUserId } from '@/lib/offlineMutation'
import type { BudgetTarget } from '@/types/database'

export async function fetchBudgetTargets(year: number): Promise<BudgetTarget[]> {
  const { data, error } = await supabase
    .from('budget_targets')
    .select('*')
    .eq('year', year)
    .order('month', { ascending: true })
  if (error) throw error
  return data as BudgetTarget[]
}

export async function saveBudgetTarget(
  year: number,
  month: number,
  targetRevenue: number,
): Promise<BudgetTarget> {
  const createdBy = await getCurrentUserId()
  return offlineUpsert<BudgetTarget>(
    'budget_targets',
    { year, month, target_revenue: targetRevenue, created_by: createdBy, updated_at: new Date().toISOString() },
    `Bütçe hedefi: ${year}-${month}`,
    'year,month',
  )
}
