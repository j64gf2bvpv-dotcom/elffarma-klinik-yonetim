import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  addStockToCountItem,
  completeCount,
  fetchCountItems,
  fetchPastCounts,
  fetchTodayCount,
  startTodayCount,
  updateCountItem,
  type StockCountItemWithProduct,
} from './api'

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

export function useAddStockToCountItem(stockCountId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ item, diff }: { item: StockCountItemWithProduct; diff: number }) => addStockToCountItem(item, diff),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_count_items', stockCountId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Stok güncellendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
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
