import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAppSetting, saveAppSetting } from './api'
import Toast from 'react-native-toast-message'

export function useAppSetting<T>(key: string) {
  return useQuery({ queryKey: ['app_settings', key], queryFn: () => fetchAppSetting<T>(key) })
}

export function useSaveAppSetting<T>() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: T }) => saveAppSetting(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app_settings'] })
      Toast.show({ type: 'success', text1: 'Ayar kaydedildi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Ayar kaydedilemedi' }),
  })
}
