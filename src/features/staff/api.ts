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

/** Ayarlar > Profilim'den kendi kartvizit bilgilerini güncellemek için —
 * `full_name` bilerek burada YOK: `protect_staff_privileged_columns`
 * trigger'ı admin olmayan bir güncellemede bunu sessizce eski değerine geri
 * çeviriyor (bkz. schema.sql böl. 48), UI de bu yüzden staff için salt okunur
 * gösteriyor. */
export async function updateMyProfile(
  id: string,
  input: Partial<
    Pick<Staff, 'phone' | 'avatar_url' | 'job_title' | 'email' | 'address' | 'whatsapp_phone' | 'social_media'>
  >,
): Promise<Staff> {
  return offlineUpdate<Staff>('staff', id, { ...input }, 'Profil güncelleme')
}

/** `profile-images` bucket'ı public — dosya adı çakışmasın diye zaman damgalı,
 * `staff/` alt yoluna (congress/sales-rep prefix'leriyle aynı desen) yüklenir. */
export async function uploadStaffAvatar(staffId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `staff/${staffId}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('profile-images').getPublicUrl(path)
  return data.publicUrl
}

export type { StaffRole }
