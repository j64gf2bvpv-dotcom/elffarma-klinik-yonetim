import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStaff, updateStaff } from './api'
import type { Staff } from '@shared/types/database'
import Toast from 'react-native-toast-message'

export function useStaffList() {
  return useQuery({ queryKey: ['staff'], queryFn: fetchStaff })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Staff, 'role' | 'is_active' | 'full_name' | 'phone'>> }) =>
      updateStaff(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      Toast.show({ type: 'success', text1: 'Güncellendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}
