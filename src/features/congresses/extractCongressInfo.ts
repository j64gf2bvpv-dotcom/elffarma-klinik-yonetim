import { detectProvince } from '@/lib/detectProvince'

/**
 * Kongre web sitesinden bilgi çıkarma (kullanıcı isteği, 2026-10-21: "web
 * sitesi üzerinden bağlanabilsin, gerçek bilgiler çekilebilsin"). Sırasıyla:
 *  1. schema.org Event (JSON-LD) — ad, başlangıç/bitiş, yer, şehir, görsel
 *  2. og:/meta etiketleri — başlık, açıklama, görsel
 *  3. sayfa metninde Türkçe/İngilizce tarih aralığı ("5-8 Kasım 2026",
 *     "28 Ekim – 2 Kasım 2026", "November 5-8, 2026"), il adı, otel/kongre merkezi
 * Bulunamayan alan boş kalır; kullanıcı önizlemede seçtiklerini forma aktarır.
 */
export interface ExtractedCongressInfo {
  name?: string
  start_date?: string
  end_date?: string
  city?: string
  venue?: string
  hotel?: string
  image_url?: string
  notes?: string
}

const MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, şubat: 2, mart: 3, nisan: 4, mayis: 5, mayıs: 5, haziran: 6, temmuz: 7, agustos: 8, ağustos: 8,
  eylul: 9, eylül: 9, ekim: 10, kasim: 11, kasım: 11, aralik: 12, aralık: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const monthOf = (w: string) => MONTHS[w.toLocaleLowerCase('tr-TR')]

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
}

function meta(doc: Document, ...names: string[]): string | undefined {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`)
    const v = el?.getAttribute('content')?.trim()
    if (v) return decodeEntities(v)
  }
  return undefined
}

function fromJsonLd(doc: Document): ExtractedCongressInfo {
  const out: ExtractedCongressInfo = {}
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown
    try {
      data = JSON.parse(script.textContent ?? '')
    } catch {
      continue
    }
    const items: Record<string, unknown>[] = []
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>
        items.push(o)
        if (o['@graph']) walk(o['@graph'])
      }
    }
    walk(data)
    const ev = items.find((o) => /Event/i.test(String(o['@type'] ?? '')))
    if (!ev) continue
    if (typeof ev.name === 'string') out.name = decodeEntities(ev.name)
    if (typeof ev.startDate === 'string') out.start_date = ev.startDate.slice(0, 10)
    if (typeof ev.endDate === 'string') out.end_date = ev.endDate.slice(0, 10)
    const loc = (Array.isArray(ev.location) ? ev.location[0] : ev.location) as Record<string, unknown> | undefined
    if (loc) {
      if (typeof loc.name === 'string') out.venue = decodeEntities(loc.name)
      const addr = loc.address as Record<string, unknown> | string | undefined
      if (typeof addr === 'object' && addr && typeof addr.addressLocality === 'string') out.city = addr.addressLocality
      else if (typeof addr === 'string') out.city = detectProvince({ address: addr }) ?? undefined
    }
    const img = Array.isArray(ev.image) ? ev.image[0] : ev.image
    if (typeof img === 'string') out.image_url = img
    else if (img && typeof img === 'object' && typeof (img as Record<string, unknown>).url === 'string') out.image_url = String((img as Record<string, unknown>).url)
    if (typeof ev.description === 'string') out.notes = decodeEntities(ev.description)
    break
  }
  return out
}

/** Metindeki ilk geçerli tarih aralığı. */
export function findDateRange(text: string): { start: string; end?: string } | null {
  const t = text.replace(/\s+/g, ' ')
  const dash = '\\s*[-–—]\\s*'
  // 5-8 Kasım 2026 / 5 – 8 November 2026
  let m = new RegExp(`\\b(\\d{1,2})${dash}(\\d{1,2})\\s+(${MONTH_RE})\\.?,?\\s+(20\\d{2})\\b`, 'iu').exec(t)
  if (m) return { start: iso(+m[4], monthOf(m[3]), +m[1]), end: iso(+m[4], monthOf(m[3]), +m[2]) }
  // 28 Ekim – 2 Kasım 2026
  m = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})${dash}(\\d{1,2})\\s+(${MONTH_RE})\\.?,?\\s+(20\\d{2})\\b`, 'iu').exec(t)
  if (m) return { start: iso(+m[5], monthOf(m[2]), +m[1]), end: iso(+m[5], monthOf(m[4]), +m[3]) }
  // November 5-8, 2026
  m = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})${dash}(\\d{1,2}),?\\s+(20\\d{2})\\b`, 'iu').exec(t)
  if (m) return { start: iso(+m[4], monthOf(m[1]), +m[2]), end: iso(+m[4], monthOf(m[1]), +m[3]) }
  // 05.11.2026 - 08.11.2026
  m = /\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\s*[-–—]\s*(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/.exec(t)
  if (m) return { start: iso(+m[3], +m[2], +m[1]), end: iso(+m[6], +m[5], +m[4]) }
  // tek gün: 5 Kasım 2026
  m = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})\\.?,?\\s+(20\\d{2})\\b`, 'iu').exec(t)
  if (m) return { start: iso(+m[3], monthOf(m[2]), +m[1]) }
  return null
}

export function extractCongressInfo(html: string, pageUrl: string): ExtractedCongressInfo {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const ld = fromJsonLd(doc)
  const out: ExtractedCongressInfo = { ...ld }

  const title = meta(doc, 'og:title', 'twitter:title') ?? decodeEntities(doc.title ?? '').trim()
  if (!out.name && title) out.name = title.split(/\s[|–-]\s/)[0].trim()
  const description = meta(doc, 'og:description', 'description', 'twitter:description')
  if (!out.notes && description) out.notes = description
  const image = meta(doc, 'og:image', 'twitter:image')
  if (!out.image_url && image) {
    try {
      out.image_url = new URL(image, pageUrl).href
    } catch {
      /* geçersiz adres — atla */
    }
  }

  doc.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove())
  const text = decodeEntities(doc.body?.textContent ?? '')

  if (!out.start_date) {
    const range = findDateRange(`${title ?? ''} ${description ?? ''} ${text}`)
    if (range) {
      out.start_date = range.start
      if (range.end) out.end_date = range.end
    }
  }
  if (!out.city) out.city = detectProvince({ name: title, note: `${description ?? ''} ${text.slice(0, 20000)}` }) ?? undefined
  if (!out.hotel) {
    const h = /([A-ZÇĞİÖŞÜ][\p{L}&'’.-]*(?:\s+[A-ZÇĞİÖŞÜ0-9][\p{L}&'’.-]*){0,5}\s+(?:Hotel|Otel|Otelleri|Resort|Hotels))\b/u.exec(text)
    if (h) out.hotel = h[1].trim()
  }
  if (!out.venue) {
    const v = /([A-ZÇĞİÖŞÜ][\p{L}&'’.-]*(?:\s+[A-ZÇĞİÖŞÜ][\p{L}&'’.-]*){0,5}\s+(?:Kongre Merkezi|Kongre ve Kültür Merkezi|Convention Center|Congress Center|Kültür Merkezi))\b/u.exec(text)
    if (v) out.venue = v[1].trim()
  }
  if (out.notes && out.notes.length > 600) out.notes = `${out.notes.slice(0, 600)}…`
  return out
}
