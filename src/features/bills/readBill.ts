import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

import { readImageText } from '@/features/congresses/participationInfo'
import { isPdfFile } from '@/lib/documentAttachments'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Fatura resminden/PDF'inden abone no, sözleşme no ve abone adı (kullanıcı isteği,
 * 2026-11-11). Okuma bilgisayarda yapılır (işletim sisteminin yazı tanıması ya da
 * PDF'in kendi metni) — fatura hiçbir yapay zekâ servisine gönderilmez.
 */
export interface BillReadResult {
  subscriber_number?: string
  contract_number?: string
  subscriber_name?: string
  amount?: number
  due_date?: string
  /** Fatura dönemi YYYY-MM */
  period?: string
  /** Faturanın üzerindeki fatura tarihi YYYY-MM-DD */
  bill_date?: string
}

/** PDF'in metin katmanını satır satır okur; taranmış (metinsiz) PDF'te ilk sayfayı resim olarak OCR'lar. */
async function readPdfText(file: File): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const lines: string[] = []
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    // Aynı yükseklikteki parçaları tek satırda birleştir (soldan sağa)
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3)
      const row = rows.get(y) ?? []
      row.push({ x: item.transform[4], s: item.str.trim() })
      rows.set(y, row)
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a))
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join('  '))
  }
  if (lines.join('').replace(/\s/g, '').length > 40) return lines.join('\n')

  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  return blob ? readImageText(new File([blob], 'fatura.png', { type: 'image/png' })) : ''
}

export async function readBillText(file: File): Promise<string> {
  return isPdfFile(file) ? readPdfText(file) : readImageText(file)
}

const NUM = /^[:：.\-\s]*([A-Z0-9][A-Z0-9\-/]{3,24})/i
const TEXT = /^[:：.\-\s]*(.+)/

const segments = (line: string) => line.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean)

/**
 * Etiketten sonraki değer: önce aynı satırda etiketin hemen sağı, geçerli değilse alt satır.
 * Başlıklar yan yana bir satırdaysa (ASKİ: "ABONE NO  SÖZLEŞME NO  DÖNEM" / altında
 * "66704  100004019102  2026-06") alt satırda AYNI SIRADAKİ değer alınır — ilk değer değil.
 */
function valueAfter(lines: string[], label: RegExp, value: RegExp, accept: (v: string) => string | undefined): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = label.exec(lines[i])
    if (!m) continue
    const heads = segments(lines[i])
    const col = heads.findIndex((h) => label.test(h))
    const below = segments(lines[i + 1] ?? '')
    const candidates = [lines[i].slice(m.index + m[0].length)]
    if (heads.length > 1 && below.length === heads.length && col >= 0) candidates.push(below[col])
    else if (heads.length <= 1 || col === 0) candidates.push(lines[i + 1] ?? '')
    // Eğik çekilmiş fotoğrafta sütunlar kayar (ASKİ Mart: "66704  SÖZLEŞME NO  2026-03" /
    // "SEVKIYE TULUMEN  100004019102") — alt satırın parçalarından uygun olanı dene
    else candidates.push(...below)
    for (const candidate of candidates) {
      // Aynı satırdaki "kalan" başka bir başlıkla başlıyorsa (yan yana başlıklar) değer değildir
      const v = value.exec(candidate)
      const ok = v && accept(v[1].trim())
      if (ok) return ok
    }
  }
  return undefined
}

function number(lines: string[], label: RegExp): string | undefined {
  return valueAfter(lines, label, NUM, (v) => {
    // Dönem (2026-03) ya da tarih numara sanılmasın
    if (!/\d{4,}/.test(v) || /^\d{4}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{4}$|^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(v)) return undefined
    return v.replace(/[.\-/]+$/, '')
  })
}

const NAME_STOP = /\b(adres|adresi|tc|t\.c\.|vkn|vergi|kimlik|no|numaras[ıi]|tarih|tutar|abone\s*grubu|tarife|tesisat|sözleşme|sozlesme)\b/i

