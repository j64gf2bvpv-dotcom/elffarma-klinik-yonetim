/**
 * Kongre "katılım bilgileri" görselinden bilgi çıkarma (kullanıcı isteği,
 * 2026-10-28: "kongrelerde katılım bilgileri görseli yüklenebilsin, oradan
 * bilgiler çekilip yazılsın").
 *
 *  1. readImageText — görseldeki yazı bilgisayarın kendi yazı tanımasıyla okunur
 *     (Mac: Apple Vision, Windows: Windows OCR; yoksa Tesseract). Ücretsiz, internete gitmez.
 *  2. parseParticipationText — okunan metinden kurallarla: tarih aralığı, şehir,
 *     otel / kongre merkezi, tek / iki kişilik fiyat (TL), pansiyon tipi, transfer,
 *     kontenjan. Bulunamayan alan boş kalır; metnin tamamı nota eklenebilir.
 *  3. aiParseParticipation — İSTEĞE BAĞLI ("Yapay zekâ ile ayrıntılı oku"): aynı
 *     metni yapay zekâya yapılandırtır. Sadece düğmeye basılınca bir istek harcar.
 */
import { createWorker } from 'tesseract.js'
import { detectProvince } from '@/lib/detectProvince'
import { ensureReadableImage } from '@/lib/ensureReadableImage'
import { resizeImageFile } from '@/lib/resizeImage'
import type { AIService } from '@/features/ai/AIService'
import { findDateRange } from './extractCongressInfo'

export interface ParticipationInfo {
  start_date?: string
  end_date?: string
  city?: string
  venue?: string
  hotel?: string
  single_person_price?: number
  two_person_price?: number
  meal_plan?: string
  transfer_info?: string
  capacity?: number
  campaign_info?: string
  /** Görselden okunan metnin tamamı (nota eklemek için) */
  notes?: string
}

export type ParticipationField = keyof ParticipationInfo

export const PARTICIPATION_LABELS: Record<ParticipationField, string> = {
  start_date: 'Başlangıç',
  end_date: 'Bitiş',
  city: 'Şehir',
  venue: 'Salon / Kongre merkezi',
  hotel: 'Otel',
  single_person_price: 'Tek kişi katılım fiyatı',
  two_person_price: '2 kişi katılım fiyatı',
  meal_plan: 'Yemek / pansiyon',
  transfer_info: 'Transfer',
  capacity: 'Kontenjan',
  campaign_info: 'Kampanya / erken kayıt',
  notes: 'Görseldeki tüm metin (nota eklenir)',
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

/** Görseldeki yazıyı satır satır okur (yukarıdan aşağıya, soldan sağa). */
export async function readImageText(file: File): Promise<string> {
  const readable = await ensureReadableImage(file)
  const dataUrl = await blobToDataUrl(await resizeImageFile(readable, 2400, 0.92))
  const native = window.electronAPI?.nativeOcr
  if (native) {
    const lines = await native(dataUrl).catch(() => null)
    if (lines && lines.length) {
      // Kutular 0-1 oranında, orijin sol-alt: üstten alta sırala, aynı satırdakileri birleştir
      const sorted = [...lines].sort((a, b) => b.y + b.h / 2 - (a.y + a.h / 2) || a.x - b.x)
      const rows: { mid: number; h: number; parts: { x: number; t: string }[] }[] = []
      for (const l of sorted) {
        const mid = l.y + l.h / 2
        const row = rows.find((r) => Math.abs(r.mid - mid) < Math.max(r.h, l.h) * 0.5)
        if (row) row.parts.push({ x: l.x, t: l.t })
        else rows.push({ mid, h: l.h, parts: [{ x: l.x, t: l.t }] })
      }
      return rows
        .map((r) =>
          r.parts
            .sort((a, b) => a.x - b.x)
            .map((p) => p.t.trim())
            .join('  '),
        )
        .filter(Boolean)
        .join('\n')
    }
  }
  const worker = await createWorker('tur')
  try {
    const { data } = await worker.recognize(dataUrl)
    return data.text
  } finally {
    void worker.terminate()
  }
}

const CURRENCY = /(₺|TL|TRY|€|EUR|EURO|\$|USD|£|GBP)/i
const AMOUNT = /(?:(₺|€|\$|£)\s*)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d{3,7}(?:[.,]\d{1,2})?)\s*(₺|TL|TRY|€|EUR|EURO|\$|USD|£|GBP)?/i
const SINGLE = /tek\s*ki[şs]i|single|1\s*ki[şs]i|ki[şs]i\s*ba[şs][ıi]|sgl|tek\s*oda/i
const DOUBLE = /iki\s*ki[şs]i|2\s*ki[şs]i|[çc]ift\s*ki[şs]i|double|dbl|[çc]ift\s*oda/i

