import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createExpense, deleteExpense, fetchExpenses, type ExpenseFilters, type ExpenseInput } from './api'
import type { Expense } from '@/types/database'

export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => fetchExpenses(filters),
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<Expense[]>({ queryKey: ['expenses'] }, (old) => [created, ...(old ?? [])])
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Gider kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<Expense[]>({ queryKey: ['expenses'] }, (old) => old?.filter((e) => e.id !== id))
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Gider silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
