import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createProduct,
  deactivateProduct,
  fetchProducts,
  fetchStockMovements,
  recordStockMovement,
  updateProduct,
  type ProductInput,
  type RecordMovementInput,
} from './api'
import type { BrandLine, Product } from '@/types/database'

export function useProducts(search: string, brandLine?: BrandLine) {
  return useQuery({ queryKey: ['products', search, brandLine], queryFn: () => fetchProducts(search, brandLine) })
}

export function useStockMovements(productId: string | undefined) {
  return useQuery({
    queryKey: ['stock_movements', productId],
    queryFn: () => fetchStockMovements(productId as string),
    enabled: !!productId,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) => (old ? [...old, created] : old))
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ürün eklendi')
    },
    onError: (error: Error) => toast.error('Ürün eklenemedi', { description: error.message }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductInput }) => updateProduct(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ürün güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateProduct(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) => old?.filter((p) => p.id !== id))
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ürün pasife alındı')
    },
    onError: (error: Error) => toast.error('İşlem başarısız', { description: error.message }),
  })
}

export function useRecordStockMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordMovementInput) => recordStockMovement(input),
    onSuccess: (_data, variables) => {
      const delta =
        variables.movement_type === 'out'
          ? -variables.quantity
          : variables.movement_type === 'in'
            ? variables.quantity
            : 0
      if (delta !== 0) {
        queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
          old?.map((p) =>
            p.id === variables.product_id ? { ...p, current_quantity: p.current_quantity + delta } : p,
          ),
        )
      }
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements', variables.product_id] })
      toast.success('Stok hareketi kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
