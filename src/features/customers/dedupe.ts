import { supabase } from '@/lib/supabaseClient'
import { trFold } from '@/lib/detectProvince'
import { formatTrPhoneForDisplay, normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import { deleteCustomer, updateCustomerFields, type CustomerInput } from './api'
import type { Customer } from '@/types/database'

/**
 * Yinelenen cari kayıtlarını bulup tek kayıtta birleştirme (kullanıcı
 * istekleri, 2026-10-01/02: "aynı isimdeki ya da numaradaki fazla olanları
 * sil, tek kayıt kalsın", "tümünü sil seçeneği olsun, onay verdikten sonra
 * silinebilsin").
 *
 * Kurallar:
 *  - Aynı isim (unvan/harf/Türkçe karakter farkı yok sayılarak) YA DA aynı
 *    numara (telefon/cep/WhatsApp) zincir halinde tek grup sayılır.
 *  - Her grupta bağlı kaydı (satış, tahsilat, fatura…) en çok, sonra dolu
 *    alanı en çok, sonra en eski kayıt TUTULUR.
 *  - Bir cari silinince ona bağlı tahsilat/satış/fatura/randevu… veritabanında
 *    otomatik silindiği için BAĞLI KAYDI OLAN fazlalık asla silinmez, atlanır.
 *  - Tutulan kayıtta boş alanlar silinenlerden doldurulur, farklı numaralar
 *    Notlar'a "Diğer numaralar…" olarak eklenir, etiketler birleştirilir.
 */

export function nameKey(name: string): string {
  return trFold(name)
    .replace(/\b(dr|doc|prof|uzm|op|dt|ecz|hoca|hanim|hnm|bey)\b\.?/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return normalizeTrPhone(digits.startsWith('00') ? digits.slice(2) : phone)?.canonical ?? null
}

/** Cari silinince CASCADE ile silinen ya da bağlantısı kopan tablolar. */
const LINKED_TABLES = [
  'appointments',
  'competitor_reports',
  'crm_activities',
  'crm_opportunities',
  'customer_pending_products',
  'customer_revenue_targets',
  'doctor_visits',
  'invoices',
  'payment_installment_plans',
  'payments',
  'quotes',
  'sales',
  'sample_requests',
  'stock_movements',
  'tasks',
  'visit_plans',
  'cargo_shipments',
] as const

const FILLABLE: (keyof CustomerInput & keyof Customer)[] = [
  'phone',
  'mobile_phone',
  'whatsapp_phone',
  'email',
  'province',
  'district',
  'region_id',
  'hospital_name',
  'instagram',
  'website',
  'address',
  'specialty',
]

export interface DuplicateGroup {
  keep: Customer
  extras: Customer[]
  /** Bağlı kaydı olduğu için silinmeyecek fazlalıklar */
  blocked: Customer[]
}

async function linkCounts(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const table of LINKED_TABLES) {
    const { data, error } = await supabase.from(table).select('customer_id').in('customer_id', ids)
    if (error) throw error
    for (const row of data ?? []) {
      const id = (row as { customer_id: string }).customer_id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

function groupDuplicates(customers: Customer[]): Customer[][] {
  const parent = new Map(customers.map((c) => [c.id, c.id]))
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!)
      x = parent.get(x)!
    }
    return x
  }
  const owner = new Map<string, string>()
  for (const c of customers) {
    const keys: string[] = []
    const nk = nameKey(c.full_name)
    if (nk) keys.push(`n:${nk}`)
    for (const p of [c.phone, c.mobile_phone, c.whatsapp_phone]) {
      const k = phoneKey(p)
      if (k) keys.push(`p:${k}`)
    }
    for (const k of keys) {
      const other = owner.get(k)
      if (other) parent.set(find(other), find(c.id))
      else owner.set(k, c.id)
    }
  }
  const groups = new Map<string, Customer[]>()
  for (const c of customers) {
    const root = find(c.id)
    groups.set(root, [...(groups.get(root) ?? []), c])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}

function filledCount(c: Customer): number {
  return Object.entries(c).filter(
    ([k, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0) && !['id', 'created_at', 'updated_at', 'created_by'].includes(k),
  ).length
}

export async function planDedupe(customers: Customer[]): Promise<DuplicateGroup[]> {
  const groups = groupDuplicates(customers)
  if (groups.length === 0) return []
  const links = await linkCounts(groups.flat().map((c) => c.id))
  const n = (c: Customer) => links.get(c.id) ?? 0
  return groups.map((g) => {
    const sorted = [...g].sort((a, b) => n(b) - n(a) || filledCount(b) - filledCount(a) || a.created_at.localeCompare(b.created_at))
    const [keep, ...rest] = sorted
    return { keep, extras: rest.filter((c) => n(c) === 0), blocked: rest.filter((c) => n(c) > 0) }
  })
}

/** Grupları birleştirip fazlalıkları siler; silinen kayıt sayısını döner. */
export async function executeDedupe(groups: DuplicateGroup[], onProgress?: (done: number) => void): Promise<number> {
  let deleted = 0
  let done = 0
  for (const g of groups) {
    if (g.extras.length > 0) {
      // Silmeden hemen önce bağlı kayıt olmadığını tekrar doğrula (bu arada eklenmiş olabilir)
      const fresh = await linkCounts(g.extras.map((e) => e.id))
      const extras = g.extras.filter((e) => !fresh.get(e.id))
      const keep = g.keep
      const patch: Partial<CustomerInput> = {}
      for (const f of FILLABLE) {
        if (keep[f] === null || keep[f] === '') {
          const src = extras.find((e) => e[f] !== null && e[f] !== '')
          if (src) (patch as Record<string, unknown>)[f] = src[f]
        }
      }
      const keepPhones = new Set(
        [patch.phone ?? keep.phone, patch.mobile_phone ?? keep.mobile_phone, patch.whatsapp_phone ?? keep.whatsapp_phone]
          .map(phoneKey)
          .filter(Boolean) as string[],
      )
      const others: string[] = []
      for (const e of extras)
        for (const p of [e.phone, e.mobile_phone, e.whatsapp_phone]) {
          const k = phoneKey(p)
          if (k && !keepPhones.has(k) && !others.includes(k)) others.push(k)
        }
      if (others.length > 0) {
        patch.notes = [keep.notes, `Diğer numaralar (birleştirilen yinelenen kayıtlardan): ${others.map(formatTrPhoneForDisplay).join(', ')}`]
          .filter(Boolean)
          .join('\n')
      }
      const tags = [...new Set([...keep.tags, ...extras.flatMap((e) => e.tags)])]
      if (tags.length !== keep.tags.length) patch.tags = tags
      if (Object.keys(patch).length > 0) await updateCustomerFields(keep.id, patch)
      for (const e of extras) {
        await deleteCustomer(e.id)
        deleted++
      }
    }
    done++
    onProgress?.(done)
  }
  return deleted
}
