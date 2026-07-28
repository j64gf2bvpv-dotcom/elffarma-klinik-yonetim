import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createSalesRep, deleteSalesRep, fetchSalesReps, setSalesRepActive } from './api'
import type { SalesRep } from '@/types/database'

export function useSalesReps() {
  return useQuery({ queryKey: ['sales_reps'], queryFn: fetchSalesReps })
}

export function useCreateSalesRep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createSalesRep(name),
    onSuccess: (created) => {
      queryClient.setQueryData<SalesRep[]>(['sales_reps'], (old) => (old ? [...old, created] : old))
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] })
      toast.success('Temsilci eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useSetSalesRepActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => setSalesRepActive(id, is_active),
    onSuccess: (_data, { id, is_active }) => {
      queryClient.setQueryData<SalesRep[]>(['sales_reps'], (old) =>
        old?.map((r) => (r.id === id ? { ...r, is_active } : r)),
      )
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteSalesRep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSalesRep(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SalesRep[]>(['sales_reps'], (old) => old?.filter((r) => r.id !== id))
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] })
      toast.success('Temsilci silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
