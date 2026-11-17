import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PDFDocument } from 'pdf-lib'

import { readImageText } from '@/features/congresses/participationInfo'
import { classifyDocText } from './classifyDoc'
import { parseDocDates, type DocDates } from './docDates'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface PdfPageInfo {
  /** 0'dan başlayan sayfa sırası */
  index: number
  text: string
  /** Küçük önizleme (data URL) */
  thumb: string
  /** Tahmin edilen evrak türü; null = önceki belgenin devamı */
  type: string | null
  dates: DocDates
}

async function renderPage(page: pdfjsLib.PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

/**
 * PDF'in her sayfasını okur (metin katmanı; taranmışsa yazı tanıma), türünü ve tarihlerini tahmin eder
 * (kullanıcı isteği, 2026-11-17: "8-10 sayfalık PDF'te ehliyet, işe giriş, asker vb. evraklar var, tek seferde
 * ekleyeyim, sen ayır, gerekli evraklar kısmına koy"). Okuma bilgisayarda yapılır, hiçbir servise gönderilmez.
 */
export async function analyzePdf(file: File, onProgress?: (done: number, total: number) => void): Promise<PdfPageInfo[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: PdfPageInfo[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p - 1, pdf.numPages)
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3)
      rows.set(y, [...(rows.get(y) ?? []), { x: item.transform[4], s: item.str.trim() }])
    }
    let text = [...rows.keys()]
      .sort((a, b) => b - a)
      .map((y) => rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join('  '))
      .join('\n')
    if (text.replace(/\s/g, '').length < 40) {
      // Taranmış sayfa: resim olarak yazı tanıma
      const big = await renderPage(page, 2.2)
      const blob = await new Promise<Blob | null>((r) => big.toBlob(r, 'image/jpeg', 0.9))
      text = blob ? await readImageText(new File([blob], `sayfa-${p}.jpg`, { type: 'image/jpeg' })).catch(() => '') : ''
    }
    const thumbCanvas = await renderPage(page, 0.7)
    pages.push({ index: p - 1, text, thumb: thumbCanvas.toDataURL('image/jpeg', 0.7), type: classifyDocText(text), dates: parseDocDates(text) })
  }
  onProgress?.(pdf.numPages, pdf.numPages)
  return pages
}

/** Seçilen sayfalardan yeni bir PDF dosyası */
export async function extractPages(file: File, indices: number[], name: string): Promise<File> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const out = await PDFDocument.create()
  for (const page of await out.copyPages(src, indices)) out.addPage(page)
  const bytes = await out.save()
  return new File([bytes as BlobPart], `${name}.pdf`, { type: 'application/pdf' })
}
