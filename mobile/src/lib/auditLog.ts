// Master talimat §34'teki Audit Log — her başarılı insert/update/delete/rpc
// için audit_logs'a bir satır düşer (offlineMutation.ts'in dört fonksiyonu +
// useOfflineSync.ts'in kuyruk flush yolu tarafından çağrılır). Kayıt asla
// ana mutasyonu bloklamaz/başarısız kılmaz — audit_logs'a yazma hatası
// sessizce loglanır, kullanıcıya hiçbir zaman görünmez (asıl işlem zaten
// tamamlanmış durumda).
import { supabase } from './supabaseClient'
import type { AuditAction } from '@shared/types/database'

let cachedStaff: { id: string; full_name: string } | null | undefined

async function resolveStaff(): Promise<{ id: string; full_name: string } | null> {
  if (cachedStaff !== undefined) return cachedStaff
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) {
    cachedStaff = null
    return null
  }
  const { data } = await supabase.from('staff').select('id, full_name').eq('id', userId).maybeSingle()
  cachedStaff = data ? { id: data.id, full_name: data.full_name } : null
  return cachedStaff
}

/** Oturum değiştiğinde (giriş/çıkış) önbelleği temizler — RootNavigator'daki
 * session efektinden çağrılmalı, aksi halde bir kullanıcı çıkış yapıp başka
 * biri girdiğinde eski personelin adı loglara yazılmaya devam eder. */
export function resetAuditStaffCache() {
  cachedStaff = undefined
}

export async function recordAuditLog(params: {
  action: AuditAction
  table: string
  recordId?: string | null
  description: string
  payload?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const staff = await resolveStaff()
    await supabase.from('audit_logs').insert({
      staff_id: staff?.id ?? null,
      staff_name: staff?.full_name ?? 'Bilinmeyen',
      action: params.action,
      table_name: params.table,
      record_id: params.recordId ?? null,
      description: params.description,
      payload: params.payload ?? null,
    })
  } catch (error) {
    console.warn('[AuditLog] Kayıt yazılamadı (ana işlem etkilenmedi):', error)
  }
}
