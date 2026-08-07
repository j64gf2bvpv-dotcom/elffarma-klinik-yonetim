import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert } from '@/lib/offlineMutation'
import type { AppSetting } from '@shared/types/database'

export async function fetchAppSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return (data as AppSetting<T> | null)?.value ?? null
}

export async function saveAppSetting<T>(key: string, value: T): Promise<void> {
  await offlineUpsert<AppSetting<T>>('app_settings', { key, value, updated_at: new Date().toISOString() }, `Ayar: ${key}`, 'key')
}
