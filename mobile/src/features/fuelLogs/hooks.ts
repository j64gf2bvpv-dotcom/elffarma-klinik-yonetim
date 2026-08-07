import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchFuelLogs, createFuelLog, deleteFuelLog, type CreateFuelLogInput } from './api'
import Toast from 'react-native-toast-message'

export function useFuelLogs(vehicleId?: string) {
  return useQuery({ queryKey: ['vehicle_fuel_logs', vehicleId], queryFn: () => fetchFuelLogs(vehicleId) })
}

export function useCreateFuelLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFuelLogInput) => createFuelLog(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle_fuel_logs'] })
      Toast.show({ type: 'success', text1: 'Yakıt kaydı eklendi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Eklenemedi' }),
  })
}

export function useDeleteFuelLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFuelLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicle_fuel_logs'] }),
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
