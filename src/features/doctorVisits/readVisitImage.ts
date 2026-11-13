import { format } from 'date-fns'

import { ensureReadableImage } from '@/lib/ensureReadableImage'
import { fileToDataUrl } from '@/features/vehicles/registration'
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
const MONTHS = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik']

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
  m = f.match(new RegExp(`(?<![\\d])(\\d{1,2})\\s+(${MONTHS.join('|')})[a-z]*(?:\\s+(\\d{4}))?`))
  if (m) {
    const y = m[3] ? +m[3] : year
    return { date: `${y}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(+m[1])}`, start: m.index!, end: m.index! + m[0].length }
  }
  for (const [re, dow] of WEEKDAYS) {
    const wm = f.match(re)
    const day = wm && days.find((d) => d.getDay() === dow)
    if (wm && day) return { date: format(day, 'yyyy-MM-dd'), start: wm.index!, end: wm.index! + wm[0].length }
  }
  return null
}

/**
 * Resimdeki ziyaret listesini okur (kullanıcı isteği, 2026-11-13: "içe aktar kısmında resimde ekleme
 * olsun, günü ve içeriği oradan okuyup eklesin"). İşletim sisteminin yazı tanıması (macOS Vision /
 * Windows OCR) kullanılır — yapay zekâ yok. Gün başlıkları ("Pazartesi", "13.11.2026", "13 Kasım")
 * altındaki doktorlar o güne yazılır; satırın içindeki tarih de o satırın günü olur.
 */
export async function readVisitImage(file: File, days: Date[]): Promise<ImageVisitRow[]> {
  const ocr = window.electronAPI?.nativeOcr
  if (!ocr) throw new Error('Resimden okuma yalnızca masaüstü programında çalışır.')
  const readable = await ensureReadableImage(file)
  const boxes = await ocr(await fileToDataUrl(readable, 3000, 0.95))
  if (!boxes?.length) throw new Error('Resimde yazı bulunamadı.')
  const lines = boxesToLines(boxes)

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
    const isHeading = !/\d{7,}/.test(rest.replace(/\D/g, '')) && rest.split(/\s+/).filter((w) => /[a-zçğıöşü]{2,}/i.test(w)).length <= 1
    if (isHeading) {
      // "Pazartesi" / "Tarih: 13.11.2026" gibi gün başlığı → sonraki doktorlar bu güne
      flush()
      current = found.date
    } else {
      // Tarih satırın içinde (ör. tablo: 13.11.2026 | Dr. Ad | 0532…) → yalnız bu satırın günü
      flush()
      const prev: string | null = current
      current = found.date
      segment.push(rest)
      flush()
      current = prev
    }
  }
  flush()
  return out
}
