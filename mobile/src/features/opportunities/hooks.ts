import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity, type CreateOpportunityInput, type OpportunityWithCustomer } from './api'
import type { CrmOpportunityStage } from '@shared/types/database'
import Toast from 'react-native-toast-message'

export function useOpportunities(stage?: CrmOpportunityStage | 'all') {
  return useQuery({ queryKey: ['crm_opportunities', stage], queryFn: () => fetchOpportunities(stage) })
}

export function useCreateOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOpportunityInput) => createOpportunity(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_opportunities'] })
      Toast.show({ type: 'success', text1: 'Fırsat oluşturuldu' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Fırsat oluşturulamadı' }),
  })
}

export function useUpdateOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateOpportunity>[1] }) => updateOpportunity(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_opportunities'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}

export function useDeleteOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOpportunity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_opportunities'] })
      Toast.show({ type: 'success', text1: 'Fırsat silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}

export type { OpportunityWithCustomer }
