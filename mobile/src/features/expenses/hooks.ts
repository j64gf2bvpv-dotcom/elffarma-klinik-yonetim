import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchExpenses, createExpense, deleteExpense, type CreateExpenseInput } from './api'
import Toast from 'react-native-toast-message'

export function useExpenses(from?: string, to?: string) {
  return useQuery({ queryKey: ['expenses', from, to], queryFn: () => fetchExpenses(from, to) })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createExpense(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      Toast.show({ type: 'success', text1: 'Gider kaydedildi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Gider kaydedilemedi' }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
