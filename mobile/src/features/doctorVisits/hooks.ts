import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchVisits, createVisit, deleteVisit, type CreateVisitInput } from './api'
import Toast from 'react-native-toast-message'

export function useVisits(from?: string, to?: string) {
  return useQuery({ queryKey: ['doctor_visits', from, to], queryFn: () => fetchVisits(from, to) })
}

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVisitInput) => createVisit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor_visits'] })
      Toast.show({ type: 'success', text1: 'Ziyaret kaydedildi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Ziyaret kaydedilemedi' }),
  })
}

export function useDeleteVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVisit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor_visits'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
