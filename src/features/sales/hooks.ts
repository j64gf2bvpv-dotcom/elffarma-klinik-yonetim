import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchSales, createSale, updateSaleRep, deleteSale, type SaleInput, type SaleWithRelations } from './api'

export function useSales() {
  return useQuery({ queryKey: ['sales'], queryFn: () => fetchSales() })
}

export function useSalesInRange(from: string, to: string) {
  return useQuery({ queryKey: ['sales', 'range', from, to], queryFn: () => fetchSales({ from, to }) })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaleInput) => createSale(input),
    onSuccess: (created) => {
      queryClient.setQueryData<SaleWithRelations[]>(['sales'], (old) => [
        { ...created, customers: null, sales_reps: null },
        ...(old ?? []),
      ])
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useUpdateSaleRep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, salesRepId }: { id: string; salesRepId: string | null }) => updateSaleRep(id, salesRepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast.success('Satış temsilcisi güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SaleWithRelations[]>(['sales'], (old) => old?.filter((s) => s.id !== id))
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast.success('Silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
