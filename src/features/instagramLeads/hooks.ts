import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchInstagramLeads,
  createInstagramLead,
  updateInstagramLead,
  deleteInstagramLead,
  type InstagramLeadInput,
} from './api'
import type { InstagramLead } from '@/types/database'

export function useInstagramLeads() {
  return useQuery({ queryKey: ['instagram_leads'], queryFn: fetchInstagramLeads })
}

export function useCreateInstagramLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InstagramLeadInput) => createInstagramLead(input),
    onSuccess: (created) => {
      queryClient.setQueryData<InstagramLead[]>(['instagram_leads'], (old) => [created, ...(old ?? [])])
      queryClient.invalidateQueries({ queryKey: ['instagram_leads'] })
      toast.success('Eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateInstagramLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: InstagramLeadInput }) => updateInstagramLead(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<InstagramLead[]>(['instagram_leads'], (old) =>
        old?.map((l) => (l.id === id ? { ...l, ...updated } : l)),
      )
      queryClient.invalidateQueries({ queryKey: ['instagram_leads'] })
      toast.success('Güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteInstagramLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstagramLead(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<InstagramLead[]>(['instagram_leads'], (old) => old?.filter((l) => l.id !== id))
      queryClient.invalidateQueries({ queryKey: ['instagram_leads'] })
      toast.success('Silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
