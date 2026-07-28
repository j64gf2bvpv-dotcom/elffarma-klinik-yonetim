import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { Hotel } from '@/types/database'

export async function fetchHotels(): Promise<Hotel[]> {
  const { data, error } = await supabase.from('hotels').select('*').order('name')
  if (error) throw error
  return data as Hotel[]
}

export async function createHotel(name: string): Promise<Hotel> {
  return offlineInsert<Hotel>('hotels', { name }, `Otel: ${name}`)
}

export async function setHotelActive(id: string, is_active: boolean): Promise<void> {
  await offlineUpdate('hotels', id, { is_active }, 'Otel durumu güncelleme')
}

export async function deleteHotel(id: string): Promise<void> {
  return offlineDelete('hotels', id, 'Otel silme')
}
