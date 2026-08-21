import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCongressShipment,
  deleteCongressShipment,
  fetchCongressShipments,
  updateCongressShipmentReturns,
  type CongressShipmentInput,
} from './api'

export function useCongressShipments() {
  return useQuery({ queryKey: ['congress_shipments'], queryFn: fetchCongressShipments })
}

export function useCreateCongressShipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CongressShipmentInput) => createCongressShipment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['congress_shipments'] })
      toast.success('Sevkiyat kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useUpdateCongressShipmentReturns() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      returns,
    }: {
      id: string
      returns: { quantity_returned_sealed: number; quantity_returned_open: number }
    }) => updateCongressShipmentReturns(id, returns),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['congress_shipments'] })
      toast.success('Dönüş miktarı güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCongressShipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCongressShipment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['congress_shipments'] })
      toast.success('Silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
