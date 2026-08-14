import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert, getCurrentUserId } from '@/lib/offlineMutation'
import type { StaffPreferences } from '@/types/database'

/**
 * Ana Panel görünüm/kart düzeni tercihi — app_settings'teki (paylaşımlı,
 * admin-write/staff-read) dashboard_view/dashboard_layout'un aksine, bu
 * KİŞİSEL: her kullanıcı kendi satırını okur/yazar (RLS: staff_id = auth.uid()).
 * Satır yoksa (henüz hiç kaydedilmemişse) null döner — çağıran taraf bunu
 * "varsayılan görünüm" olarak yorumlamalı.
 */
export async function fetchMyPreferences(): Promise<StaffPreferences | null> {
  const staffId = await getCurrentUserId()
  if (!staffId) return null
  const { data, error } = await supabase.from('staff_preferences').select('*').eq('staff_id', staffId).maybeSingle()
  if (error) throw error
  return data as StaffPreferences | null
}

export async function saveMyPreferences(
  input: Partial<Pick<StaffPreferences, 'dashboard_view' | 'dashboard_layout' | 'color_mode'>>,
): Promise<StaffPreferences> {
  const staffId = await getCurrentUserId()
  if (!staffId) throw new Error('Oturum bulunamadı')
  return offlineUpsert<StaffPreferences>(
    'staff_preferences',
    { staff_id: staffId, ...input, updated_at: new Date().toISOString() },
    'Kişisel panel tercihi',
    'staff_id',
  )
}
