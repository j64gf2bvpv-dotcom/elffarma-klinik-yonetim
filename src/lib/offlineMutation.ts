// api.ts dosyalarının doğrudan supabase.from(...).insert/update/delete/rpc yerine
// kullandığı yardımcılar. Bağlantı varsa normal şekilde Supabase'e yazar; bağlantı
// yoksa (veya yazma sırasında ağ hatası olursa) işlemi offlineQueue'ya ekler ve
// çağıran kodun akışı bozulmadan devam edebilmesi için "iyimser" (optimistic) bir
// sonuç döndürür. Kuyruktaki işlem bağlantı gelince useOfflineSync tarafından
// gerçek Supabase'e gönderilir — hiçbir kayıt sessizce kaybolmaz.

import { supabase } from './supabaseClient'
import { enqueueMutation } from './offlineQueue'

/**
 * supabase.auth.getUser() JWT'yi sunucuda doğrulamak için ağ isteği atar ve
 * bağlantı yokken başarısız olur. getSession() ise oturumu yerel depodan okur
 * (ağ gerektirmez) — offline'da kullanıcı id'sine güvenli erişim için bunu kullanıyoruz.
 */
export async function getCurrentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id
}

function isNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message)
}

/**
 * PostgREST'in `.single()` sıfır satır döndüğünde attığı PGRST116 hatası
 * ("Cannot coerce the result to a single JSON object") — genelde satırın
 * kendisi yerine RLS'in o yazma işlemini sessizce reddetmesinden kaynaklanır
 * (ör. sadece yöneticinin düzenleyebildiği bir tabloya personel yazmaya
 * çalışması). Kullanıcıya bu ham teknik mesajı göstermek yerine anlaşılır
 * bir Türkçe yetki hatasına çeviriyoruz.
 */
function translatePermissionError(error: unknown): unknown {
  const code = (error as { code?: string } | null | undefined)?.code
  if (code === 'PGRST116') {
    return new Error('Bu işlem için yetkiniz yok — sadece yönetici yapabilir.')
  }
  return error
}

export async function offlineInsert<T>(
  table: string,
  payload: Record<string, unknown>,
  description: string,
): Promise<T> {
  const id = (payload.id as string | undefined) ?? crypto.randomUUID()
  const withId = { ...payload, id }

  if (!navigator.onLine) {
    await enqueueMutation({ type: 'insert', table, payload: withId, description })
    return { ...withId, created_at: new Date().toISOString() } as unknown as T
  }

  try {
    const { data, error } = await supabase.from(table).insert(withId).select().single()
    if (error) throw error
    return data as T
  } catch (error) {
    if (!isNetworkError(error)) throw translatePermissionError(error)
    await enqueueMutation({ type: 'insert', table, payload: withId, description })
    return { ...withId, created_at: new Date().toISOString() } as unknown as T
  }
}

export async function offlineUpdate<T>(
  table: string,
  id: string,
  payload: Record<string, unknown>,
  description: string,
): Promise<T> {
  if (!navigator.onLine) {
    await enqueueMutation({ type: 'update', table, match: { id }, payload, description })
    return { id, ...payload } as unknown as T
  }

  try {
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
    if (error) throw error
    return data as T
  } catch (error) {
    if (!isNetworkError(error)) throw translatePermissionError(error)
    await enqueueMutation({ type: 'update', table, match: { id }, payload, description })
    return { id, ...payload } as unknown as T
  }
}

export async function offlineUpsert<T>(
  table: string,
  payload: Record<string, unknown>,
  description: string,
  onConflict?: string,
): Promise<T> {
  if (!navigator.onLine) {
    await enqueueMutation({ type: 'upsert', table, payload, description, onConflict })
    return payload as unknown as T
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .upsert(payload, onConflict ? { onConflict } : undefined)
      .select()
      .single()
    if (error) throw error
    return data as T
  } catch (error) {
    if (!isNetworkError(error)) throw translatePermissionError(error)
    await enqueueMutation({ type: 'upsert', table, payload, description, onConflict })
    return payload as unknown as T
  }
}

export async function offlineDelete(table: string, id: string, description: string): Promise<void> {
  if (!navigator.onLine) {
    await enqueueMutation({ type: 'delete', table, match: { id }, description })
    return
  }

  try {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await enqueueMutation({ type: 'delete', table, match: { id }, description })
  }
}

export async function offlineRpc(
  rpcName: string,
  args: Record<string, unknown>,
  description: string,
): Promise<void> {
  if (!navigator.onLine) {
    await enqueueMutation({ type: 'rpc', rpcName, rpcArgs: args, description })
    return
  }

  try {
    const { error } = await supabase.rpc(rpcName, args)
    if (error) throw error
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await enqueueMutation({ type: 'rpc', rpcName, rpcArgs: args, description })
  }
}
