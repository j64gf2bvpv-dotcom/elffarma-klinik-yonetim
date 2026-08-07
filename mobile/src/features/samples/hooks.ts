import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSampleRequests, createSampleRequest, updateSampleRequestStatus, deleteSampleRequest, type CreateSampleRequestInput, type SampleRequestWithCustomer } from './api'
import type { SampleRequestStatus } from '@shared/types/database'
import Toast from 'react-native-toast-message'

export function useSampleRequests() {
  return useQuery({ queryKey: ['sample_requests'], queryFn: fetchSampleRequests })
}

export function useCreateSampleRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSampleRequestInput) => createSampleRequest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sample_requests'] })
      Toast.show({ type: 'success', text1: 'Numune talebi oluşturuldu' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Talep oluşturulamadı' }),
  })
}

export function useUpdateSampleRequestStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, extra }: { id: string; status: SampleRequestStatus; extra?: { tracking_number?: string; shipped_at?: string; delivered_at?: string; delivered_to?: string } }) =>
      updateSampleRequestStatus(id, status, extra),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sample_requests'] })
      Toast.show({ type: 'success', text1: 'Durum güncellendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}

export function useDeleteSampleRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSampleRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sample_requests'] })
      Toast.show({ type: 'success', text1: 'Talep silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}

export type { SampleRequestWithCustomer }
