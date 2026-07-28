import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { Warehouse } from '@/types/database'

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase.from('warehouses').select('*').order('name')
  if (error) throw error
  return data as Warehouse[]
}

export async function createWarehouse(name: string): Promise<Warehouse> {
  return offlineInsert<Warehouse>('warehouses', { name }, `Depo: ${name}`)
}

export async function setWarehouseActive(id: string, is_active: boolean): Promise<void> {
  await offlineUpdate('warehouses', id, { is_active }, 'Depo durumu güncelleme')
}

export async function deleteWarehouse(id: string): Promise<void> {
  return offlineDelete('warehouses', id, 'Depo silme')
}