function toNumber(raw: string): number {
  let s = raw.replace(/\s/g, '')
  // "12.500,00" / "12,500.00" / "12.500" / "1250"
  if (/[.,]\d{1,2}$/.test(s) && /[.,].*[.,]/.test(s)) s = s.slice(0, -3)
  else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '')
  else if (/[.,]\d{1,2}$/.test(s)) s = s.replace(/[.,]\d{1,2}$/, '')
  return Number(s.replace(/[.,]/g, ''))
}

/** Okunan metinden kurallarla bilgi çıkarır. */
export function parseParticipationText(text: string): ParticipationInfo {
  const out: ParticipationInfo = {}
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const flat = lines.join(' ')

  const range = findDateRange(flat)
  if (range) {
    out.start_date = range.start
    if (range.end) out.end_date = range.end
  }
  const city = detectProvince({ address: flat })
  if (city) out.city = city

  const venueLine = lines.find((l) => /kongre\s*merkezi|convention|congress\s*cent|expo|fuar\s*merkezi/i.test(l))
  if (venueLine) out.venue = venueLine.slice(0, 120)
  // Otel: "hotel/otel/resort…" geçen ama transfer/pansiyon/ücret satırı OLMAYAN satır; yoksa
  // şehir adının geçtiği, tarih/fiyat içermeyen kısa satır ("REGNUM CARYA ANTALYA" → "REGNUM CARYA")
  const notHotel = /transfer|dahil|pansiyon|kahvalt|[üu]cret|fiyat|\d{3,}|tl\b|₺|€/i
  const hotelLine = lines.find((l) => /\b(hotel|otel|resort|palace|spa)\b/i.test(l) && l !== venueLine && !notHotel.test(l))
  if (hotelLine) out.hotel = hotelLine.slice(0, 120)
  else if (city) {
    const cityKey = city.toLocaleUpperCase('tr-TR')
    const withCity = lines.find(
      (l) => l.toLocaleUpperCase('tr-TR').includes(cityKey) && !notHotel.test(l) && !findDateRange(l) && l.split(' ').length <= 6 && l !== venueLine,
    )
    const name = withCity?.replace(new RegExp(city, 'i'), '').replace(new RegExp(cityKey, 'g'), '').replace(/[-–,/·|]+\s*$|^\s*[-–,/·|]+/g, '').trim()
    if (name && name.length >= 3) out.hotel = name
  }

  // Fiyatlar: etiketli satır (ya da bir önceki satırdaki etiket) + TL tutar
  const otherCurrency: string[] = []
  lines.forEach((l, i) => {
    const m = AMOUNT.exec(l)
    if (!m) return
    const currency = (m[1] ?? m[3] ?? '').toUpperCase()
    if (!currency && !CURRENCY.test(l)) return
    const value = toNumber(m[2])
    if (!Number.isFinite(value) || value < 100) return
    const label = l + ' ' + (lines[i - 1] ?? '')
    const isTl = /₺|TL|TRY/.test(currency || l)
    if (!isTl) {
      otherCurrency.push(l)
      return
    }
    if (DOUBLE.test(label) && out.two_person_price == null) out.two_person_price = value
    else if (SINGLE.test(label) && out.single_person_price == null) out.single_person_price = value
    else if (out.single_person_price == null && !DOUBLE.test(label)) out.single_person_price = value
  })
  if (otherCurrency.length) out.campaign_info = `Fiyatlar (döviz): ${otherCurrency.join(' · ')}`.slice(0, 300)

  const meal = lines.find((l) => /her\s*[şs]ey\s*dahil|ultra|tam\s*pansiyon|yar[ıi]m\s*pansiyon|oda\s*kahvalt|all\s*inclusive|full\s*board|half\s*board|bed\s*&?\s*breakfast/i.test(l))
  if (meal) out.meal_plan = meal.slice(0, 160)
  const transfer = lines.find((l) => /transfer/i.test(l))
  if (transfer) out.transfer_info = transfer.slice(0, 160)
  const early = lines.find((l) => /erken\s*kay[ıi]t|early\s*bird|son\s*kay[ıi]t|indirim/i.test(l))
  if (early) out.campaign_info = [early, out.campaign_info].filter(Boolean).join(' · ').slice(0, 300)
  const cap = /(kontenjan|kapasite|s[ıi]n[ıi]rl[ıi]\s*say[ıi]da|ki[şs]i\s*ile\s*s[ıi]n[ıi]rl[ıi])\D{0,20}(\d{2,4})/i.exec(flat) ?? /(\d{2,4})\s*ki[şs]i\s*ile\s*s[ıi]n[ıi]rl[ıi]/i.exec(flat)
  if (cap) out.capacity = Number(cap[2] ?? cap[1])

  if (lines.length) out.notes = lines.join('\n')
  return out
}

