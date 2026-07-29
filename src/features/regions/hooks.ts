import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createRegion, deleteRegion, fetchRegions, type RegionInput } from './api'
import type { Region } from '@/types/database'

export function useRegions() {
  return useQuery({ queryKey: ['regions'], queryFn: fetchRegions })
}

export function useCreateRegion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegionInput) => createRegion(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Region[]>(['regions'], (old) =>
        old ? [...old, created].sort((a, b) => a.name.localeCompare(b.name, 'tr')) : old,
      )
      queryClient.invalidateQueries({ queryKey: ['regions'] })
      toast.success('Bölge eklendi')
    },
    onError: (error: Error) => toast.error('Bölge eklenemedi', { description: error.message }),
  })
}

export function useDeleteRegion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRegion(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Region[]>(['regions'], (old) => old?.filter((r) => r.id !== id))
      queryClient.invalidateQueries({ queryKey: ['regions'] })
      toast.success('Bölge silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
