import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { Vehicle } from '@shared/types/database'

export interface VehicleWithRep extends Vehicle {
  sales_reps: { name: string } | null
}

export interface CreateVehicleInput {
  brand_model: string
  year?: number | null
  plate_number?: string | null
  vendor_company?: string | null
  sales_rep_id?: string | null
  monthly_rental_price?: number | null
  maintenance_date?: string | null
  has_utts?: boolean
  notes?: string | null
}

export async function fetchVehicles(): Promise<VehicleWithRep[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, sales_reps(name)')
    .order('brand_model', { ascending: true })
  if (error) throw error
  return data as unknown as VehicleWithRep[]
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return offlineInsert<Vehicle>('vehicles', { ...input, has_utts: input.has_utts ?? false }, `Araç: ${input.brand_model}`)
}

export async function updateVehicle(id: string, patch: Partial<CreateVehicleInput>): Promise<Vehicle> {
  return offlineUpdate<Vehicle>('vehicles', id, patch, 'Araç güncelleme')
}

export async function deleteVehicle(id: string): Promise<void> {
  return offlineDelete('vehicles', id, 'Araç silme')
}
