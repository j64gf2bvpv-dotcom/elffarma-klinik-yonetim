import { jsPDF } from 'jspdf'
import { saveAs } from 'file-saver'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

import { registerTurkishFont } from '@/lib/exportData'
import type { ExpenseEntry } from '@/types/database'
import { SECTION_BY_KEY, downloadExpenseAttachment, isPdfPath } from './api'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const trDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
const money = (n: number) => Number(n).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('Görsel okunamadı'))
    img.src = dataUrl
  })
}

/** PDF ekinin her sayfasını JPEG görsele çevirir. */
async function pdfToImages(blob: Blob): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const out: string[] = []
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    if (!context) continue
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport, canvas }).promise
    out.push(canvas.toDataURL('image/jpeg', 0.85))
  }
  return out
}

/**
 * Seçili giderlerin fatura/fiş görüntülerini tarih sırasıyla (eskiden yeniye) tek PDF'te
 * toplar — her görüntü ayrı A4 sayfa, üstünde tür, tarih, abone/sözleşme no ve tutar.
 * Görüntüsü olmayan kayıtlar atlanır; atlanan sayısı döner.
 */
export async function exportAttachmentsPdf(
  entries: ExpenseEntry[],
  title: string,
  filename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ pages: number; skipped: number }> {
  const withDocs = [...entries]
    .filter((e) => e.attachment_paths.length > 0)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at))
  const skipped = entries.length - withDocs.length
  if (withDocs.length === 0) return { pages: 0, skipped }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  registerTurkishFont(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 32
  let pages = 0
  const total = withDocs.reduce((n, e) => n + e.attachment_paths.length, 0)
  let done = 0

  for (const entry of withDocs) {
    const section = SECTION_BY_KEY[entry.category]
    const header = [
      `${section.label} ${section.docLabel === 'Fiş' ? 'Fişi' : 'Faturası'} — ${trDate(entry.entry_date)}`,
      [
        entry.subscriber_number && `Abone No: ${entry.subscriber_number}`,
        entry.contract_number && `Sözleşme No: ${entry.contract_number}`,
        `${section.isBill ? 'Ödenen' : 'Tutar'}: ${money(entry.amount)}`,
        entry.description,
      ]
        .filter(Boolean)
        .join('   ·   '),
    ]
    for (const path of entry.attachment_paths) {
      const blob = await downloadExpenseAttachment(path)
      const images = isPdfPath(path) ? await pdfToImages(blob) : [await blobToDataUrl(blob)]
      for (const img of images) {
        if (pages > 0) doc.addPage()
        pages++
        doc.setFont('NotoSans', 'bold')
        doc.setFontSize(13)
        doc.text(header[0], margin, margin + 6)
        doc.setFont('NotoSans', 'normal')
        doc.setFontSize(9.5)
        doc.text(doc.splitTextToSize(header[1], pageW - margin * 2), margin, margin + 24)
        const top = margin + 46
        const { w, h } = await imageSize(img)
        const scale = Math.min((pageW - margin * 2) / w, (pageH - top - margin) / h)
        const dw = w * scale
        const dh = h * scale
        doc.addImage(img, 'JPEG', (pageW - dw) / 2, top, dw, dh, undefined, 'FAST')
        doc.setFontSize(8)
        doc.setTextColor(140)
        doc.text(`${title} — sayfa ${pages}`, pageW - margin, pageH - 14, { align: 'right' })
        doc.setTextColor(0)
      }
      onProgress?.(++done, total)
    }
  }

  saveAs(doc.output('blob'), `${filename}.pdf`)
  return { pages, skipped }
}
