import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchStaff, updateStaff } from './api'
import type { Staff } from '@/types/database'

export function useStaffList() {
  return useQuery({ queryKey: ['staff'], queryFn: fetchStaff })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Pick<Staff, 'role' | 'is_active' | 'full_name' | 'phone'>> }) =>
      updateStaff(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Personel güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}
