import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { fetchMessages, sendMessage, getMessageAttachmentUrl, type SendMessageInput } from './api'

export function useTeamMessages() {
  return useQuery({
    queryKey: ['staff_messages'],
    queryFn: () => fetchMessages(),
    // Gerçek zamanlı bir subscription yerine kısa aralıklı polling — daha az
    // hareketli bir ekip sohbeti için basit ve güvenilir, subscription
    // yaşam döngüsü hataları riski yok.
    refetchInterval: 5000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendMessageInput) => sendMessage(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_messages'] }),
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: error.message }),
  })
}

export function useMessageAttachmentUrl() {
  return useMutation({ mutationFn: (path: string) => getMessageAttachmentUrl(path) })
}
