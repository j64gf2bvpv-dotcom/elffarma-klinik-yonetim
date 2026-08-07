import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert, getCurrentUserId } from '@/lib/offlineMutation'
import type { CustomerRevenueTarget } from '@/types/database'

export async function fetchCustomerRevenueTargets(customerId: string): Promise<CustomerRevenueTarget[]> {
  const { data, error } = await supabase
    .from('customer_revenue_targets')
    .select('*')
    .eq('customer_id', customerId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data as CustomerRevenueTarget[]
}

export async function saveCustomerRevenueTarget(
  customerId: string,
  year: number,
  month: number,
  targetRevenue: number,
): Promise<CustomerRevenueTarget> {
  const createdBy = await getCurrentUserId()
  return offlineUpsert<CustomerRevenueTarget>(
    'customer_revenue_targets',
    {
      customer_id: customerId,
      year,
      month,
      target_revenue: targetRevenue,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    },
    `Doktor hedefi: ${customerId} ${year}-${month}`,
    'customer_id,year,month',
  )
}
