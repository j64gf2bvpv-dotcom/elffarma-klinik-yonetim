import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentMonthTarget, fetchBudgetTargets, saveBudgetTarget } from './api'
import Toast from 'react-native-toast-message'

export function useCurrentMonthTarget() {
  return useQuery({ queryKey: ['budget', 'currentMonthTarget'], queryFn: fetchCurrentMonthTarget })
}

export function useBudgetTargets(year?: number) {
  return useQuery({ queryKey: ['budget', 'targets', year], queryFn: () => fetchBudgetTargets(year) })
}

export function useSaveBudgetTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ year, month, targetRevenue }: { year: number; month: number; targetRevenue: number }) =>
      saveBudgetTarget(year, month, targetRevenue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget'] })
      Toast.show({ type: 'success', text1: 'Hedef kaydedildi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Kaydedilemedi' }),
  })
}
