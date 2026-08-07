import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchCustomerRevenueTargets, saveCustomerRevenueTarget } from './api'
import type { CustomerRevenueTarget } from '@/types/database'

export function useCustomerRevenueTargets(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer_revenue_targets', customerId],
    queryFn: () => fetchCustomerRevenueTargets(customerId as string),
    enabled: !!customerId,
  })
}

export function useSaveCustomerRevenueTarget(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ year, month, targetRevenue }: { year: number; month: number; targetRevenue: number }) =>
      saveCustomerRevenueTarget(customerId, year, month, targetRevenue),
    onSuccess: (saved) => {
      queryClient.setQueryData<CustomerRevenueTarget[]>(['customer_revenue_targets', customerId], (old) => {
        const list = old ?? []
        const exists = list.some((t) => t.year === saved.year && t.month === saved.month)
        return exists
          ? list.map((t) => (t.year === saved.year && t.month === saved.month ? { ...t, ...saved } : t))
          : [saved, ...list]
      })
      queryClient.invalidateQueries({ queryKey: ['customer_revenue_targets', customerId] })
      toast.success('Hedef kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
