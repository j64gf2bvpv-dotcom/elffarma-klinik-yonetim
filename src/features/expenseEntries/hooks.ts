import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createExpenseEntry,
  deleteExpenseEntry,
  fetchExpenseEntries,
  updateExpenseEntry,
  type ExpenseEntryFilters,
  type ExpenseEntryInput,
} from './api'
import type { ExpenseEntry } from '@/types/database'

export function useExpenseEntries(filters: ExpenseEntryFilters) {
  return useQuery({
    queryKey: ['expense_entries', filters],
    queryFn: () => fetchExpenseEntries(filters),
  })
}

export function useSaveExpenseEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ExpenseEntryInput }) => (id ? updateExpenseEntry(id, input) : createExpenseEntry(input)),
    onSuccess: (_d, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['expense_entries'] })
      toast.success(id ? 'Gider güncellendi' : 'Gider kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useDeleteExpenseEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: ExpenseEntry) => deleteExpenseEntry(entry),
    onSuccess: (_d, entry) => {
      queryClient.setQueriesData<ExpenseEntry[]>({ queryKey: ['expense_entries'] }, (old) => old?.filter((e) => e.id !== entry.id))
      queryClient.invalidateQueries({ queryKey: ['expense_entries'] })
      toast.success('Gider silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
