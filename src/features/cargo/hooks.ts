import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchCargoShipments,
  createCargoShipment,
  updateCargoShipment,
  updateCargoShipmentStatus,
  markCargoShipped,
  revertCargoShipped,
  deleteCargoShipment,
  type CargoShipmentInput,
} from './api'
import type { CargoShipment, CargoStatus } from '@/types/database'

export function useCargoShipments() {
  return useQuery({ queryKey: ['cargo_shipments'], queryFn: fetchCargoShipments })
}

function invalidateCargo(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['cargo_shipments'] })
  queryClient.invalidateQueries({ queryKey: ['reminders'] })
}

export function useCreateCargoShipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CargoShipmentInput) => createCargoShipment(input),
    onSuccess: () => {
      invalidateCargo(queryClient)
      toast.success('Kargo kaydı eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateCargoShipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CargoShipmentInput> }) => updateCargoShipment(id, input),
    onSuccess: () => {
      invalidateCargo(queryClient)
      toast.success('Kargo kaydı güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateCargoStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ shipment, status }: { shipment: CargoShipment; status: CargoStatus }) => {
      // "gonderildi" durumuna geçiş ayrı bir fonksiyon (markCargoShipped) —
      // stok düşümünü de tetikliyor. Zaten gönderilmiş bir kaydı tekrar
      // "gönderildi" yapmaya çalışmak stoktan ikinci kez düşürmesin diye
      // burada engelleniyor. "gonderildi"den GERİ dönüş de ayrı bir fonksiyon
      // (revertCargoShipped) — düşülen stoğu geri ekler (kullanıcı isteği,
      // 2026-08-24: durum her yöne serbestçe değiştirilebilmeli).
      if (status === shipment.status) return Promise.resolve(shipment)
      if (status === 'gonderildi') return markCargoShipped(shipment)
      if (shipment.status === 'gonderildi') return revertCargoShipped(shipment, status)
      return updateCargoShipmentStatus(shipment.id, status)
    },
    onSuccess: () => {
      invalidateCargo(queryClient)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Kargo durumu güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCargoShipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (shipment: CargoShipment) => deleteCargoShipment(shipment),
    onSuccess: () => {
      invalidateCargo(queryClient)
      toast.success('Kargo kaydı silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
