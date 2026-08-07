import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { fetchProducts, recordStockMovement, type RecordMovementInput } from './api'
import type { BrandLine, Product } from '@shared/types/database'

export function useProducts(search: string, brandLine?: BrandLine) {
  return useQuery({
    queryKey: ['products', search, brandLine],
    queryFn: () => fetchProducts(search, brandLine),
  })
}

/**
 * Masaüstündeki useRecordStockMovement'la aynı iyimser delta hesaplaması —
 * gerçek/otoriter miktar her zaman RPC'nin (offline kuyruğa düşse bile,
 * flush sonrası) sunucu tarafında hesapladığı değerdir; buradaki delta sadece
 * ekranın anında güncellenmesi için, invalidateQueries çağrısı gerçek
 * değerle senkronlar.
 */
export function useRecordStockMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordMovementInput) => recordStockMovement(input),
    onSuccess: (_data, variables) => {
      const delta =
        variables.movement_type === 'out' || variables.movement_type === 'sample' || variables.movement_type === 'disposal'
          ? -variables.quantity
          : variables.movement_type === 'in' || variables.movement_type === 'return' || variables.movement_type === 'adjustment'
            ? variables.quantity
            : 0
      if (delta !== 0) {
        queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
          old?.map((p) => (p.id === variables.product_id ? { ...p, current_quantity: p.current_quantity + delta } : p)),
        )
      }
      queryClient.invalidateQueries({ queryKey: ['products'] })
      Toast.show({ type: 'success', text1: 'Stok hareketi kaydedildi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Kaydedilemedi', text2: error.message }),
  })
}
