import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createWarehouse, deleteWarehouse, fetchWarehouses, setWarehouseActive } from './api'
import type { Warehouse } from '@/types/database'

export function useWarehouses() {
  return useQuery({ queryKey: ['warehouses'], queryFn: fetchWarehouses })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createWarehouse(name),
    onSuccess: (created) => {
      queryClient.setQueryData<Warehouse[]>(['warehouses'], (old) => (old ? [...old, created] : old))
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Depo eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useSetWarehouseActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => setWarehouseActive(id, is_active),
    onSuccess: (_data, { id, is_active }) => {
      queryClient.setQueryData<Warehouse[]>(['warehouses'], (old) =>
        old?.map((w) => (w.id === id ? { ...w, is_active } : w)),
      )
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Warehouse[]>(['warehouses'], (old) => old?.filter((w) => w.id !== id))
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Depo silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
