import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSales, createSale, updateSale, deleteSale, type CreateSaleInput, type UpdateSaleInput } from './api'
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

export function useUpdateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSaleInput }) => updateSale(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      Toast.show({ type: 'success', text1: 'Sipariş güncellendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Sipariş güncellenemedi' }),
  })
}

export function useDeleteSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      Toast.show({ type: 'success', text1: 'Sipariş silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Sipariş silinemedi' }),
  })
}
