import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  addCountItem,
  completeCount,
  deleteCountItem,
  fetchCountItems,
  fetchPastCounts,
  fetchTodayCount,
  reopenCount,
  setCountStatusManually,
  startTodayCount,
  updateCountItem,
  updateCountItemFlakon,
} from './api'
import type { Product, StockCount } from '@/types/database'

export function useTodayCount() {
  return useQuery({ queryKey: ['stock_counts', 'today'], queryFn: fetchTodayCount })
}

export function usePastCounts() {
  return useQuery({ queryKey: ['stock_counts', 'past'], queryFn: fetchPastCounts })
}

export function useCountItems(stockCountId: string | undefined) {
  return useQuery({
    queryKey: ['stock_count_items', stockCountId],
    queryFn: () => fetchCountItems(stockCountId as string),
    enabled: !!stockCountId,
  })
}

export function useStartTodayCount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startTodayCount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_counts'] })
      toast.success('Bugünün sayımı başlatıldı')
    },
    onError: (error: Error) => toast.error('Başlatılamadı', { description: error.message }),
  })
}

export function useUpdateCountItem(stockCountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, counted_quantity }: { id: string; counted_quantity: number | null }) =>
      updateCountItem(id, counted_quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_count_items', stockCountId] })
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useUpdateCountItemFlakon(stockCountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, counted_quantity_flakon }: { id: string; counted_quantity_flakon: number | null }) =>
      updateCountItemFlakon(id, counted_quantity_flakon),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_count_items', stockCountId] })
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useAddCountItem(stockCountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (product: Pick<Product, 'id' | 'current_quantity' | 'flakon_quantity'>) =>
      addCountItem(stockCountId, product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_count_items', stockCountId] })
      toast.success('Ürün sayıma eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeleteCountItem(stockCountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCountItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_count_items', stockCountId] })
      toast.success('Ürün sayımdan çıkarıldı')
    },
    onError: (error: Error) => toast.error('Çıkarılamadı', { description: error.message }),
  })
}

export function useCompleteCount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stockCountId: string) => completeCount(stockCountId),
    onSuccess: (_data, stockCountId) => {
      queryClient.invalidateQueries({ queryKey: ['stock_counts'] })
      queryClient.invalidateQueries({ queryKey: ['stock_count_items', stockCountId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Sayım tamamlandı, stok güncellendi')
    },
    onError: (error: Error) => toast.error('Tamamlanamadı', { description: error.message }),
  })
}

export function useReopenCount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stockCountId: string) => reopenCount(stockCountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_counts'] })
      toast.success('Sayım yeniden açıldı')
    },
    onError: (error: Error) => toast.error('Açılamadı', { description: error.message }),
  })
}

export function useSetCountStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stockCountId, status }: { stockCountId: string; status: StockCount['status'] }) =>
      setCountStatusManually(stockCountId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_counts'] })
      toast.success('Sayım durumu güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}
