import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchMyPreferences, saveMyPreferences } from './api'
import type { StaffPreferences } from '@/types/database'

export function useMyPreferences() {
  return useQuery({ queryKey: ['staff_preferences', 'me'], queryFn: fetchMyPreferences })
}

export function useSaveMyPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Pick<StaffPreferences, 'dashboard_view' | 'dashboard_layout' | 'color_mode'>>) =>
      saveMyPreferences(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['staff_preferences', 'me'], updated)
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
