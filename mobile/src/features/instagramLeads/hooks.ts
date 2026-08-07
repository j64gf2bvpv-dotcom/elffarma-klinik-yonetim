import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchInstagramLeads, createInstagramLead, deleteInstagramLead, type CreateLeadInput } from './api'
import Toast from 'react-native-toast-message'

export function useInstagramLeads() {
  return useQuery({ queryKey: ['instagram_leads'], queryFn: fetchInstagramLeads })
}

export function useCreateInstagramLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeadInput) => createInstagramLead(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instagram_leads'] })
      Toast.show({ type: 'success', text1: 'Lead eklendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Eklenemedi' }),
  })
}

export function useDeleteInstagramLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstagramLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instagram_leads'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
