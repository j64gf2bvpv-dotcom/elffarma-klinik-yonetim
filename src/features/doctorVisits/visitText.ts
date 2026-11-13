import { format } from 'date-fns'

import { parseDoctorLines, type WordDoctorRow } from '@/features/customers/parseDoctorWord'

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
  m = f.match(new RegExp(`(?<![\\d])(\\d{1,2})\\s+(${MONTHS.join('|')})[a-z]*\\.?(?:\\s+(\\d{4}))?(?![a-z])`))
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
    .replace(/ihtıyaç/g, 'ihtiyaç')
}

function cleanOcrLine(line: string): string {
  const l = fixTurkishOcr(line).replace(/(^|\s\|\s*)\d{1,2}[:.]\d{2}\s*(✓+)?$/, '').trim()
  const letters = (l.match(/[a-zçğıöşü]/gi) ?? []).length
  const digits = (l.match(/\d/g) ?? []).length
  return letters < 2 && digits < 7 ? '' : l
}

/**
 * Okunan satırları günlere ve doktorlara ayırır. Gün başlıkları ("Pazartesi", "13.11.2026", "13 Kasım",
 * WhatsApp'ın "23 Eki Cum") altındaki doktorlar o güne yazılır; satırın içindeki tarih (tablo) yalnız o
 * satırın günüdür. Mesajı gönderen temsilcinin adı ve ünvansız/telefonsuz maddeler ("Zoom Ekip
 * Toplantısı") — listede ünvanlı doktorlar varken — doktor sayılmaz.
 */
export function parseVisitLines(rawLines: string[], days: Date[], repName = ''): ImageVisitRow[] {
  const lines = rawLines.map(cleanOcrLine).filter(Boolean)
  const out: ImageVisitRow[] = []
  let current: string | null = null
  let segment: string[] = []
  const flush = () => {
    out.push(...parseDoctorLines(segment).map((r) => ({ ...r, date: current })))
    segment = []
  }
  for (const line of lines) {
    const found = findDate(line, days)
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

  const repKey = fold(repName.split(/\s+/)[0] ?? '')
  const hasTitled = out.some((r) => TITLE_RE.test(r.name))
  return out.filter((r) => {
    // Adsız/telefonsuz yalnız açıklama: tablo başlığı gibi kısa satırlar atılır, uzun not kalır (önizlemede ad girilir)
    if (!r.name && !r.phone) return r.notes.split(/\s+/).length > 5
    if (repKey && fold(r.name).split(/\s+/)[0] === repKey && !r.phone) return false
    if (hasTitled && !r.phone && !TITLE_RE.test(r.name)) return false
    return true
  })
}

