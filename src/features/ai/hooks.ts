import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import type { AISettings } from './types'
import { defaultAISettings } from './config'
import {
  appendMessage,
  clearMessages,
  createConversation,
  deleteConversation,
  deleteMessage,
  fetchConversations,
  fetchMessages,
  fetchMyAIKeys,
  fetchSharedAIKeys,
  fetchUsageLogs,
  renameConversation,
  saveMyAIKeys,
  saveSharedAIKeys,
  touchConversation,
} from './api'
import type { AIConversation, AIMessageRow, AIMessageRole, SharedAIKeys, StaffAIKeys } from '@/types/database'

const AI_SETTINGS_KEY = 'ai_settings'

/** `app_settings` üzerinden okunan gizli olmayan sağlayıcı/model/base URL tercihi — kayıt yoksa .env tabanlı varsayılana düşer. */
export function useAISettings() {
  const query = useAppSetting<AISettings>(AI_SETTINGS_KEY)
  return { ...query, data: query.data ?? defaultAISettings }
}

export function useSaveAISettings() {
  return useSaveAppSetting<AISettings>(AI_SETTINGS_KEY)
}

export function useAIConversations() {
  return useQuery({ queryKey: ['ai_conversations'], queryFn: fetchConversations })
}

export function useAIMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['ai_messages', conversationId],
    queryFn: () => fetchMessages(conversationId as string),
    enabled: !!conversationId,
  })
}

export function useCreateAIConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { title?: string; provider: string; model: string }) => createConversation(input),
    onSuccess: (created) => {
      queryClient.setQueryData<AIConversation[]>(['ai_conversations'], (old) => (old ? [created, ...old] : old))
      queryClient.invalidateQueries({ queryKey: ['ai_conversations'] })
    },
    onError: (error: Error) => toast.error('Konuşma oluşturulamadı', { description: error.message }),
  })
}

export function useRenameAIConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameConversation(id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai_conversations'] }),
    onError: (error: Error) => toast.error('Yeniden adlandırılamadı', { description: error.message }),
  })
}

export function useDeleteAIConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AIConversation[]>(['ai_conversations'], (old) => old?.filter((c) => c.id !== id))
      queryClient.invalidateQueries({ queryKey: ['ai_conversations'] })
      toast.success('Konuşma silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useAppendAIMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { conversation_id: string; role: AIMessageRole; content: string }) => appendMessage(input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<AIMessageRow[]>(['ai_messages', variables.conversation_id], (old) =>
        old ? [...old, created] : old,
      )
      void touchConversation(variables.conversation_id)
    },
  })
}

/** Tek bir geçmiş mesajı siler (kullanıcı isteği, 2026-08-25). */
export function useDeleteAIMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; conversationId: string }) => deleteMessage(id),
    onSuccess: (_data, { id, conversationId }) => {
      queryClient.setQueryData<AIMessageRow[]>(['ai_messages', conversationId], (old) => old?.filter((m) => m.id !== id))
    },
    onError: (error: Error) => toast.error('Mesaj silinemedi', { description: error.message }),
  })
}

/** Konuşmayı silmeden tüm mesajlarını temizler (kullanıcı isteği, 2026-08-25). */
export function useClearAIMessages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => clearMessages(conversationId),
    onSuccess: (_data, conversationId) => {
      queryClient.setQueryData<AIMessageRow[]>(['ai_messages', conversationId], [])
      toast.success('Konuşma temizlendi')
    },
    onError: (error: Error) => toast.error('Temizlenemedi', { description: error.message }),
  })
}

export function useAIUsageLogs() {
  return useQuery({ queryKey: ['ai_usage_logs'], queryFn: () => fetchUsageLogs() })
}

/** Giriş yapmış personelin kendi bulut AI API anahtarları — sadece kendi hesabında saklanır, app_settings'te değil. */
export function useMyAIKeys() {
  return useQuery({ queryKey: ['staff_ai_keys', 'me'], queryFn: fetchMyAIKeys })
}

export function useSaveMyAIKeys() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Pick<StaffAIKeys, 'openai_api_key' | 'gemini_api_key' | 'anthropic_api_key'>>) =>
      saveMyAIKeys(input),
    onSuccess: (saved) => queryClient.setQueryData(['staff_ai_keys', 'me'], saved),
    onError: (error: Error) => toast.error('API anahtarı kaydedilemedi', { description: error.message }),
  })
}

/** Herhangi bir aktif personelin okuyabildiği paylaşılan bulut AI anahtarları — kişisel anahtarı olmayan personel için yedek (kullanıcı isteği, 2026-08-25). */
export function useSharedAIKeys() {
  return useQuery({ queryKey: ['ai_shared_keys'], queryFn: fetchSharedAIKeys })
}

/** Sadece yönetici yazabilir (RLS) — Yapay Zeka ayarlarındaki "Paylaşılan API Anahtarı" alanı. */
export function useSaveSharedAIKeys() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Pick<SharedAIKeys, 'openai_api_key' | 'gemini_api_key' | 'anthropic_api_key'>>) =>
      saveSharedAIKeys(input),
    onSuccess: (saved) => queryClient.setQueryData(['ai_shared_keys'], saved),
    onError: (error: Error) => toast.error('Paylaşılan API anahtarı kaydedilemedi', { description: error.message }),
  })
}
