import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createHotel, deleteHotel, fetchHotels, setHotelActive } from './api'
import type { Hotel } from '@/types/database'

export function useHotels() {
  return useQuery({ queryKey: ['hotels'], queryFn: fetchHotels })
}

export function useCreateHotel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createHotel(name),
    onSuccess: (created) => {
      queryClient.setQueryData<Hotel[]>(['hotels'], (old) => (old ? [...old, created] : old))
      queryClient.invalidateQueries({ queryKey: ['hotels'] })
      toast.success('Otel eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useSetHotelActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => setHotelActive(id, is_active),
    onSuccess: (_data, { id, is_active }) => {
      queryClient.setQueryData<Hotel[]>(['hotels'], (old) => old?.map((h) => (h.id === id ? { ...h, is_active } : h)))
      queryClient.invalidateQueries({ queryKey: ['hotels'] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteHotel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteHotel(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Hotel[]>(['hotels'], (old) => old?.filter((h) => h.id !== id))
      queryClient.invalidateQueries({ queryKey: ['hotels'] })
      toast.success('Otel silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
