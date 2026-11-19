import { format } from 'date-fns'

import type { WordDoctorRow } from '@/features/customers/parseDoctorWord'
import { parseReportLines } from './reportParser'

export type ImageVisitRow = WordDoctorRow & { date: string | null }

type OcrBox = { t: string; x: number; y: number; w: number; h: number }

/** OCR kutularını satırlara toplar (y alttan → yukarıdan aşağı sıralanır); aynı satırdaki uzak kutular (tablo hücresi) " | " ile ayrılır */
export function boxesToLines(boxes: OcrBox[]): string[] {
  const sorted = boxes.filter((b) => b.t.trim()).sort((a, b) => b.y + b.h / 2 - (a.y + a.h / 2))
  const rows: OcrBox[][] = []
  for (const box of sorted) {
    const cy = box.y + box.h / 2
    const row = rows.find((r) => {
      const ry = r[0].y + r[0].h / 2
      return Math.abs(ry - cy) < Math.min(r[0].h, box.h) * 0.6
    })
    if (row) row.push(box)
    else rows.push([box])
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x)
    let line = row[0].t
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - (row[i - 1].x + row[i - 1].w)
      line += (gap > row[i].h * 1.5 ? ' | ' : ' ') + row[i].t
    }
    return line.trim()
  })
}

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')

// JS getDay(): 0 = Pazar
const WEEKDAYS: [RegExp, number][] = [
  [/\bpazartesi\b/, 1],
  [/\bsali\b/, 2],
  [/\bcarsamba\b/, 3],
  [/\bpersembe\b/, 4],
  [/\bcumartesi\b/, 6],
  [/\bcuma\b/, 5],
  [/\bpazar\b/, 0],
]
// Ay adları ve WhatsApp kısaltmaları ("23 Eki Cum") — ilk 3 harf yeter
const MONTHS = ['oca', 'sub', 'mar', 'nis', 'may', 'haz', 'tem', 'agu', 'eyl', 'eki', 'kas', 'ara']
const TITLE_RE = /^(prof|doç|doc|op|uzm|dr)\b/i

/** Satırdaki tarihi ya da gün adını bulur; yerini de döndürür (satırdan çıkarmak için). fold() harf sayısını korur. */
function findDate(line: string, days: Date[]): { date: string; start: number; end: number } | null {
  const year = days[0]?.getFullYear() ?? new Date().getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')
  // 13.11.2026 / 13/11/26 / 13.11 (telefon parçası olmasın diye önünde-arkasında rakam yok)
  let m = line.match(/(?<![\d.])(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?![\d])/)
  if (m && (m[3] || m[0].includes('.'))) {
    const d = +m[1]
    const mo = +m[2]
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return { date: `${y}-${pad(mo)}-${pad(d)}`, start: m.index!, end: m.index! + m[0].length }
  }
  const f = fold(line)
  m = f.match(new RegExp(`(?<![\\d])(\\d{1,2})\\s*(${MONTHS.join('|')})[a-z]*\\.?(?:\\s+(\\d{4}))?(?![a-z])`))
  if (m && +m[1] >= 1 && +m[1] <= 31) {
    let y = m[3] ? +m[3] : new Date().getFullYear()
    let date = `${y}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(+m[1])}`
    // Yılsız tarih (WhatsApp "23 Eki") çok ileriye düşüyorsa geçen yıla aittir
    if (!m[3] && new Date(`${date}T00:00:00`).getTime() > Date.now() + 14 * 864e5) date = `${--y}${date.slice(4)}`
    return { date, start: m.index!, end: m.index! + m[0].length }
  }
  for (const [re, dow] of WEEKDAYS) {
    const wm = f.match(re)
    const day = wm && days.find((d) => d.getDay() === dow)
    if (wm && day) return { date: format(day, 'yyyy-MM-dd'), start: wm.index!, end: wm.index! + wm[0].length }
  }
  return null
}

/** WhatsApp saati ("00:02") ve resimdeki süs/karalama gibi tek-iki karakterlik okumalar atılır */
// Yazı tanıma büyük İ/Ü noktalarını kaçırabiliyor ("Ihtiyaç", "Urünlerin") — sık görülenler düzeltilir.
// I ile başlayan Türkçe kelimelerin çoğu noktalıdır; noktasızlar (Isparta, Iğdır, ışık, ısı…) hariç.
function fixTurkishOcr(line: string): string {
  return line
    .replace(/\bI(?=[a-zçğıöşü])(?!sparta|ğdır|şık|sı|slak|rmak|zgara|lık)/g, 'İ')
    .replace(/\bUrün/g, 'Ürün')
    .replace(/\bUzerin/g, 'Üzerin')
    .replace(/\bUcret/g, 'Ücret')
    .replace(/\bUlk(?=[üu])/g, 'Ülk')
    .replace(/ihtıyaç/g, 'ihtiyaç')
}

/** Boş satır '' olarak kalır (paragraf ayrımı); saat ve süs/karalama okumaları null (atılır) */
function cleanOcrLine(line: string): string | null {
  if (!line.trim()) return ''
  const l = fixTurkishOcr(line).replace(/(^|\s\|\s*)\d{1,2}[:.]\d{2}\s*(✓+)?$/, '').trim()
  const letters = (l.match(/[a-zçğıöşü]/gi) ?? []).length
  const digits = (l.match(/\d/g) ?? []).length
  return letters < 2 && digits < 7 ? null : l
}

