import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import type { DoctorVisit } from '@/types/database'
import { ensureVisitCustomer } from './linkCustomer'

export interface DoctorVisitInput {
  visit_date: string
  doctor_name: string
  phone?: string | null
  email?: string | null
  social_media?: string | null
  notes?: string | null
  sales_rep_id: string
  customer_id?: string | null
  check_in_at?: string | null
  check_out_at?: string | null
  check_in_lat?: number | null
  check_in_lng?: number | null
  discussed_products?: string | null
  competitor_products?: string | null
  next_visit_date?: string | null
  signature_data?: string | null
}

export async function fetchVisitsInRange(from: string, to: string, salesRepId?: string): Promise<DoctorVisit[]> {
  let query = supabase
    .from('doctor_visits')
    .select('*')
    .gte('visit_date', from)
    .lte('visit_date', to)
    .order('visit_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (salesRepId) query = query.eq('sales_rep_id', salesRepId)
  const { data, error } = await query
  if (error) throw error
  return data as DoctorVisit[]
}

/**
 * doctor_visits'te henüz customer_id FK'si yok (doctor_name serbest metin) — doktor
 * detay sayfasının ZİYARETLER sekmesi bu yüzden isim eşleştirmesiyle çalışır.
 */
export async function fetchVisitsByDoctorName(doctorName: string): Promise<DoctorVisit[]> {
  const { data, error } = await supabase
    .from('doctor_visits')
    .select('*')
    .eq('doctor_name', doctorName)
    .order('visit_date', { ascending: false })
  if (error) throw error
  return data as DoctorVisit[]
}

/**
 * Temsilci başına şimdiye kadar görüşülen FARKLI doktor sayısı (kullanıcı isteği, 2026-11-13). Aynı doktor
 * Cari Kart bağlantısıyla (yoksa adıyla) bir kez sayılır.
 */
export async function fetchRepDoctorTotals(): Promise<Record<string, number>> {
  const sets = new Map<string, Set<string>>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('doctor_visits').select('sales_rep_id, customer_id, doctor_name').order('id').range(from, from + 999)
    if (error) throw error
    for (const v of data as { sales_rep_id: string | null; customer_id: string | null; doctor_name: string }[]) {
      if (!v.sales_rep_id) continue
      const set = sets.get(v.sales_rep_id) ?? new Set<string>()
      set.add(v.customer_id ?? v.doctor_name.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim())
      sets.set(v.sales_rep_id, set)
    }
    if (!data || data.length < 1000) break
  }
  return Object.fromEntries([...sets].map(([k, v]) => [k, v.size]))
}

/** Kaydı olan bütün ziyaret tarihleri (geçmiş/ileri haftaların raporlarını seçmek için) */
export async function fetchVisitDates(): Promise<string[]> {
  const { data, error } = await supabase.from('doctor_visits').select('visit_date').order('visit_date', { ascending: false })
  if (error) throw error
  return (data as { visit_date: string }[]).map((r) => r.visit_date)
}

/**
 * Cari Kart'a bağlı değilse doktoru Cari Kart'ta bulur ya da ekler (bkz. linkCustomer.ts); ziyarette telefon
 * yoksa Cari Kart'taki numara ziyarete yazılır (kullanıcı isteği, 2026-11-13). Hata ziyaret kaydını engellemez.
 */
async function withCustomer(input: DoctorVisitInput): Promise<DoctorVisitInput> {
  if (!input.doctor_name.trim()) return input
  try {
    if (input.customer_id) {
      if (input.phone?.trim()) return input
      const { data } = await supabase.from('customers').select('phone, mobile_phone, whatsapp_phone').eq('id', input.customer_id).maybeSingle()
      const c = data as { phone: string | null; mobile_phone: string | null; whatsapp_phone: string | null } | null
      const phone = c?.phone?.trim() || c?.mobile_phone?.trim() || c?.whatsapp_phone?.trim()
      return phone ? { ...input, phone } : input
    }
    const found = await ensureVisitCustomer(input.doctor_name, input.phone, input.sales_rep_id, input.visit_date)
    if (!found) return input
    return { ...input, customer_id: found.id, phone: input.phone?.trim() || found.phone || input.phone }
  } catch (err) {
    console.warn('[ziyaret] Cari Kart eşleştirilemedi', err)
    return input
  }
}

export async function createVisit(input: DoctorVisitInput): Promise<DoctorVisit> {
  const body = await withCustomer(input)
  return offlineInsert<DoctorVisit>('doctor_visits', { ...body }, `Doktor ziyareti: ${input.doctor_name}`)
}

export async function updateVisit(id: string, input: DoctorVisitInput): Promise<DoctorVisit> {
  const body = await withCustomer(input)
  return offlineUpdate<DoctorVisit>('doctor_visits', id, { ...body }, `Doktor ziyareti güncelleme: ${input.doctor_name}`)
}

/** Toplu silme (kullanıcı isteği, 2026-11-13: "tüm kayıtları sil"): tarih aralığı verilmezse bütün ziyaretler. Cari Kart kartlarına dokunmaz. */
export async function deleteVisitsInRange(from?: string, to?: string): Promise<number> {
  let query = supabase.from('doctor_visits').delete({ count: 'exact' }).not('id', 'is', null)
  if (from) query = query.gte('visit_date', from)
  if (to) query = query.lte('visit_date', to)
  const { error, count } = await query
  if (error) throw error
  return count ?? 0
}

export async function deleteVisit(id: string): Promise<void> {
  return offlineDelete('doctor_visits', id, 'Doktor ziyareti silme')
}
