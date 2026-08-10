// Masaüstündeki src/features/regions/ portu — regions tablosu (hiyerarşik,
// parent_region_id) zaten şemada ve shared tiplerde var, şema değişikliği
// gerekmiyor. Mobilde sadece okuma + doktor listesini bölgeye göre filtreleme
// için kullanılıyor; bölge oluşturma/silme masaüstünde kalıyor (yönetimsel iş).
import { supabase } from '@/lib/supabaseClient'
import type { Region } from '@shared/types/database'

export async function fetchRegions(): Promise<Region[]> {
  const { data, error } = await supabase.from('regions').select('*').order('name')
  if (error) throw error
  return data as Region[]
}
