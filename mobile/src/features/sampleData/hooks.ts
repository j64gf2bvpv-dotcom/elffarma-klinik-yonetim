import { useMutation, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { insertSampleData, deleteSampleData } from './api'

const AFFECTED_QUERY_KEYS = ['customers', 'sales', 'payments', 'doctor_visits', 'quotes', 'products']

export function useInsertSampleData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: insertSampleData,
    onSuccess: (result) => {
      AFFECTED_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
      Toast.show({ type: 'success', text1: 'Örnek veriler eklendi', text2: `${result.customers} müşteri eklendi` })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Örnek veriler eklenemedi' }),
  })
}

export function useDeleteSampleData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSampleData,
    onSuccess: (result) => {
      AFFECTED_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }))
      Toast.show({
        type: 'success',
        text1: 'Örnek veriler silindi',
        text2: `${result.customers} müşteri, ${result.sales} sipariş, ${result.payments} tahsilat`,
      })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Örnek veriler silinemedi' }),
  })
}
