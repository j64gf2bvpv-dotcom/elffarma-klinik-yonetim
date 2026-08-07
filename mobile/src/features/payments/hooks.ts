import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { createPayment, fetchPayments, type PaymentFilters, type PaymentInput, type PaymentWithCustomer } from './api'

export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => fetchPayments(filters),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentInput) => createPayment(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<PaymentWithCustomer[]>({ queryKey: ['payments'] }, (old) => [
        { ...created, customers: null, sales_reps: null },
        ...(old ?? []),
      ])
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      Toast.show({ type: 'success', text1: 'Tahsilat kaydedildi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Kaydedilemedi', text2: error.message }),
  })
}