/** İSTEĞE BAĞLI: okunan metni yapay zekâya yapılandırtır (1 istek). */
export async function aiParseParticipation(aiService: AIService, congressName: string, text: string): Promise<ParticipationInfo> {
  const result = await aiService.chat(
    [
      {
        role: 'system',
        content:
          'Bir kongre/workshop katılım bilgileri görselinden okunmuş metni yapılandırıyorsun. Sadece metinde AÇIKÇA yazan bilgiyi kullan, tahmin etme. ' +
          'Yanıtın SADECE şu alanlara sahip tek bir JSON nesnesi olsun (bilinmeyeni hiç yazma): ' +
          '{"start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","city":"","venue":"","hotel":"","single_person_price":0,"two_person_price":0,"meal_plan":"","transfer_info":"","capacity":0,"campaign_info":""}. ' +
          'Fiyatlar yalnızca TL ise sayı olarak (ör. 12500); döviz fiyatlarını campaign_info içinde metin olarak yaz.',
      },
      { role: 'user', content: `Kongre: ${congressName}\n\nGörselden okunan metin:\n${text.slice(0, 6000)}` },
    ],
    { maxTokens: 4000 },
  )
  const m = /\{[\s\S]*\}/.exec(result.content)
  if (!m) throw new Error('Yapay zekâ yanıtı okunamadı')
  const raw = JSON.parse(m[0]) as Record<string, unknown>
  const out: ParticipationInfo = {}
  const str = (k: keyof ParticipationInfo) => {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) (out as Record<string, unknown>)[k] = v.trim()
  }
  const num = (k: keyof ParticipationInfo) => {
    const v = Number(raw[k])
    if (Number.isFinite(v) && v > 0) (out as Record<string, unknown>)[k] = v
  }
  ;(['city', 'venue', 'hotel', 'meal_plan', 'transfer_info', 'campaign_info'] as const).forEach(str)
  ;(['single_person_price', 'two_person_price', 'capacity'] as const).forEach(num)
  for (const k of ['start_date', 'end_date'] as const) {
    const v = raw[k]
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = v
  }
  return out
}

/** Katılım görselini (yazılar okunabilsin diye büyük boyutta) depoya yükler, herkese açık adresini döner. */
export async function uploadParticipationImage(file: File): Promise<string> {
  const { supabase } = await import('@/lib/supabaseClient')
  const blob = await resizeImageFile(await ensureReadableImage(file), 1800, 0.88)
  const path = `congress/katilim/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('profile-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl
}
