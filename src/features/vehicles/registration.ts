import { supabase } from '@/lib/supabaseClient'
import { resizeImageFile } from '@/lib/resizeImage'
import type { AIService } from '@/features/ai/AIService'
import { parseAiJsonObject } from '@/features/smartImport/parseAiJsonArray'
import { chatWithFallback } from '@/features/ai/chatWithFallback'

/**
 * Araç ruhsatı (Araç Tescil Belgesi) — fotoğraf yükleme + yapay zekâ ile okuma
 * (kullanıcı isteği, 2026-10-21: "ruhsatın resmini ekle kısmı olsun, ekleyince
 * bütün bilgiler eklensin"). Fotoğraf private 'documents' bucket'ına küçültülerek
 * yüklenir (ruhsat kişisel veri — public değil, imzalı URL ile gösterilir).
 * Okuma, Ayarlar > Yapay Zekâ'da seçili sağlayıcıyla (Gemini / OpenAI / Claude —
 * görsel okuyabilen bir model) yapılır; sonuç forma doldurulur, kullanıcı
 * kontrol edip kaydeder.
 */

export interface RegistrationFields {
  plate_number?: string
  brand_model?: string
  year?: number
  owner_name?: string
  owner_tax_id?: string
  owner_address?: string
  chassis_number?: string
  engine_number?: string
  first_registration_date?: string
  registration_date?: string
  vehicle_class?: string
  vehicle_type?: string
  color?: string
  fuel_type?: string
  engine_capacity?: string
  engine_power?: string
  seat_count?: number
  usage_purpose?: string
  document_serial?: string
  inspection_valid_until?: string
}

export const REGISTRATION_LABELS: Record<keyof RegistrationFields, string> = {
  plate_number: 'Plaka (A)',
  brand_model: 'Marka / Ticari Adı (D.1, D.3)',
  year: 'Model Yılı',
  owner_name: 'Ruhsat Sahibi (C.1)',
  owner_tax_id: 'T.C. Kimlik / Vergi No (Y.1)',
  owner_address: 'Adres (C.1.3)',
  chassis_number: 'Şase No (E)',
  engine_number: 'Motor No (P.5)',
  first_registration_date: 'İlk Tescil Tarihi (B)',
  registration_date: 'Tescil Tarihi (I)',
  vehicle_class: 'Araç Sınıfı (J)',
  vehicle_type: 'Cinsi (D.5)',
  color: 'Rengi (R)',
  fuel_type: 'Yakıt Cinsi (P.3)',
  engine_capacity: 'Silindir Hacmi (P.1)',
  engine_power: 'Motor Gücü (P.2)',
  seat_count: 'Koltuk Sayısı (S.1)',
  usage_purpose: 'Kullanım Amacı (Z.1)',
  document_serial: 'Belge Seri No',
  inspection_valid_until: 'Muayene Geçerlilik Tarihi',
}

