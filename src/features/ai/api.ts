import { supabase } from '@/lib/supabaseClient'
import { getCurrentUserId } from '@/lib/offlineMutation'
import type { AIConversation, AIMessageRow, AIMessageRole, AIUsageLog, SharedAIKeys, StaffAIKeys } from '@/types/database'

export async function fetchConversations(): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as AIConversation[]
}

export async function createConversation(input: {
  title?: string
  provider: string
  model: string
}): Promise<AIConversation> {
  const createdBy = await getCurrentUserId()
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ title: input.title ?? 'Yeni Konuşma', provider: input.provider, model: input.model, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data as AIConversation
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').update({ title }).eq('id', id)
  if (error) throw error
}

export async function touchConversation(id: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', id)
  if (error) throw error
}

export async function fetchMessages(conversationId: string): Promise<AIMessageRow[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as AIMessageRow[]
}

export async function appendMessage(input: {
  conversation_id: string
  role: AIMessageRole
  content: string
}): Promise<AIMessageRow> {
  const { data, error } = await supabase.from('ai_messages').insert(input).select().single()
  if (error) throw error
  return data as AIMessageRow
}

/** Tek bir geçmiş mesajı siler (kullanıcı isteği, 2026-08-25 — "önceden yazdıklarını ... sil"). */
export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('ai_messages').delete().eq('id', id)
  if (error) throw error
}

/** Konuşmayı silmeden tüm mesajlarını temizler (kullanıcı isteği, 2026-08-25 — "konuşmanın tamamını temizle"). */
export async function clearMessages(conversationId: string): Promise<void> {
  const { error } = await supabase.from('ai_messages').delete().eq('conversation_id', conversationId)
  if (error) throw error
}

export async function logUsage(input: {
  provider: string
  model: string
  success: boolean
  durationMs?: number
  promptTokens?: number
  completionTokens?: number
  errorMessage?: string
}): Promise<void> {
  const createdBy = await getCurrentUserId()
  const { error } = await supabase.from('ai_usage_logs').insert({
    provider: input.provider,
    model: input.model,
    success: input.success,
    duration_ms: input.durationMs ?? null,
    prompt_tokens: input.promptTokens ?? null,
    completion_tokens: input.completionTokens ?? null,
    error_message: input.errorMessage ?? null,
    created_by: createdBy,
  })
  // Loglama, asıl AI cevabını asla başarısız etmemeli — sessizce yut, konsola yaz.
  if (error) console.error('[AI] Kullanım logu kaydedilemedi:', error.message)
}

export async function fetchUsageLogs(limit = 100): Promise<AIUsageLog[]> {
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as AIUsageLog[]
}

/** RLS satır sahibiyle sınırlı — sadece giriş yapmış personelin kendi anahtarlarını döner. */
export async function fetchMyAIKeys(): Promise<StaffAIKeys | null> {
  const staffId = await getCurrentUserId()
  if (!staffId) return null
  const { data, error } = await supabase.from('staff_ai_keys').select('*').eq('staff_id', staffId).maybeSingle()
  if (error) throw error
  return data as StaffAIKeys | null
}

export async function saveMyAIKeys(input: {
  openai_api_key?: string | null
  gemini_api_key?: string | null
  anthropic_api_key?: string | null
}): Promise<StaffAIKeys> {
  const staffId = await getCurrentUserId()
  if (!staffId) throw new Error('Oturum bulunamadı')
  const { data, error } = await supabase
    .from('staff_ai_keys')
    .upsert({ staff_id: staffId, ...input, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as StaffAIKeys
}

/**
 * Kişisel bir anahtarı olmayan personel için — herhangi bir aktif personel
 * okuyabilir (RLS), sadece yönetici yazabilir (kullanıcı isteği, 2026-08-25:
 * "yapay zeka kısmı tüm kullanıcılarda çalışmalı", bkz. migration
 * 20260825122400_add_shared_ai_keys.sql).
 */
export async function fetchSharedAIKeys(): Promise<SharedAIKeys | null> {
  const { data, error } = await supabase.from('ai_shared_keys').select('*').maybeSingle()
  if (error) throw error
  return data as SharedAIKeys | null
}

export async function saveSharedAIKeys(input: {
  openai_api_key?: string | null
  gemini_api_key?: string | null
  anthropic_api_key?: string | null
}): Promise<SharedAIKeys> {
  const { data, error } = await supabase
    .from('ai_shared_keys')
    .upsert({ id: true, ...input, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as SharedAIKeys
}
