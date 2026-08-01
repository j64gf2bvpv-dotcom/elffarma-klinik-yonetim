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

export interface SalesRepUpdateInput {
  name?: string
  photo_url?: string | null
}

export async function updateSalesRep(id: string, input: SalesRepUpdateInput): Promise<SalesRep> {
  return offlineUpdate<SalesRep>('sales_reps', id, { ...input }, 'Satış temsilcisi güncelleme')
}

/**
 * profile-images bucket'ı PUBLIC (bkz. congresses/api.ts uploadCongressImage
 * ile aynı bucket, farklı path prefix'i) — temsilci fotoğrafı gizli belge
 * değil, kalıcı bir public URL alınıp sales_reps.photo_url'e yazılıyor.
 */
export async function uploadSalesRepPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `sales-rep/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('profile-images').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('profile-images').getPublicUrl(path)
  return data.publicUrl
}

export async function setSalesRepActive(id: string, is_active: boolean): Promise<void> {
  await offlineUpdate('sales_reps', id, { is_active }, 'Satış temsilcisi durumu güncelleme')
}

export async function deleteSalesRep(id: string): Promise<void> {
  return offlineDelete('sales_reps', id, 'Satış temsilcisi silme')
}
