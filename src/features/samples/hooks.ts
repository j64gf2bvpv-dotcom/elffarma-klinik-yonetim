import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createSampleRequest,
  deleteSampleRequest,
  fetchSampleRequests,
  updateSampleRequestStatus,
  type SampleRequestFilters,
  type SampleRequestInput,
  type SampleRequestStatusInput,
} from './api'

export function useSampleRequests(filters: SampleRequestFilters = {}) {
  return useQuery({
    queryKey: ['sample_requests', filters],
    queryFn: () => fetchSampleRequests(filters),
  })
}

export function useCreateSampleRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SampleRequestInput) => createSampleRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Numune talebi oluşturuldu')
    },
    onError: (error: Error) => toast.error('Oluşturulamadı', { description: error.message }),
  })
}

export function useUpdateSampleRequestStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SampleRequestStatusInput }) => updateSampleRequestStatus(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
      toast.success('Durum güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteSampleRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSampleRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
      toast.success('Numune talebi silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
