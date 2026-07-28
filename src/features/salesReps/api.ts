import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { SalesRep } from '@/types/database'

export async function fetchSalesReps(): Promise<SalesRep[]> {
  const { data, error } = await supabase.from('sales_reps').select('*').order('name')
  if (error) throw error
  return data as SalesRep[]
}

export async function createSalesRep(name: string): Promise<SalesRep> {
  return offlineInsert<SalesRep>('sales_reps', { name }, `Satış temsilcisi: ${name}`)
}

export async function setSalesRepActive(id: string, is_active: boolean): Promise<void> {
  await offlineUpdate('sales_reps', id, { is_active }, 'Satış temsilcisi durumu güncelleme')
}

export async function deleteSalesRep(id: string): Promise<void> {
  return offlineDelete('sales_reps', id, 'Satış temsilcisi silme')
}
