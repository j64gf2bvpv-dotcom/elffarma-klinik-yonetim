import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createClinic,
  deleteClinic,
  fetchClinic,
  fetchClinics,
  updateClinic,
  type ClinicInput,
} from './api'
import type { Clinic } from '@/types/database'

const clinicListPredicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[1] !== 'detail'

export function useClinics(search = '') {
  return useQuery({ queryKey: ['clinics', search], queryFn: () => fetchClinics(search) })
}

export function useClinic(id: string | undefined) {
  return useQuery({
    queryKey: ['clinics', 'detail', id],
    queryFn: () => fetchClinic(id as string),
    enabled: !!id,
  })
}

export function useCreateClinic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClinicInput) => createClinic(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<Clinic[]>({ queryKey: ['clinics'], predicate: clinicListPredicate }, (old) =>
        old ? [...old, created].sort((a, b) => a.name.localeCompare(b.name, 'tr')) : old,
      )
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
      toast.success('Klinik eklendi')
    },
    onError: (error: Error) => toast.error('Klinik eklenemedi', { description: error.message }),
  })
}

export function useUpdateClinic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClinicInput }) => updateClinic(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Clinic[]>({ queryKey: ['clinics'], predicate: clinicListPredicate }, (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...updated } : c)),
      )
      queryClient.setQueryData<Clinic>(['clinics', 'detail', id], (old) => (old ? { ...old, ...updated } : old))
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
      toast.success('Klinik güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteClinic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClinic(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<Clinic[]>({ queryKey: ['clinics'], predicate: clinicListPredicate }, (old) =>
        old?.filter((c) => c.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
      toast.success('Klinik silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
