import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete } from '@/lib/offlineMutation'
import type { Region } from '@/types/database'

export async function fetchRegions(): Promise<Region[]> {
  const { data, error } = await supabase.from('regions').select('*').order('name')
  if (error) throw error
  return data as Region[]
}

export interface RegionInput {
  name: string
  parent_region_id?: string | null
}

export async function createRegion(input: RegionInput): Promise<Region> {
  return offlineInsert<Region>('regions', { ...input }, `Bölge: ${input.name}`)
}

export async function deleteRegion(id: string): Promise<void> {
  return offlineDelete('regions', id, 'Bölge silme')
}
