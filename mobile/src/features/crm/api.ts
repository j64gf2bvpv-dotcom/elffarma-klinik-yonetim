// Masaüstündeki src/features/crm/api.ts'in Faz 1 alt kümesi — mobil
// "Aktiviteler" ekranı için sadece okuma (fırsat/oluşturma masaüstünde kalıyor).
import { supabase } from '@/lib/supabaseClient'
import type { CrmActivity } from '@shared/types/database'

export type CrmActivityWithCustomer = CrmActivity & {
  customers: { full_name: string } | null
}

export async function fetchCrmActivities(): Promise<CrmActivityWithCustomer[]> {
  const { data, error } = await supabase
    .from('crm_activities')
    .select('*, customers(full_name)')
    .order('occurred_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as unknown as CrmActivityWithCustomer[]
}
