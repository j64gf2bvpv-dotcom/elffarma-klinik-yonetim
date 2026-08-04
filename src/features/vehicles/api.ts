import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { Vehicle, VehicleFuelLog } from '@/types/database'

export interface VehicleWithRelations extends Vehicle {
  sales_reps: { name: string } | null
}

export async function fetchVehicles(): Promise<VehicleWithRelations[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, sales_reps(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as VehicleWithRelations[]
}

export interface VehicleInput {
  brand_model: string
  year: number | null
  plate_number: string | null
  registration_info: string | null
  vendor_company: string | null
  sales_rep_id: string | null
  monthly_rental_price: number | null
  maintenance_date: string | null
  has_utts: boolean
  notes: string | null
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  return offlineInsert<Vehicle>('vehicles', { ...input }, `Araç: ${input.brand_model}`)
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle> {
  return offlineUpdate<Vehicle>('vehicles', id, { ...input }, 'Araç güncelleme')
}

export async function deleteVehicle(id: string): Promise<void> {
  return offlineDelete('vehicles', id, 'Araç silme')
}

export async function fetchVehicleFuelLogs(vehicleId: string): Promise<VehicleFuelLog[]> {
  const { data, error } = await supabase
    .from('vehicle_fuel_logs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('fill_date', { ascending: false })
  if (error) throw error
  return data as VehicleFuelLog[]
}

export async function fetchAllVehicleFuelLogs(): Promise<VehicleFuelLog[]> {
  const { data, error } = await supabase
    .from('vehicle_fuel_logs')
    .select('*')
    .order('fill_date', { ascending: false })
  if (error) throw error
  return data as VehicleFuelLog[]
}

export interface VehicleFuelLogInput {
  vehicle_id: string
  fill_date: string
  amount: number
  note: string | null
}

export async function createVehicleFuelLog(input: VehicleFuelLogInput): Promise<VehicleFuelLog> {
  return offlineInsert<VehicleFuelLog>('vehicle_fuel_logs', { ...input }, `Yakıt kaydı: ${input.amount} ₺`)
}

export async function deleteVehicleFuelLog(id: string): Promise<void> {
  return offlineDelete('vehicle_fuel_logs', id, 'Yakıt kaydı silme')
}