const PHONE_CELL = /^\+?[\d\s().-]{7,}$/
const NAME_CELL = /^(?:(?:Prof|Doç|Doc|Op|Uzm|Dr)\.?\s*)*[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû'’.-]{2,}(?:\s+[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû'’.-]{2,}){1,3}$/
const LIST_HEADER = /^(doktor|hekim|telefon|tel\b|isim|ad[ıi]?\s*soyad|sıra|no\b)/i

/** Yazı tanımanın karıştırdığı büyük/küçük harfi düzeltir ("YaZıCı" → "Yazıcı"); ünvanlar olduğu gibi */
function tidyName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (/^(Prof|Doç|Doc|Op|Uzm|Dr)\.?$/i.test(w) ? w : w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')))
    .join(' ')
}

/**
 * Basit doktor listesi (Excel ekran görüntüsü / tablo: "Ad Soyad | Telefon", telefonu boş satırlar dahil) —
 * kullanıcı isteği, 2026-11-19. Satır numaraları, sütun harfleri ve başlık satırı atılır; satırların çoğu
 * "isim [| telefon]" düzenindeyse her satır bir doktordur. Değilse null (genel okuyucu çalışır).
 */
function parseSimpleList(lines: string[], days: Date[]): ImageVisitRow[] | null {
  const cells = lines
    .map((l) => l.replace(/^\d{1,3}(?:\s*\|\s*|\s+)(?=\p{L})/u, '').trim())
    .filter((l) => l && !/^[A-Z](\s*\|\s*[A-Z])*$/.test(l))
    .filter((l) => !LIST_HEADER.test(l))
  // Gün başlığı / tarih olan raporlar genel okuyucuda kalır (günler kaybolmasın)
  if (cells.length < 3 || cells.some((l) => findDate(l, days))) return null
  const rows: ImageVisitRow[] = []
  for (const l of cells) {
    const parts = l.split(/\s*\|\s*/).filter(Boolean)
    let name = parts[0]
    let phone = parts.slice(1).find((p) => PHONE_CELL.test(p)) ?? ''
    // Hücre ayracı okunmadıysa telefon ismin sonuna yapışık olabilir
    const m = !phone && name.match(/^(.*?\p{L})\s+(\+?[\d\s().-]{7,})$/u)
    if (m) [name, phone] = [m[1], m[2]]
    if (!NAME_CELL.test(name.trim())) continue
    rows.push({ name: tidyName(name.trim()), phone: phone.trim(), notes: '', date: null })
  }
  return rows.length >= cells.length * 0.7 ? rows : null
}

/**
 * Okunan satırları günlere ve doktorlara ayırır. Gün başlıkları ("Pazartesi", "13.11.2026", "13 Kasım",
 * WhatsApp'ın "23 Eki Cum") altındaki doktorlar o güne yazılır; satırın içindeki tarih (tablo) yalnız o
 * satırın günüdür. Mesajı gönderen temsilcinin adı ve ünvansız/telefonsuz maddeler ("Zoom Ekip
 * Toplantısı") — listede ünvanlı doktorlar varken — doktor sayılmaz.
 */
export function parseVisitLines(rawLines: string[], days: Date[], repName = ''): ImageVisitRow[] {
  const lines = rawLines.map(cleanOcrLine).filter((l): l is string => l !== null)
  const simple = parseSimpleList(lines, days)
  if (simple) return simple
  const out: ImageVisitRow[] = []
  let current: string | null = null
  let segment: string[] = []
  const flush = () => {
    out.push(...parseReportLines(segment).map((r) => ({ ...r, date: current })))
    segment = []
  }
  for (const line of lines) {
    const found = line ? findDate(line, days) : null
    if (!found) {
      segment.push(line)
      continue
    }
    const rest = (line.slice(0, found.start) + ' ' + line.slice(found.end)).replace(/^[\s|:,\-–]+|[\s|:,\-–]+$/g, '')
    const words = rest.split(/\s+/).filter((w) => /[a-zçğıöşü]{2,}/i.test(w))
    // Başlıkta kalan tek kelime gün adı/kısaltması olabilir ("Cum", "Pazartesi", "Tarih")
    const isHeading = !/\d{7,}/.test(rest.replace(/\D/g, '')) && words.length <= 1
    const hasEntry = /\d{7,}/.test(rest.replace(/[\s().-]/g, '')) || TITLE_RE.test(rest.replace(/^[|\s]+/, '')) || /\|/.test(rest)
    if (isHeading) {
      // Gün başlığı → sonraki doktorlar bu güne
      flush()
      current = found.date
    } else if (hasEntry) {
      // Tarih satırın içinde (ör. tablo: 13.11.2026 | Dr. Ad | 0532…) → yalnız bu satırın günü
      flush()
      const prev: string | null = current
      current = found.date
      segment.push(rest)
      flush()
      current = prev
    } else {
      // Açıklama cümlesinde geçen gün/tarih ("Pazartesi tekrar aranacak") — gün değiştirmez
      segment.push(line)
    }
  }
  flush()

  // Mesajı gönderen temsilcinin adı (resimde en üstte) ve tablo başlığı gibi satırlar kayıt değildir
  const repKey = fold(repName.split(/\s+/)[0] ?? '')
  return out.filter((r) => {
    if (!r.name) return false
    if (repKey && fold(r.name).split(/\s+/)[0] === repKey && !r.phone) return false
    if (/^(tarih|doktor|telefon|isim|ad soyad)\b/i.test(r.name) && !r.phone) return false
    return true
  })
}

