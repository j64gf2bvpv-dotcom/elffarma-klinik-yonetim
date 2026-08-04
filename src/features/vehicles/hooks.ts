import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  fetchVehicleFuelLogs,
  fetchAllVehicleFuelLogs,
  createVehicleFuelLog,
  deleteVehicleFuelLog,
  type VehicleInput,
  type VehicleFuelLogInput,
} from './api'

export function useVehicles() {
  return useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VehicleInput) => createVehicle(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Araç eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<VehicleInput> }) => updateVehicle(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Araç güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Araç silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useVehicleFuelLogs(vehicleId: string) {
  return useQuery({
    queryKey: ['vehicle_fuel_logs', vehicleId],
    queryFn: () => fetchVehicleFuelLogs(vehicleId),
    enabled: !!vehicleId,
  })
}

export function useAllVehicleFuelLogs() {
  return useQuery({ queryKey: ['vehicle_fuel_logs', 'all'], queryFn: fetchAllVehicleFuelLogs })
}

export function useCreateVehicleFuelLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VehicleFuelLogInput) => createVehicleFuelLog(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_fuel_logs', input.vehicle_id] })
      queryClient.invalidateQueries({ queryKey: ['vehicle_fuel_logs', 'all'] })
      toast.success('Yakıt kaydı eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeleteVehicleFuelLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVehicleFuelLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_fuel_logs'] })
      toast.success('Yakıt kaydı silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
