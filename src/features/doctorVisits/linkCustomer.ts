import { supabase } from '@/lib/supabaseClient'
import { cleanDoctorName } from '@/lib/cleanDoctorName'
import { createCustomer, updateCustomerFields } from '@/features/customers/api'
import { nameKey, phoneKey } from '@/features/customers/dedupe'
import { cleanVisitName } from './reportParser'

type CariRow = { id: string; full_name: string; phone: string | null; mobile_phone: string | null; whatsapp_phone: string | null }

let cache: { at: number; list: CariRow[] } | null = null

async function loadCari(): Promise<CariRow[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list
  const { data, error } = await supabase.from('customers').select('id, full_name, phone, mobile_phone, whatsapp_phone')
  if (error) throw error
  cache = { at: Date.now(), list: (data ?? []) as CariRow[] }
  return cache.list
}

async function repName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null
  const { data } = await supabase.from('sales_reps').select('name').eq('id', id).maybeSingle()
  return (data as { name: string } | null)?.name ?? null
}

// Kurum adları ("Snap Clinic", "Kardelen Tıp Merkezi") olduğu gibi; kişi adları "Dr. Ad SOYAD" düzeninde
const ORG_RE = /klinik|clinic|merkez|sağlık|hizmet|medikal|medical|estetik|aesthetic|poliklinik|hastane|work|este\b|güzellik|ltd|a\.ş/i
export function cariName(doctorName: string): string {
  const name = cleanVisitName(doctorName)
  return ORG_RE.test(name) ? name : cleanDoctorName(name).name || name
}

const surname = (key: string) => key.split(' ').filter(Boolean).pop() ?? ''

/**
 * Ziyarete eklenen doktoru Cari Kart'la eşleştirir (kullanıcı isteği, 2026-11-13: "eklediğim doktorları cari
 * ile kıyasla, yoksa ismini ve telefon numarasını oraya da ekle"). Eşleşme: ünvan/büyük-küçük harf farkı
 * gözetmeden aynı isim; isim tutmazsa aynı telefon + aynı soyadı (ortak klinik hattı yanlış eşleşmesin).
 * Kartta telefon boşsa ziyaretteki telefon yazılır. Hiç yoksa Cari Kart düzeninde ("Dr. Ad SOYAD") yeni kart
 * açılır; kartta temsilci (sales_rep_id) ve "Ekleyen: Duygu — ziyaret raporu, 23.10.2026" notu durur
 * ("hangi personel tarafından eklendiğini bileyim"). Dönen id ziyaretin customer_id'si olur.
 */
export async function ensureVisitCustomer(
  doctorName: string,
  phone: string | null | undefined,
  salesRepId: string | null | undefined,
  visitDate: string,
): Promise<string | null> {
  const key = nameKey(cleanVisitName(doctorName))
  if (!key) return null
  const list = await loadCari()
  const pk = phoneKey(phone)
  const phones = (c: CariRow) => [c.phone, c.mobile_phone, c.whatsapp_phone].map(phoneKey)

  const match =
    list.find((c) => nameKey(c.full_name) === key) ??
    (pk ? list.find((c) => phones(c).includes(pk) && surname(nameKey(c.full_name)) === surname(key)) : undefined)

  if (match) {
    if (pk && !match.phone?.trim()) {
      await updateCustomerFields(match.id, { phone: phone!.trim() })
      match.phone = phone!.trim()
    }
    return match.id
  }

  const rep = await repName(salesRepId)
  const created = await createCustomer({
    full_name: cariName(doctorName),
    phone: phone?.trim() ?? '',
    tags: ['ziyaret'],
    is_invoiced: false,
    doctor_type: 'sahis',
    sales_rep_id: salesRepId ?? null,
    notes: `Ekleyen: ${rep ?? 'Temsilci'} — ziyaret raporu, ${visitDate.split('-').reverse().join('.')}`,
  })
  list.push({ id: created.id, full_name: created.full_name, phone: created.phone, mobile_phone: null, whatsapp_phone: null })
  return created.id
}
