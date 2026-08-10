// Masaüstündeki src/lib/offlineMutation.ts'in RN portu — aynı beş fonksiyon,
// aynı online/offline dallanma mantığı. api.ts dosyaları supabase.from(...)
// yerine bunları kullanır.
import * as Crypto from 'expo-crypto'
import { supabase } from './supabaseClient'
import { enqueueMutation } from './offlineQueue'
import { isOnline } from './netInfoState'
import { recordAuditLog } from './auditLog'

export async function getCurrentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id
}

function isNetworkError(error: unknown): boolean {
  if (!isOnline()) return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  // Masaüstündeki regex'e RN/Hermes'in fetch hata metinleri de eklendi
  // ("Network request failed" zaten vardı; TypeError varyasyonları da
  // yakalanır çünkü sadece mesaj gövdesine bakılıyor).
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message)
}

export async function offlineInsert<T>(
  table: string,
  payload: Record<string, unknown>,
  description: string,
): Promise<T> {
  const id = (payload.id as string | undefined) ?? Crypto.randomUUID()
  const withId = { ...payload, id }

  if (!isOnline()) {
    await enqueueMutation({ type: 'insert', table, payload: withId, description })
    return { ...withId, created_at: new Date().toISOString() } as unknown as T
  }

  try {
    const { data, error } = await supabase.from(table).insert(withId).select().single()
    if (error) throw error
    recordAuditLog({ action: 'insert', table, recordId: id, description, payload: withId })
    return data as T
  } catch (error) {
    if (!isNetworkError(error)) throw error
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
  if (!isOnline()) {
    await enqueueMutation({ type: 'update', table, match: { id }, payload, description })
    return { id, ...payload } as unknown as T
  }

  try {
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
    if (error) throw error
    recordAuditLog({ action: 'update', table, recordId: id, description, payload })
    return data as T
  } catch (error) {
    if (!isNetworkError(error)) throw error
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
  if (!isOnline()) {
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
    recordAuditLog({ action: 'update', table, recordId: (payload.id as string | undefined) ?? null, description, payload })
    return data as T
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await enqueueMutation({ type: 'upsert', table, payload, description, onConflict })
    return payload as unknown as T
  }
}

export async function offlineDelete(table: string, id: string, description: string): Promise<void> {
  if (!isOnline()) {
    await enqueueMutation({ type: 'delete', table, match: { id }, description })
    return
  }

  try {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
    recordAuditLog({ action: 'delete', table, recordId: id, description })
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
  if (!isOnline()) {
    await enqueueMutation({ type: 'rpc', rpcName, rpcArgs: args, description })
    return
  }

  try {
    const { error } = await supabase.rpc(rpcName, args)
    if (error) throw error
    recordAuditLog({ action: 'rpc', table: rpcName, description, payload: args })
  } catch (error) {
    if (!isNetworkError(error)) throw error
    await enqueueMutation({ type: 'rpc', rpcName, rpcArgs: args, description })
  }
}
