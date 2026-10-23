import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { Vehicle, VehicleFuelLog } from '@/types/database'

export interface VehicleWithRelations extends Vehicle {
  sales_reps: { name: string } | null
}

/** Aracı kullanan kişinin görünen adı — elle yazılan isim, yoksa bağlı satış temsilcisi. */
export function vehicleUserName(v: VehicleWithRelations | null | undefined): string | null {
  return v?.driver_name?.trim() || v?.sales_reps?.name || null
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
  driver_name?: string | null
  monthly_rental_price: number | null
  maintenance_date: string | null
  has_utts: boolean
  notes: string | null
  /** Ruhsat bilgileri (2026-10-21) — hepsi opsiyonel */
  registration_image_path?: string | null
  owner_name?: string | null
  owner_tax_id?: string | null
  owner_address?: string | null
  chassis_number?: string | null
  engine_number?: string | null
  first_registration_date?: string | null
  registration_date?: string | null
  vehicle_class?: string | null
  vehicle_type?: string | null
  color?: string | null
  fuel_type?: string | null
  engine_capacity?: string | null
  engine_power?: string | null
  seat_count?: number | null
  usage_purpose?: string | null
  document_serial?: string | null
  inspection_valid_until?: string | null
  issued_place?: string | null
  registration_sequence_no?: string | null
  model_type?: string | null
  net_weight?: string | null
  max_laden_weight?: string | null
  train_weight?: string | null
  trailer_max_weight?: string | null
  standing_capacity?: string | null
  power_weight_ratio?: string | null
  type_approval_no?: string | null
  rights_holders?: string | null
  notary_sale_date?: string | null
  notary_sale_no?: string | null
  notary_name?: string | null
  other_info?: string | null
  license_front_path?: string | null
  license_back_path?: string | null
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
