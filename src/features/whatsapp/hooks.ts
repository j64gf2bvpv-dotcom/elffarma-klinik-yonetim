import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteTemplate, fetchTemplates, upsertTemplate } from './api'

export function useWhatsAppTemplates() {
  return useQuery({ queryKey: ['whatsapp_templates'], queryFn: fetchTemplates })
}

export function useSaveWhatsAppTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_templates'] })
      toast.success('Şablon kaydedildi')
    },
    onError: (error: Error) => toast.error('Şablon kaydedilemedi', { description: error.message }),
  })
}

export function useDeleteWhatsAppTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp_templates'] })
      toast.success('Şablon silindi')
    },
    onError: (error: Error) => toast.error('Şablon silinemedi', { description: error.message }),
  })
}