export async function uploadRegistrationImage(file: File): Promise<string> {
  // Yazılar okunabilsin diye profil fotoğraflarından daha büyük tutuluyor
  const blob = await resizeImageFile(file, 1800, 0.85)
  const path = `vehicles/ruhsat/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

export async function getRegistrationImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function fileToDataUrl(file: File, maxDimension = 1800): Promise<string> {
  const blob = await resizeImageFile(file, maxDimension, 0.85)
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

const INSTRUCTION = `Bu fotoğraf(lar) bir Türkiye Cumhuriyeti ARAÇ TESCİL BELGESİ (ruhsat) — ön ve/veya arka yüzü.
Belgedeki bilgileri oku ve SADECE aşağıdaki anahtarlarla bir JSON objesi döndür (açıklama ekleme).
Okuyamadığın ya da belgede olmayan alanı boş string "" bırak, TAHMİN ETME, uydurma.
Tarihleri YYYY-AA-GG biçiminde yaz. Plakayı "34 ABC 123" gibi boşluklu yaz.
{
 "plate_number": "A — Plaka",
 "brand": "D.1 — Markası",
 "model_type": "D.2 — Tipi",
 "commercial_name": "D.3 — Ticari Adı",
 "year": "Model Yılı (sadece yıl, sayı)",
 "first_registration_date": "B — İlk Tescil Tarihi",
 "registration_date": "I — Tescil Tarihi",
 "owner_surname": "C.1.1 — Soyadı / Ticari Ünvanı",
 "owner_name": "C.1.2 — Adı",
 "owner_address": "C.1.3 — Adresi",
 "owner_tax_id": "Y.1 — T.C. Kimlik No / Vergi No",
 "chassis_number": "E — Şase No",
 "engine_number": "P.5 — Motor No",
 "vehicle_class": "J — Araç Sınıfı",
 "vehicle_type": "D.5 — Cinsi",
 "color": "R — Rengi",
 "fuel_type": "P.3 — Yakıt Cinsi",
 "engine_capacity": "P.1 — Silindir Hacmi",
 "engine_power": "P.2 — Motor Gücü",
 "seat_count": "S.1 — Koltuk Sayısı (sayı)",
 "usage_purpose": "Z.1 — Kullanım Amacı",
 "document_serial": "Belge Seri No",
 "inspection_valid_until": "Muayene geçerlilik / sonraki muayene tarihi (arka yüzdeki son muayene kaydı)"
}`

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

/** "05.11.2026", "5/11/2026", "2026-11-05" → "2026-11-05" */
function toIsoDate(v: unknown): string | undefined {
  const s = str(v)
  if (!s) return undefined
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return undefined
}

function formatPlate(v: unknown): string | undefined {
  const s = str(v).toLocaleUpperCase('tr-TR').replace(/\s+/g, '')
  if (!s) return undefined
  const m = /^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})$/.exec(s)
  return m ? `${m[1]} ${m[2]} ${m[3]}` : str(v).toLocaleUpperCase('tr-TR')
}

export async function extractRegistrationInfo(aiService: AIService, dataUrls: string[]): Promise<RegistrationFields> {
  const messages = [
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: INSTRUCTION }, ...dataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } }))],
    },
  ]
  // "Düşünen" modeller (Gemini flash) cevap öncesi de token harcıyor — düşük sınır boş yanıt döndürüyordu;
  // sağlayıcı yoğunsa yedek modele geçilir (chatWithFallback)
  const result = await chatWithFallback(aiService, messages, { maxTokens: 8000 })
  const o = parseAiJsonObject(result.content)
  const brand = [str(o.brand), str(o.commercial_name) || str(o.model_type)].filter(Boolean).join(' ')
  const owner = [str(o.owner_name), str(o.owner_surname)].filter(Boolean).join(' ')
  const year = Number(str(o.year).slice(0, 4))
  const seats = Number(str(o.seat_count))
  const fields: RegistrationFields = {
    plate_number: formatPlate(o.plate_number),
    brand_model: brand || undefined,
    year: Number.isFinite(year) && year > 1950 && year < 2100 ? year : undefined,
    owner_name: owner || undefined,
    owner_tax_id: str(o.owner_tax_id) || undefined,
    owner_address: str(o.owner_address) || undefined,
    chassis_number: str(o.chassis_number).toLocaleUpperCase('tr-TR') || undefined,
    engine_number: str(o.engine_number).toLocaleUpperCase('tr-TR') || undefined,
    first_registration_date: toIsoDate(o.first_registration_date),
    registration_date: toIsoDate(o.registration_date),
    vehicle_class: str(o.vehicle_class) || undefined,
    vehicle_type: str(o.vehicle_type) || undefined,
    color: str(o.color) || undefined,
    fuel_type: str(o.fuel_type) || undefined,
    engine_capacity: str(o.engine_capacity) || undefined,
    engine_power: str(o.engine_power) || undefined,
    seat_count: Number.isFinite(seats) && seats > 0 && seats < 100 ? seats : undefined,
    usage_purpose: str(o.usage_purpose) || undefined,
    document_serial: str(o.document_serial) || undefined,
    inspection_valid_until: toIsoDate(o.inspection_valid_until),
  }
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== '')) as RegistrationFields
}
