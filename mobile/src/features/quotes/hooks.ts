import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import {
  fetchQuotes,
  fetchQuoteItems,
  createQuote,
  updateQuoteStatus,
  deleteQuote,
  type CreateQuoteInput,
} from './api'
import type { QuoteStatus } from '@shared/types/database'

export function useQuotes(status?: QuoteStatus | 'all') {
  return useQuery({ queryKey: ['quotes', status], queryFn: () => fetchQuotes(status) })
}

export function useQuoteItems(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote_items', quoteId],
    queryFn: () => fetchQuoteItems(quoteId as string),
    enabled: !!quoteId,
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateQuoteInput) => createQuote(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      Toast.show({ type: 'success', text1: 'Teklif oluşturuldu' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Teklif oluşturulamadı' }),
  })
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) => updateQuoteStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      Toast.show({ type: 'success', text1: 'Teklif silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
