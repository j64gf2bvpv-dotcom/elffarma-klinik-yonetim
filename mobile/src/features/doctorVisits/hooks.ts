import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchVisits,
  createVisit,
  checkInVisit,
  checkOutVisit,
  deleteVisit,
  startVisitForCustomer,
  type CreateVisitInput,
  type CompleteVisitInput,
} from './api'
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

export function useStartVisitForCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, doctorName }: { customerId: string; doctorName: string }) =>
      startVisitForCustomer(customerId, doctorName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor_visits'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Ziyaret başlatılamadı' }),
  })
}

export function useCheckInVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, coords }: { id: string; coords?: { lat: number; lng: number } }) => checkInVisit(id, coords),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor_visits'] })
      Toast.show({ type: 'success', text1: 'Check-in yapıldı' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Check-in başarısız' }),
  })
}

export function useCheckOutVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completion }: { id: string; completion?: CompleteVisitInput }) => checkOutVisit(id, completion),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor_visits'] })
      Toast.show({ type: 'success', text1: 'Ziyaret tamamlandı' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Check-out başarısız' }),
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
