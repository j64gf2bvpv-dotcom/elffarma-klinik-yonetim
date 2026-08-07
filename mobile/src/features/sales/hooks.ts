import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSales, createSale, type CreateSaleInput } from './api'
import Toast from 'react-native-toast-message'

export function useSales() {
  return useQuery({ queryKey: ['sales'], queryFn: fetchSales })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSaleInput) => createSale(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      Toast.show({ type: 'success', text1: 'Satış kaydedildi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Satış kaydedilemedi' }),
  })
}
