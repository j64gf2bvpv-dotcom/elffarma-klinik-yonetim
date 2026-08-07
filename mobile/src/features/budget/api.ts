import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert } from '@/lib/offlineMutation'
import type { BudgetTarget } from '@shared/types/database'

export async function fetchCurrentMonthTarget(): Promise<number | null> {
  const now = new Date()
  const { data, error } = await supabase
    .from('budget_targets')
    .select('target_revenue')
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .maybeSingle()
  if (error) throw error
  return data ? Number(data.target_revenue) : null
}

export async function fetchBudgetTargets(year?: number): Promise<BudgetTarget[]> {
  let query = supabase.from('budget_targets').select('*').order('year', { ascending: false }).order('month', { ascending: false })
  if (year) query = query.eq('year', year)
  const { data, error } = await query
  if (error) throw error
  return data as BudgetTarget[]
}

export async function saveBudgetTarget(year: number, month: number, targetRevenue: number): Promise<BudgetTarget> {
  return offlineUpsert<BudgetTarget>(
    'budget_targets',
    { year, month, target_revenue: targetRevenue },
    `Bütçe hedefi ${year}-${month}`,
    'year,month',
  )
}
