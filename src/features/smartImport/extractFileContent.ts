import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import * as mammoth from 'mammoth'
import { readExcelFile } from '@/lib/importData'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type ExtractedContent =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrls: string[] }
  | { kind: 'table'; rows: Record<string, unknown>[] }

/** Bir metnin gerçek belge içeriği mi yoksa taranmış/görsel bir sayfanın
 * neredeyse boş çıktısı mı olduğunu ayırt etmek için kaba bir eşik. */
const MIN_MEANINGFUL_TEXT_LENGTH = 40

/** Taranmış/görsel bir PDF'te sayfa sayısı çok fazla olsa da görüntü başına
 * maliyet/istek boyutu nedeniyle en fazla bu kadar sayfa AI'a gönderilir. */
const MAX_SCANNED_PAGES = 3

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })
}

async function extractPdfText(pdf: pdfjsLib.PDFDocumentProxy): Promise<string> {
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pages.push(text)
  }
  return pages.join('\n\n')
}

/** Metin katmanı yoksa (taranmış PDF) sayfaları PNG görsel olarak render eder
 * — böylece AI belgeyi görsel yoluyla (vision) okuyabilir. */
async function renderPdfPagesAsImages(pdf: pdfjsLib.PDFDocumentProxy): Promise<string[]> {
  const dataUrls: string[] = []
  const pageCount = Math.min(pdf.numPages, MAX_SCANNED_PAGES)
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    if (!context) continue
    await page.render({ canvasContext: context, viewport, canvas }).promise
    dataUrls.push(canvas.toDataURL('image/png'))
  }
  return dataUrls
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * Yüklenen dosyanın türüne göre içerik çıkarır. Excel/CSV özel bir "table"
 * türü olarak döner (ham satır objeleri, xlsx kütüphanesinin ayrıştırdığı
 * GERÇEK değerlerle) — sayıların/tarihlerin AI'a metin olarak yazdırılıp
 * yeniden "okutulması" GEREKMİYOR, bu da küçük bir yerel modelin rakamları
 * yanlış yazması riskini tamamen ortadan kaldırıyor (bkz. SmartImportDialog:
 * AI'a sadece sütun eşlemesi sorulur, değerler koddan doğrudan aktarılır).
 * PDF/Word düz metne çevrilir; resimler data URL olarak (AI'a görsel parçası
 * şeklinde) döner. PDF'te metin katmanı yoksa/çok azsa (taranmış belge)
 * otomatik olarak sayfa görsellerine düşülür — böylece "ne verirsem vereyim
 * içini okusun" beklentisi taranmış belgeler için de karşılanır. Desteklenmeyen
 * bir tür gelirse hata fırlatır.
 */
export async function extractFileContent(file: File): Promise<ExtractedContent> {
  const name = file.name.toLowerCase()

  if (file.type.startsWith('image/')) {
    return { kind: 'image', dataUrls: [await fileToDataUrl(file)] }
  }
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const rows = await readExcelFile(file)
    return { kind: 'table', rows }
  }
  if (/\.pdf$/.test(name)) {
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    const text = await extractPdfText(pdf)
    if (text.trim().length >= MIN_MEANINGFUL_TEXT_LENGTH) return { kind: 'text', text }
    const dataUrls = await renderPdfPagesAsImages(pdf)
    if (dataUrls.length === 0) return { kind: 'text', text }
    return { kind: 'image', dataUrls }
  }
  if (/\.docx$/.test(name)) {
    return { kind: 'text', text: await extractDocxText(file) }
  }
  if (/\.txt$/.test(name)) {
    return { kind: 'text', text: await file.text() }
  }

  throw new Error('Desteklenmeyen dosya türü — Excel/CSV, PDF, Word (.docx), resim veya .txt yükleyin.')
}
