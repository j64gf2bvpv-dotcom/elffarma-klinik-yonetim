import { supabase } from '@/lib/supabaseClient'
import type { SalesRep } from '@shared/types/database'

export async function fetchSalesReps(): Promise<SalesRep[]> {
  const { data, error } = await supabase.from('sales_reps').select('*').order('name', { ascending: true })
  if (error) throw error
  return data as SalesRep[]
}
