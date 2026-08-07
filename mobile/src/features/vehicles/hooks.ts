import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchVehicles, createVehicle, updateVehicle, deleteVehicle, type CreateVehicleInput } from './api'
import Toast from 'react-native-toast-message'

export function useVehicles() {
  return useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => createVehicle(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      Toast.show({ type: 'success', text1: 'Araç eklendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Eklenemedi' }),
  })
}

export function useUpdateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateVehicleInput> }) => updateVehicle(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
