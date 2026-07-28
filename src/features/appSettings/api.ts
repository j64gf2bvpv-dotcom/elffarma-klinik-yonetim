import { supabase } from '@/lib/supabaseClient'

export async function fetchAppSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (error) {
    // app_settings tablosu henüz Supabase'de oluşturulmadıysa (migration çalıştırılmadan önce)
    // sessizce varsayılana düş, kullanıcıyı hata bildirimiyle rahatsız etme.
    if (error.code === 'PGRST205') return null
    throw error
  }
  return (data?.value as T) ?? null
}

export async function saveAppSetting<T>(key: string, value: T): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}
