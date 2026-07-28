import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchBudgetTargets, saveBudgetTarget } from './api'
import type { BudgetTarget } from '@/types/database'

export function useBudgetTargets(year: number) {
  return useQuery({ queryKey: ['budget_targets', year], queryFn: () => fetchBudgetTargets(year) })
}

export function useSaveBudgetTarget(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ month, targetRevenue }: { month: number; targetRevenue: number }) =>
      saveBudgetTarget(year, month, targetRevenue),
    onSuccess: (saved) => {
      queryClient.setQueryData<BudgetTarget[]>(['budget_targets', year], (old) => {
        const list = old ?? []
        const exists = list.some((t) => t.month === saved.month)
        return exists ? list.map((t) => (t.month === saved.month ? { ...t, ...saved } : t)) : [...list, saved]
      })
      queryClient.invalidateQueries({ queryKey: ['budget_targets', year] })
      toast.success('Bütçe hedefi kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
