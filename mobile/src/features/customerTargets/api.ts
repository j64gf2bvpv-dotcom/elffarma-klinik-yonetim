// customer_revenue_targets — doktor bazında aylık ciro hedefi (schema.sql
// "44. CUSTOMER_REVENUE_TARGETS"). Masaüstünde zaten var, mobilde ilk kez
// kullanılıyor (Doktor Detay > CRM Özeti, gocust'un "Q1 Target" kart
// öğesinden ilham — kendi tasarım dilimizle, veri gerçek). Gerçekleşen
// tutar burada tutulmaz, DoctorDetailScreen zaten hesapladığı totalSales'i
// kullanır.
import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert, getCurrentUserId } from '@/lib/offlineMutation'
import type { CustomerRevenueTarget } from '@shared/types/database'

export async function fetchCustomerTarget(customerId: string, year: number, month: number): Promise<CustomerRevenueTarget | null> {
  const { data, error } = await supabase
    .from('customer_revenue_targets')
    .select('*')
    .eq('customer_id', customerId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  return data as CustomerRevenueTarget | null
}

export async function upsertCustomerTarget(customerId: string, year: number, month: number, targetRevenue: number): Promise<CustomerRevenueTarget> {
  const userId = await getCurrentUserId()
  return offlineUpsert<CustomerRevenueTarget>(
    'customer_revenue_targets',
    { customer_id: customerId, year, month, target_revenue: targetRevenue, created_by: userId },
    'Doktor aylık hedefi',
    'customer_id,year,month',
  )
}
