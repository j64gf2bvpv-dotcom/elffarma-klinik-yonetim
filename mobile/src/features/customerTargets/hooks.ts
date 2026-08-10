import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { fetchCustomerTarget, upsertCustomerTarget } from './api'

export function useCustomerTarget(customerId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['customer_revenue_targets', customerId, year, month],
    queryFn: () => fetchCustomerTarget(customerId as string, year, month),
    enabled: !!customerId,
  })
}

export function useUpsertCustomerTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, year, month, targetRevenue }: { customerId: string; year: number; month: number; targetRevenue: number }) =>
      upsertCustomerTarget(customerId, year, month, targetRevenue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer_revenue_targets'] })
      Toast.show({ type: 'success', text1: 'Hedef güncellendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}
