import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCongress,
  createParticipant,
  createParticipantProduct,
  deleteCongress,
  deleteParticipant,
  deleteParticipantProduct,
  fetchAllParticipantProductSales,
  fetchCongress,
  fetchCongresses,
  fetchParticipants,
  fetchParticipationsByCustomer,
  updateCongress,
  updateParticipant,
  type CongressInput,
  type ParticipantInput,
  type ParticipantProductInput,
  type ParticipantWithProducts,
} from './api'
import type { Congress } from '@/types/database'

export function useParticipationsByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['congress_participants', 'by_customer', customerId],
    queryFn: () => fetchParticipationsByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useAllParticipantProductSales() {
  return useQuery({
    queryKey: ['congress_participant_products', 'all_sales'],
    queryFn: fetchAllParticipantProductSales,
  })
}

export function useCongresses() {
  return useQuery({ queryKey: ['congresses'], queryFn: fetchCongresses })
}

export function useCongress(id: string | undefined) {
  return useQuery({
    queryKey: ['congresses', 'detail', id],
    queryFn: () => fetchCongress(id as string),
    enabled: !!id,
  })
}

export function useParticipants(congressId: string | undefined) {
  return useQuery({
    queryKey: ['congress_participants', congressId],
    queryFn: () => fetchParticipants(congressId as string),
    enabled: !!congressId,
  })
}

export function useCreateCongress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CongressInput) => createCongress(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Congress[]>(['congresses'], (old) => (old ? [created, ...old] : old))
      queryClient.invalidateQueries({ queryKey: ['congresses'] })
      toast.success('Kongre eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateCongress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CongressInput }) => updateCongress(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<Congress[]>(['congresses'], (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...updated } : c)),
      )
      queryClient.setQueryData<Congress>(['congresses', 'detail', id], (old) => (old ? { ...old, ...updated } : old))
      queryClient.invalidateQueries({ queryKey: ['congresses'] })
      toast.success('Kongre güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCongress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCongress(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Congress[]>(['congresses'], (old) => old?.filter((c) => c.id !== id))
      queryClient.invalidateQueries({ queryKey: ['congresses'] })
      toast.success('Kongre silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCreateParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ParticipantInput) => createParticipant(input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<ParticipantWithProducts[]>(
        ['congress_participants', variables.congress_id],
        (old) => (old ? [...old, { ...created, congress_participant_products: [] }] : old),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_participants', variables.congress_id] })
      toast.success('Doktor eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      congressId: string
      input: Omit<ParticipantInput, 'congress_id'>
    }) => updateParticipant(id, input),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<ParticipantWithProducts[]>(
        ['congress_participants', variables.congressId],
        (old) => old?.map((p) => (p.id === variables.id ? { ...p, ...updated } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_participants', variables.congressId] })
      toast.success('Doktor bilgileri güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; congressId: string }) => deleteParticipant(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<ParticipantWithProducts[]>(
        ['congress_participants', variables.congressId],
        (old) => old?.filter((p) => p.id !== variables.id),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_participants', variables.congressId] })
      toast.success('Doktor silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCreateParticipantProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ congressId: _congressId, ...input }: ParticipantProductInput & { congressId: string }) =>
      createParticipantProduct(input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<ParticipantWithProducts[]>(
        ['congress_participants', variables.congressId],
        (old) =>
          old?.map((p) =>
            p.id === variables.participant_id
              ? {
                  ...p,
                  congress_participant_products: [
                    ...p.congress_participant_products,
                    { ...created, sales_reps: null },
                  ],
                }
              : p,
          ),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_participants', variables.congressId] })
      toast.success('Ürün eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeleteParticipantProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; congressId: string }) => deleteParticipantProduct(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<ParticipantWithProducts[]>(
        ['congress_participants', variables.congressId],
        (old) =>
          old?.map((p) => ({
            ...p,
            congress_participant_products: p.congress_participant_products.filter((pr) => pr.id !== variables.id),
          })),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_participants', variables.congressId] })
      toast.success('Ürün silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
