import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  clearSampleStockData,
  createProduct,
  createProductCatalog,
  createProductLot,
  deactivateProduct,
  deleteStockMovement,
  fetchAllProductLots,
  fetchAllStockMovements,
  fetchProductCatalogs,
  fetchProductLots,
  fetchProducts,
  fetchSampleProducts,
  fetchStockMovements,
  recordStockMovement,
  reorderProducts,
  seedSampleStockData,
  updateProduct,
  updateProductCampaign,
  updateProductCategory,
  updateProductName,
  updateProductPrice,
  updateStockMovement,
  type ProductInput,
  type ProductLotInput,
  type RecordMovementInput,
  type UpdateMovementInput,
} from './api'
import type { BrandLine, Product, ProductCatalog, ProductLot } from '@/types/database'

export function useProducts(search: string, brandLine?: BrandLine) {
  return useQuery({ queryKey: ['products', search, brandLine], queryFn: () => fetchProducts(search, brandLine) })
}

export function useProductCatalogs() {
  return useQuery({ queryKey: ['product_catalogs'], queryFn: fetchProductCatalogs })
}

export function useCreateProductCatalog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => {
      const current = queryClient.getQueryData<ProductCatalog[]>(['product_catalogs']) ?? []
      const nextSortOrder = current.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1
      return createProductCatalog(name, nextSortOrder)
    },
    onSuccess: (created) => {
      queryClient.setQueryData<ProductCatalog[]>(['product_catalogs'], (old) => (old ? [...old, created] : old))
      queryClient.invalidateQueries({ queryKey: ['product_catalogs'] })
      toast.success('Katalog eklendi')
    },
    onError: (error: Error) => toast.error('Katalog eklenemedi', { description: error.message }),
  })
}

export function useStockMovements(productId: string | undefined) {
  return useQuery({
    queryKey: ['stock_movements', productId],
    queryFn: () => fetchStockMovements(productId as string),
    enabled: !!productId,
  })
}

export function useAllStockMovements() {
  return useQuery({ queryKey: ['stock_movements', 'all'], queryFn: fetchAllStockMovements })
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

export function useUpdateProductCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, campaign }: { id: string; campaign: string | null }) => updateProductCampaign(id, campaign),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Kampanya güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateProductCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: string | null }) => updateProductCategory(id, category),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Kategori güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateProductName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateProductName(id, name),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ürün adı güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateProductPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, unit_price }: { id: string; unit_price: number | null }) => updateProductPrice(id, unit_price),
    onSuccess: (updated, { id }) => {
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Satış fiyatı güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useReorderProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) => reorderProducts(updates),
    onSuccess: (_data, updates) => {
      const orderById = new Map(updates.map((u) => [u.id, u.sort_order]))
      queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
        old?.map((p) => (orderById.has(p.id) ? { ...p, sort_order: orderById.get(p.id)! } : p)),
      )
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => toast.error('Sıra kaydedilemedi', { description: error.message }),
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
        variables.movement_type === 'out' || variables.movement_type === 'sample' || variables.movement_type === 'disposal'
          ? -variables.quantity
          : variables.movement_type === 'in' || variables.movement_type === 'return' || variables.movement_type === 'adjustment'
            ? variables.quantity
            : 0
      // RPC'nin kendi dallanmasını yansıtır (bkz. decouple_flakon_from_paket_movements
      // migration'ı): paket ve flakon tamamen bağımsız — paket hareketi sadece
      // current_quantity'i, flakon hareketi sadece flakon_quantity'i değiştirir.
      if (delta !== 0) {
        queryClient.setQueriesData<Product[]>({ queryKey: ['products'] }, (old) =>
          old?.map((p) => {
            if (p.id !== variables.product_id) return p
            if (variables.unit_kind === 'flakon') {
              return { ...p, flakon_quantity: Math.max(0, p.flakon_quantity + delta) }
            }
            return { ...p, current_quantity: Math.max(0, p.current_quantity + delta) }
          }),
        )
      }
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      if (variables.lot_id) {
        queryClient.invalidateQueries({ queryKey: ['product_lots', variables.product_id] })
        queryClient.invalidateQueries({ queryKey: ['product_lots', 'all'] })
      }
      toast.success('Stok hareketi kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

function invalidateStockMovementEffects(queryClient: ReturnType<typeof useQueryClient>, lotId?: string | null) {
  queryClient.invalidateQueries({ queryKey: ['products'] })
  queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
  if (lotId) {
    queryClient.invalidateQueries({ queryKey: ['product_lots'] })
  }
}

export function useUpdateStockMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateMovementInput) => updateStockMovement(input),
    onSuccess: (_data, variables) => {
      invalidateStockMovementEffects(queryClient, variables.lot_id)
      toast.success('Stok hareketi güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteStockMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStockMovement(id),
    onSuccess: () => {
      invalidateStockMovementEffects(queryClient)
      toast.success('Stok hareketi silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useProductLots(productId: string | undefined) {
  return useQuery({
    queryKey: ['product_lots', productId],
    queryFn: () => fetchProductLots(productId as string),
    enabled: !!productId,
  })
}

export function useAllProductLots() {
  return useQuery({ queryKey: ['product_lots', 'all'], queryFn: fetchAllProductLots })
}

export function useCreateProductLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProductLotInput) => createProductLot(input),
    onSuccess: (created) => {
      queryClient.setQueryData<ProductLot[]>(['product_lots', created.product_id], (old) =>
        old ? [...old, created] : old,
      )
      queryClient.invalidateQueries({ queryKey: ['product_lots'] })
      toast.success('Lot eklendi')
    },
    onError: (error: Error) => toast.error('Lot eklenemedi', { description: error.message }),
  })
}

export function useSampleProducts() {
  return useQuery({ queryKey: ['products', 'sample'], queryFn: fetchSampleProducts })
}

export function useSeedSampleStockData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: seedSampleStockData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      toast.success('Örnek veri eklendi')
    },
    onError: (error: Error) => toast.error('Örnek veri eklenemedi', { description: error.message }),
  })
}

export function useClearSampleStockData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clearSampleStockData,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      toast.success(`${count} örnek ürün temizlendi`)
    },
    onError: (error: Error) => toast.error('Temizlenemedi', { description: error.message }),
  })
}
