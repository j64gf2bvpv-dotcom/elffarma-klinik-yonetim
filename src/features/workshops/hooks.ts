import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createWorkshop,
  createWorkshopParticipant,
  createWorkshopProduct,
  deleteWorkshop,
  deleteWorkshopParticipant,
  deleteWorkshopProduct,
  fetchWorkshop,
  fetchWorkshopParticipants,
  fetchWorkshopParticipationsByCustomer,
  fetchWorkshops,
  updateWorkshop,
  type WorkshopInput,
  type WorkshopParticipantInput,
  type WorkshopParticipantWithProducts,
  type WorkshopProductInput,
  type WorkshopWithCongress,
} from './api'
import type { Workshop } from '@/types/database'

export function useWorkshops() {
  return useQuery({ queryKey: ['workshops'], queryFn: fetchWorkshops })
}

export function useWorkshop(id: string | undefined) {
  return useQuery({
    queryKey: ['workshops', 'detail', id],
    queryFn: () => fetchWorkshop(id as string),
    enabled: !!id,
  })
}

export function useWorkshopParticipants(workshopId: string | undefined) {
  return useQuery({
    queryKey: ['workshop_participants', workshopId],
    queryFn: () => fetchWorkshopParticipants(workshopId as string),
    enabled: !!workshopId,
  })
}

export function useWorkshopParticipationsByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['workshop_participants', 'by_customer', customerId],
    queryFn: () => fetchWorkshopParticipationsByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useCreateWorkshop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkshopInput) => createWorkshop(input),
    onSuccess: (created) => {
      queryClient.setQueryData<WorkshopWithCongress[]>(['workshops'], (old) =>
        old ? [{ ...created, congresses: null }, ...old] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['workshops'] })
      toast.success('Workshop eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateWorkshop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkshopInput }) => updateWorkshop(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<WorkshopWithCongress[]>(['workshops'], (old) =>
        old?.map((w) => (w.id === id ? { ...w, ...updated } : w)),
      )
      queryClient.setQueryData<Workshop>(['workshops', 'detail', id], (old) => (old ? { ...old, ...updated } : old))
      queryClient.invalidateQueries({ queryKey: ['workshops'] })
      toast.success('Workshop güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteWorkshop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkshop(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<WorkshopWithCongress[]>(['workshops'], (old) => old?.filter((w) => w.id !== id))
      queryClient.invalidateQueries({ queryKey: ['workshops'] })
      toast.success('Workshop silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCreateWorkshopParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkshopParticipantInput) => createWorkshopParticipant(input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<WorkshopParticipantWithProducts[]>(
        ['workshop_participants', variables.workshop_id],
        (old) => (old ? [...old, { ...created, customers: null, workshop_products: [] }] : old),
      )
      queryClient.invalidateQueries({ queryKey: ['workshop_participants', variables.workshop_id] })
      toast.success('Doktor eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeleteWorkshopParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; workshopId: string }) => deleteWorkshopParticipant(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<WorkshopParticipantWithProducts[]>(
        ['workshop_participants', variables.workshopId],
        (old) => old?.filter((p) => p.id !== variables.id),
      )
      queryClient.invalidateQueries({ queryKey: ['workshop_participants', variables.workshopId] })
      toast.success('Doktor silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCreateWorkshopProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workshopId: _workshopId, ...input }: WorkshopProductInput & { workshopId: string }) =>
      createWorkshopProduct(input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<WorkshopParticipantWithProducts[]>(
        ['workshop_participants', variables.workshopId],
        (old) =>
          old?.map((p) =>
            p.id === variables.participant_id
              ? { ...p, workshop_products: [...p.workshop_products, { ...created, sales_reps: null, products: null }] }
              : p,
          ),
      )
      queryClient.invalidateQueries({ queryKey: ['workshop_participants', variables.workshopId] })
      toast.success('Ürün eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeleteWorkshopProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; workshopId: string }) => deleteWorkshopProduct(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<WorkshopParticipantWithProducts[]>(
        ['workshop_participants', variables.workshopId],
        (old) =>
          old?.map((p) => ({
            ...p,
            workshop_products: p.workshop_products.filter((pr) => pr.id !== variables.id),
          })),
      )
      queryClient.invalidateQueries({ queryKey: ['workshop_participants', variables.workshopId] })
      toast.success('Ürün silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
