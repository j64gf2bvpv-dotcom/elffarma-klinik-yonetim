import { supabase } from '@/lib/supabaseClient'
import { offlineUpdate } from '@/lib/offlineMutation'
import type { Staff } from '@shared/types/database'

export async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase.from('staff').select('*').order('full_name', { ascending: true })
  if (error) throw error
  return data as Staff[]
}

export async function updateStaff(id: string, patch: Partial<Pick<Staff, 'role' | 'is_active' | 'full_name' | 'phone'>>): Promise<Staff> {
  return offlineUpdate<Staff>('staff', id, patch, 'Personel güncelleme')
}
