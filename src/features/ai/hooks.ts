import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import type { AISettings } from './types'
import { defaultAISettings } from './config'
import {
  appendMessage,
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchMessages,
  fetchUsageLogs,
  renameConversation,
  touchConversation,
} from './api'
import type { AIConversation, AIMessageRow, AIMessageRole } from '@/types/database'

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

export function useAIUsageLogs() {
  return useQuery({ queryKey: ['ai_usage_logs'], queryFn: () => fetchUsageLogs() })
}
