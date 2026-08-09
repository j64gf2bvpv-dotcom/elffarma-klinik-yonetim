import { supabase } from '@/lib/supabaseClient'
import { offlineUpdate } from '@/lib/offlineMutation'
import type { SalesRep } from '@shared/types/database'

export async function fetchSalesReps(): Promise<SalesRep[]> {
  const { data, error } = await supabase.from('sales_reps').select('*').order('name', { ascending: true })
  if (error) throw error
  return data as SalesRep[]
}

export async function updateSalesRepTarget(id: string, target: number): Promise<SalesRep> {
  return offlineUpdate<SalesRep>('sales_reps', id, { sales_target: target }, 'Temsilci hedef güncelleme')
}
