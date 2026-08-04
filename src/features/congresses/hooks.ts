import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createChecklistItem,
  createChecklistItemsBulk,
  createCongress,
  createCongressStockItem,
  createConsumable,
  createConsumablesBulk,
  createParticipant,
  createParticipantProduct,
  deleteChecklistItem,
  deleteCongress,
  deleteCongressStockItem,
  deleteConsumable,
  deleteParticipant,
  deleteParticipantProduct,
  fetchAllChecklistItems,
  fetchAllCongressStockItems,
  fetchAllParticipantProductSales,
  fetchChecklistItems,
  fetchCongress,
  fetchCongresses,
  fetchCongressStockItems,
  fetchConsumables,
  fetchParticipants,
  fetchParticipationsByDoctorName,
  setChecklistItemDone,
  setConsumableUsed,
  updateCongress,
  updateCongressStockItemStatus,
  updateConsumable,
  updateParticipant,
  type CongressInput,
  type CongressStockItemInput,
  type ConsumableInput,
  type ParticipantInput,
  type ParticipantProductInput,
  type ParticipantWithProducts,
} from './api'
import type {
  Congress,
  CongressChecklistItem,
  CongressConsumable,
  CongressStockItem,
  CongressStockItemStatus,
} from '@/types/database'

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

export function useParticipationsByDoctorName(doctorName: string | undefined) {
  return useQuery({
    queryKey: ['congress_participants', 'by_doctor_name', doctorName],
    queryFn: () => fetchParticipationsByDoctorName(doctorName as string),
    enabled: !!doctorName,
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

export function useChecklistItems(congressId: string | undefined) {
  return useQuery({
    queryKey: ['congress_checklist_items', congressId],
    queryFn: () => fetchChecklistItems(congressId as string),
    enabled: !!congressId,
  })
}

export function useCreateChecklistItem(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => createChecklistItem(congressId, label),
    onSuccess: (created) => {
      queryClient.setQueryData<CongressChecklistItem[]>(['congress_checklist_items', congressId], (old) =>
        old ? [...old, created] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items', congressId] })
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items_all'] })
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useCreateChecklistItemsBulk(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (labels: string[]) => createChecklistItemsBulk(congressId, labels),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items', congressId] })
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items_all'] })
    },
    onError: (error: Error) => toast.error('Standart liste eklenemedi', { description: error.message }),
  })
}

export function useAllChecklistItems() {
  return useQuery({
    queryKey: ['congress_checklist_items_all'],
    queryFn: fetchAllChecklistItems,
  })
}

export function useSetChecklistItemDone(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_done }: { id: string; is_done: boolean }) => setChecklistItemDone(id, is_done),
    onSuccess: (_data, { id, is_done }) => {
      queryClient.setQueryData<CongressChecklistItem[]>(['congress_checklist_items', congressId], (old) =>
        old?.map((item) => (item.id === id ? { ...item, is_done } : item)),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items', congressId] })
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items_all'] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteChecklistItem(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<CongressChecklistItem[]>(['congress_checklist_items', congressId], (old) =>
        old?.filter((item) => item.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items', congressId] })
      queryClient.invalidateQueries({ queryKey: ['congress_checklist_items_all'] })
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCongressStockItems(congressId: string | undefined) {
  return useQuery({
    queryKey: ['congress_stock_items', congressId],
    queryFn: () => fetchCongressStockItems(congressId as string),
    enabled: !!congressId,
  })
}

export function useAllCongressStockItems() {
  return useQuery({ queryKey: ['congress_stock_items', 'all'], queryFn: fetchAllCongressStockItems })
}

export function useCreateCongressStockItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CongressStockItemInput) => createCongressStockItem(input),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<CongressStockItem[]>(['congress_stock_items', variables.congress_id], (old) =>
        old ? [...old, created] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['congress_stock_items', variables.congress_id] })
      queryClient.invalidateQueries({ queryKey: ['congress_stock_items', 'all'] })
      toast.success('Ürün eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateCongressStockItemStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CongressStockItemStatus; congressId: string }) =>
      updateCongressStockItemStatus(id, status),
    onSuccess: (_updated, variables) => {
      queryClient.setQueryData<CongressStockItem[]>(['congress_stock_items', variables.congressId], (old) =>
        old?.map((item) => (item.id === variables.id ? { ...item, status: variables.status } : item)),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_stock_items', variables.congressId] })
      queryClient.invalidateQueries({ queryKey: ['congress_stock_items', 'all'] })
      toast.success('Durum güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCongressStockItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; congressId: string }) => deleteCongressStockItem(id),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<CongressStockItem[]>(['congress_stock_items', variables.congressId], (old) =>
        old?.filter((item) => item.id !== variables.id),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_stock_items', variables.congressId] })
      queryClient.invalidateQueries({ queryKey: ['congress_stock_items', 'all'] })
      toast.success('Ürün silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useConsumables(congressId: string | undefined) {
  return useQuery({
    queryKey: ['congress_consumables', congressId],
    queryFn: () => fetchConsumables(congressId as string),
    enabled: !!congressId,
  })
}

export function useCreateConsumable(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<ConsumableInput, 'congress_id'>) => createConsumable({ ...input, congress_id: congressId }),
    onSuccess: (created) => {
      queryClient.setQueryData<CongressConsumable[]>(['congress_consumables', congressId], (old) =>
        old ? [...old, created] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['congress_consumables', congressId] })
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useCreateConsumablesBulk(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: { name: string; quantity: number }[]) => createConsumablesBulk(congressId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['congress_consumables', congressId] })
      toast.success('Standart liste eklendi')
    },
    onError: (error: Error) => toast.error('Standart liste eklenemedi', { description: error.message }),
  })
}

export function useSetConsumableUsed(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_used }: { id: string; is_used: boolean }) => setConsumableUsed(id, is_used),
    onSuccess: (_data, { id, is_used }) => {
      queryClient.setQueryData<CongressConsumable[]>(['congress_consumables', congressId], (old) =>
        old?.map((item) => (item.id === id ? { ...item, is_used } : item)),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_consumables', congressId] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateConsumable(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name: string; quantity: number } }) =>
      updateConsumable(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<CongressConsumable[]>(['congress_consumables', congressId], (old) =>
        old?.map((item) => (item.id === updated.id ? updated : item)),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_consumables', congressId] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteConsumable(congressId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteConsumable(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<CongressConsumable[]>(['congress_consumables', congressId], (old) =>
        old?.filter((item) => item.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['congress_consumables', congressId] })
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
