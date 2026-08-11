import { supabase } from '@/lib/supabaseClient'

/**
 * `app_settings`'in admin-only-select karşılığı — `admin_secrets` tablosu
 * gerçek sırlar (ör. Google servis hesabı private_key'i) tutabildiği için
 * RLS'i select dahil sadece admin'e açık (bkz. schema.sql bölüm 52).
 */
export async function fetchAdminSecret<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from('admin_secrets').select('value').eq('key', key).maybeSingle()
  if (error) {
    if (error.code === 'PGRST205') return null
    throw error
  }
  return (data?.value as T) ?? null
}

export async function saveAdminSecret<T>(key: string, value: T): Promise<void> {
  const { error } = await supabase.from('admin_secrets').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}
