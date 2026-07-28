import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createVisit, deleteVisit, fetchVisitsInRange, updateVisit, type DoctorVisitInput } from './api'
import type { DoctorVisit } from '@/types/database'

export function useVisitsInRange(from: string, to: string, salesRepId?: string) {
  return useQuery({
    queryKey: ['doctor_visits', from, to, salesRepId],
    queryFn: () => fetchVisitsInRange(from, to, salesRepId),
  })
}

export function useCreateVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DoctorVisitInput) => createVisit(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<DoctorVisit[]>({ queryKey: ['doctor_visits'] }, (old) => [
        ...(old ?? []),
        created,
      ])
      queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      toast.success('Doktor eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DoctorVisitInput }) => updateVisit(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<DoctorVisit[]>({ queryKey: ['doctor_visits'] }, (old) =>
        old?.map((v) => (v.id === id ? { ...v, ...updated } : v)),
      )
      queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      toast.success('Doktor bilgileri güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteVisit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVisit(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<DoctorVisit[]>({ queryKey: ['doctor_visits'] }, (old) =>
        old?.filter((v) => v.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      toast.success('Doktor silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
