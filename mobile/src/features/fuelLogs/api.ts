import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { VehicleFuelLog } from '@shared/types/database'

export interface CreateFuelLogInput {
  vehicle_id: string
  fill_date: string
  amount: number
  note?: string | null
}

export async function fetchFuelLogs(vehicleId?: string): Promise<VehicleFuelLog[]> {
  let query = supabase.from('vehicle_fuel_logs').select('*').order('fill_date', { ascending: false }).limit(100)
  if (vehicleId) query = query.eq('vehicle_id', vehicleId)
  const { data, error } = await query
  if (error) throw error
  return data as VehicleFuelLog[]
}

export async function createFuelLog(input: CreateFuelLogInput): Promise<VehicleFuelLog> {
  const userId = await getCurrentUserId()
  return offlineInsert<VehicleFuelLog>('vehicle_fuel_logs', {
    vehicle_id: input.vehicle_id,
    fill_date: input.fill_date,
    amount: input.amount,
    note: input.note ?? null,
    created_by: userId,
  }, 'Yakıt kaydı')
}

export async function deleteFuelLog(id: string): Promise<void> {
  return offlineDelete('vehicle_fuel_logs', id, 'Yakıt kaydı silme')
}
