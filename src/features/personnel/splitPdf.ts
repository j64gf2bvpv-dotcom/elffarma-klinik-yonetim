import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PDFDocument, degrees } from 'pdf-lib'

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
  /** Sayfanın düzgün okunması için saat yönünde döndürme (0/90/180/270) — yan/ters taranmış sayfalar */
  rotation: number
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

/** Tuvali saat yönünde 90/180/270 döndürür */
export function rotateCanvas(src: HTMLCanvasElement, rotation: number): HTMLCanvasElement {
  const r = ((rotation % 360) + 360) % 360
  if (!r) return src
  const out = document.createElement('canvas')
  out.width = r === 180 ? src.width : src.height
  out.height = r === 180 ? src.height : src.width
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((r * Math.PI) / 180)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

/** Önizleme resmini döndürür (elle döndürme düğmesi için) */
export async function rotateDataUrl(dataUrl: string, rotation: number): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  return rotateCanvas(c, rotation).toDataURL('image/jpeg', 0.75)
}

async function ocrCanvas(canvas: HTMLCanvasElement, name: string): Promise<string> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
  return blob ? readImageText(new File([blob], name, { type: 'image/jpeg' })).catch(() => '') : ''
}
function corr(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

/**
 * Sayfanın yan/ters olup olmadığını bulur; düzeltmek için gereken saat yönü dönüşü (0/90/180/270).
 * Yazı tanıma yazıyı her yönde okur ama satırları okuma sırasıyla, kutuları ise resmin kendi koordinatlarıyla
 * verir: düz sayfada satırlar yukarıdan aşağı (y azalır), ters sayfada aşağıdan yukarı, sağa yatık sayfada
 * sağdan sola, sola yatık sayfada soldan sağa ilerler.
 */
async function detectRotation(canvas: HTMLCanvasElement): Promise<number> {
  const ocr = window.electronAPI?.nativeOcr
  if (!ocr) return 0
  const small = document.createElement('canvas')
  const k = Math.min(1, 1800 / Math.max(canvas.width, canvas.height))
  small.width = Math.round(canvas.width * k)
  small.height = Math.round(canvas.height * k)
  small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height)
  const boxes = (await ocr(small.toDataURL('image/jpeg', 0.85)).catch(() => null)) ?? []
  if (boxes.length < 4) return 0
  const idx = boxes.map((_, i) => i)
  const cy = corr(idx, boxes.map((b) => b.y + b.h / 2))
  const cx = corr(idx, boxes.map((b) => b.x + b.w / 2))
  const tall = boxes.filter((b) => b.h > b.w).length / boxes.length
  if (tall > 0.5) {
    if (cx <= -0.6) return 270 // saat yönünde yatmış → saat yönünün tersine çevir
    if (cx >= 0.6) return 90
  } else {
    if (cy >= 0.6) return 180
  }
  return 0
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
    let rotation = 0
    if (text.replace(/\s/g, '').length < 40) {
      // Taranmış sayfa: önce yönü bulunur (yan/ters sayfa düzeltilir — kullanıcı isteği, 2026-11-17: "yan olan
      // dosyaları da düzeltsin sisteme koysun"), sonra düz haliyle yazı tanıma
      const big = await renderPage(page, 2.2)
      rotation = await detectRotation(big)
      text = await ocrCanvas(rotateCanvas(big, rotation), `sayfa-${p}.jpg`)
    }
    const thumbCanvas = rotateCanvas(await renderPage(page, 0.7), rotation)
    pages.push({ index: p - 1, text, thumb: thumbCanvas.toDataURL('image/jpeg', 0.7), type: classifyDocText(text), dates: parseDocDates(text), rotation })
  }
  onProgress?.(pdf.numPages, pdf.numPages)
  return pages
}

/** Seçilen sayfalardan yeni bir PDF dosyası; `rotations[i]` sayfayı düzgün yöne çevirir */
export async function extractPages(file: File, indices: number[], name: string, rotations: number[] = []): Promise<File> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indices)
  copied.forEach((page, i) => {
    const r = rotations[i] ?? 0
    if (r) page.setRotation(degrees((page.getRotation().angle + r) % 360))
    out.addPage(page)
  })
  const bytes = await out.save()
  return new File([bytes as BlobPart], `${name}.pdf`, { type: 'application/pdf' })
}
