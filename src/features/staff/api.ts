import { supabase } from '@/lib/supabaseClient'
import { offlineUpdate } from '@/lib/offlineMutation'
import type { Staff, StaffRole } from '@/types/database'

export async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase.from('staff').select('*').order('created_at')
  if (error) throw error
  return data as Staff[]
}

export async function updateStaff(
  id: string,
  input: Partial<Pick<Staff, 'role' | 'is_active' | 'full_name' | 'phone'>>,
): Promise<Staff> {
  return offlineUpdate<Staff>('staff', id, { ...input }, 'Personel güncelleme')
}

export type { StaffRole }
