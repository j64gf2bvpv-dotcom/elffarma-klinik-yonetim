// Masaüstündeki src/features/congresses/api.ts'in mobil alt kümesi — liste +
// detay okuma, katılımcı ekleme/yoklama güncelleme. Görsel yükleme, checklist,
// sarf malzeme ve stok dağıtım yönetimi masaüstünde kalıyor (Faz 1 kapsamı).
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate } from '@/lib/offlineMutation'
import type { AttendanceStatus, Congress, CongressParticipant, CongressParticipantProduct } from '@shared/types/database'

export async function fetchCongresses(): Promise<Congress[]> {
  const { data, error } = await supabase
    .from('congresses')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data as Congress[]
}

export type ParticipantWithProducts = CongressParticipant & {
  congress_participant_products: CongressParticipantProduct[]
}

export async function fetchParticipants(congressId: string): Promise<ParticipantWithProducts[]> {
  const { data, error } = await supabase
    .from('congress_participants')
    .select('*, congress_participant_products(*)')
    .eq('congress_id', congressId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as ParticipantWithProducts[]
}

export type ParticipationWithCongress = CongressParticipant & { congresses: { name: string; start_date: string | null } | null }

/** congress_participants doktora customer_id FK'si ile değil doctor_name
 * serbest metniyle bağlı — Doktor Detay'daki Etkinlikler sekmesi isim
 * eşleştirmesiyle çalışır (masaüstündeki aynı yaklaşım). */
export async function fetchParticipationsByDoctorName(doctorName: string): Promise<ParticipationWithCongress[]> {
  const { data, error } = await supabase
    .from('congress_participants')
    .select('*, congresses(name, start_date)')
    .eq('doctor_name', doctorName)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as ParticipationWithCongress[]
}

export interface CreateParticipantInput {
  congress_id: string
  doctor_name: string
  flight_cost?: number
  registration_cost?: number
  accommodation_cost?: number
  notes?: string | null
  attendance_status?: AttendanceStatus
}

export async function createParticipant(input: CreateParticipantInput): Promise<CongressParticipant> {
  return offlineInsert<CongressParticipant>(
    'congress_participants',
    {
      congress_id: input.congress_id,
      doctor_name: input.doctor_name,
      flight_cost: input.flight_cost ?? 0,
      registration_cost: input.registration_cost ?? 0,
      accommodation_cost: input.accommodation_cost ?? 0,
      notes: input.notes ?? null,
      attendance_status: input.attendance_status ?? 'registered',
      qr_code: crypto.randomUUID(),
    },
    `Kongre katılımcısı: ${input.doctor_name}`,
  )
}

export async function updateAttendanceStatus(id: string, attendance_status: AttendanceStatus): Promise<CongressParticipant> {
  return offlineUpdate<CongressParticipant>('congress_participants', id, { attendance_status }, 'Yoklama durumu güncelleme')
}