function cleanName(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let s = raw.split(/\s{2,}/)[0]
  const stop = NAME_STOP.exec(s)
  if (stop && stop.index > 0) s = s.slice(0, stop.index)
  s = s.replace(/^[:：.\-\s]+/, '').replace(/[:：,.\-\s]+$/, '').trim()
  if (s.length < 3 || /\d{3,}/.test(s) || !/[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/.test(s)) return undefined
  return s
}

function parseAmount(s: string): number | undefined {
  // 1.234,56 | 1234,56 | 1,234.56 | 2013.85 (binlik ayırıcısız — ASKİ)
  const m = /(?<![\d.,])(\d{1,3}(?:[.\s]\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d])/.exec(s)
  if (!m) return undefined
  const v = m[1].includes(',') && m[1].lastIndexOf(',') > m[1].lastIndexOf('.') ? m[1].replace(/[.\s]/g, '').replace(',', '.') : m[1].replace(/,/g, '')
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function parseBillText(text: string): BillReadResult {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim())
  const out: BillReadResult = {}

  out.contract_number =
    number(lines, /s[öo]zle[şs]me\s*(?:hesap\s*)?(?:no|numaras[ıi]|nr)\.?/i) ?? number(lines, /hesap\s*(?:no|numaras[ıi])\.?/i)
  out.subscriber_number =
    number(lines, /abone\s*(?:no|numaras[ıi]|nr)\.?/i) ??
    number(lines, /m[üu][şs]teri\s*(?:no|numaras[ıi])\.?/i) ??
    number(lines, /tesisat\s*(?:no|numaras[ıi])\.?/i) ??
    number(lines, /hizmet\s*(?:no|numaras[ıi])\.?/i)
  if (out.subscriber_number && out.subscriber_number === out.contract_number) delete out.subscriber_number

  out.subscriber_name =
    cleanName(valueAfter(lines, /abone\s*(?:ad[ıi]|unvan[ıi]|ad[ıi]\s*soyad[ıi])(?:\s*soyad[ıi])?(?:\s*\/\s*unvan[ıi]?)?/i, TEXT, cleanName)) ??
    cleanName(valueAfter(lines, /m[üu][şs]teri\s*(?:ad[ıi]|unvan[ıi])(?:\s*soyad[ıi])?/i, TEXT, cleanName)) ??
    cleanName(valueAfter(lines, /ad[ıi]\s*soyad[ıi](?:\s*\/\s*unvan[ıi]?)?/i, TEXT, cleanName)) ??
    cleanName(valueAfter(lines, /\bunvan[ıi]?\b/i, TEXT, cleanName)) ??
    cleanName(valueAfter(lines, /\bsay[ıi]n\b/i, TEXT, cleanName))

  // Etiketsiz abone adı (ASKİ vb.): abone/sözleşme no değerlerinin hemen altındaki, sadece harflerden oluşan satır
  if (!out.subscriber_name) {
    const valueLine = lines.findIndex((l) => [out.subscriber_number, out.contract_number].some((n) => n && segments(l).includes(n)))
    const next = valueLine >= 0 ? segments(lines[valueLine + 1] ?? '')[0] : undefined
    if (next && /^[A-Za-zÇĞİÖŞÜçğıöşü.]{2,}(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü.]{2,}){1,4}$/.test(next) && !/fatura|adres|t[üu]ketim|bor[çc]|tarih|d[öo]nem/i.test(next))
      out.subscriber_name = next
  }

  const AMOUNT_LABEL = /[öo]denecek|toplam\s*(?:fatura\s*)?(?:tutar|bedel)|fatura\s*(?:toplam\s*)?(?:tutar|bedel)|genel\s*toplam/i
  out.amount =
    Number(valueAfter(lines, AMOUNT_LABEL, /^[:：\s]*(.+)/, (v) => (parseAmount(v) ? String(parseAmount(v)) : undefined))) || undefined

  const toIso = (d: RegExpExecArray) => `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`
  const DATE = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/g
  for (const re of [/son\s*[öo]deme/i, /[öo]deme\s*tar[ıiİI]h/i]) {
    if (out.due_date) break
    const line = lines.find((l) => re.test(l) && DATE.test(l))
    DATE.lastIndex = 0
    if (line) {
      // "ÖDEME TARİHLERİ: 12.06.2026 - 18.06.2026" → son gün
      const all = [...line.matchAll(DATE)]
      out.due_date = toIso(all[all.length - 1] as RegExpExecArray)
    }
  }
  // Fatura tarihi (faturanın üzerindeki tarih) — "FATURA TARİHİ: 05.06.2026"
  for (const re of [/fatura\s*tar[ıiİI]h/i, /d[üu]zenlen(?:me|di[ğg]i)\s*tar[ıiİI]h/i, /tebli[ğg]\s*tar[ıiİI]h/i]) {
    if (out.bill_date) break
    const v = valueAfter(lines, re, /([0-3]?\d[./-][01]?\d[./-]\d{4})/, (x) => x)
    const d = v && /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(v)
    if (d) out.bill_date = toIso(d)
  }

  // Dönem — "DÖNEM 2026-06", "Fatura Dönemi: Haziran 2026", "Dönem: 06/2026" ("Dönem Borcu" değil)
  const MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık']
  const toPeriod = (v: string): string | undefined => {
    let m = /(20\d{2})\s*[-/.]\s*(\d{1,2})\b/.exec(v)
    if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, '0')}`
    m = /\b(\d{1,2})\s*[-/.]\s*(20\d{2})/.exec(v)
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`
    const low = v.toLocaleLowerCase('tr-TR')
    const mi = MONTHS.findIndex((name) => low.includes(name))
    const y = /(20\d{2})/.exec(v)
    return mi >= 0 && y ? `${y[1]}-${String(mi + 1).padStart(2, '0')}` : undefined
  }
  out.period = valueAfter(lines, /d[öoÖO]nem[ıiİI]?\b(?!\s*bor)/i, /^[:：\s]*(.+)/, toPeriod)
  if (!out.period && out.bill_date) out.period = out.bill_date.slice(0, 7)

  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null && v !== '')) as BillReadResult
}
