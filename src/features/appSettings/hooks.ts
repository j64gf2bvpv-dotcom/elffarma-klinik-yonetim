import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchAppSetting, saveAppSetting } from './api'

export function useAppSetting<T>(key: string) {
  return useQuery({
    queryKey: ['app_settings', key],
    queryFn: () => fetchAppSetting<T>(key),
  })
}

export function useSaveAppSetting<T>(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: T) => saveAppSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings', key] })
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
