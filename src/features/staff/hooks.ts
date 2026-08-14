import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchStaff, updateStaff, updateMyProfile, uploadStaffAvatar } from './api'
import type { Staff } from '@/types/database'

export function useStaffList() {
  return useQuery({ queryKey: ['staff'], queryFn: fetchStaff })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<Pick<Staff, 'role' | 'is_active' | 'full_name' | 'phone' | 'hidden_nav_items'>>
    }) => updateStaff(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Personel güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<Pick<Staff, 'phone' | 'avatar_url' | 'job_title' | 'email' | 'address' | 'whatsapp_phone' | 'social_media'>>
    }) => updateMyProfile(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Profiliniz güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUploadStaffAvatar() {
  return useMutation({
    mutationFn: ({ staffId, file }: { staffId: string; file: File }) => uploadStaffAvatar(staffId, file),
    onError: (error: Error) => toast.error('Fotoğraf yüklenemedi', { description: error.message }),
  })
}
