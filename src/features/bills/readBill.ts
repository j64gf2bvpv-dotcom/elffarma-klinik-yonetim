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

/**
 * Etiketten sonraki değer: önce aynı satırda etiketin hemen sağı, geçerli değilse
 * bir sonraki satırın başı (faturalarda değer çoğu zaman etiketin altında durur).
 */
function valueAfter(lines: string[], label: RegExp, value: RegExp, accept: (v: string) => string | undefined): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = label.exec(lines[i])
    if (!m) continue
    for (const candidate of [lines[i].slice(m.index + m[0].length), lines[i + 1] ?? '']) {
      const v = value.exec(candidate)
      const ok = v && accept(v[1].trim())
      if (ok) return ok
    }
  }
  return undefined
}

function number(lines: string[], label: RegExp): string | undefined {
  return valueAfter(lines, label, NUM, (v) => (/\d{4,}/.test(v) ? v.replace(/[.\-/]+$/, '') : undefined))
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
  const m = /(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})/.exec(s)
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

  for (const l of lines) {
    if (out.amount == null && /(ödenecek|odenecek|fatura)\s*(toplam\s*)?tutar|toplam\s*tutar|genel\s*toplam/i.test(l)) out.amount = parseAmount(l.replace(/^.*?tutar[ıi]?/i, ''))
    if (!out.due_date && /son\s*[öo]deme/i.test(l)) {
      const d = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(l)
      if (d) out.due_date = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`
    }
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null && v !== '')) as BillReadResult
}
