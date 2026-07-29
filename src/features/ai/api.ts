import { supabase } from '@/lib/supabaseClient'
import { getCurrentUserId } from '@/lib/offlineMutation'
import type { AIConversation, AIMessageRow, AIMessageRole, AIUsageLog } from '@/types/database'

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
