import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCrmActivity,
  createCrmOpportunity,
  deleteCrmActivity,
  deleteCrmOpportunity,
  fetchCrmActivities,
  fetchCrmOpportunities,
  updateCrmOpportunity,
  type CrmActivityFilters,
  type CrmActivityInput,
  type CrmOpportunityFilters,
  type CrmOpportunityInput,
} from './api'

export function useCrmActivities(filters: CrmActivityFilters = {}) {
  return useQuery({
    queryKey: ['crm_activities', filters],
    queryFn: () => fetchCrmActivities(filters),
  })
}

export function useCreateCrmActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CrmActivityInput) => createCrmActivity(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_activities'] })
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Aktivite kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useDeleteCrmActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCrmActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_activities'] })
      toast.success('Aktivite silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCrmOpportunities(filters: CrmOpportunityFilters = {}) {
  return useQuery({
    queryKey: ['crm_opportunities', filters],
    queryFn: () => fetchCrmOpportunities(filters),
  })
}

export function useCreateCrmOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CrmOpportunityInput) => createCrmOpportunity(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_opportunities'] })
      toast.success('Fırsat eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateCrmOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CrmOpportunityInput }) => updateCrmOpportunity(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_opportunities'] })
      toast.success('Fırsat güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCrmOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCrmOpportunity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_opportunities'] })
      toast.success('Fırsat silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
