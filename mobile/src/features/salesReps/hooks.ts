import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSalesReps, updateSalesRepTarget } from './api'
import Toast from 'react-native-toast-message'

export function useSalesReps() {
  return useQuery({ queryKey: ['sales_reps'], queryFn: fetchSalesReps })
}

export function useUpdateSalesRepTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, target }: { id: string; target: number }) => updateSalesRepTarget(id, target),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_reps'] })
      Toast.show({ type: 'success', text1: 'Hedef güncellendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}
