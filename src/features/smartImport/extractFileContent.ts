import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import * as mammoth from 'mammoth'
import { readExcelFile } from '@/lib/importData'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type ExtractedContent = { kind: 'text'; text: string } | { kind: 'image'; dataUrl: string }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pages.push(text)
  }
  return pages.join('\n\n')
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * Yüklenen dosyanın türüne göre AI'a gönderilebilecek bir içerik çıkarır —
 * Excel/CSV satır satır JSON'a, PDF/Word düz metne çevrilir; resimler
 * data URL olarak (AI'a görsel parçası şeklinde) döner. Desteklenmeyen bir
 * tür gelirse hata fırlatır.
 */
export async function extractFileContent(file: File): Promise<ExtractedContent> {
  const name = file.name.toLowerCase()

  if (file.type.startsWith('image/')) {
    return { kind: 'image', dataUrl: await fileToDataUrl(file) }
  }
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const rows = await readExcelFile(file)
    return { kind: 'text', text: JSON.stringify(rows, null, 2) }
  }
  if (/\.pdf$/.test(name)) {
    return { kind: 'text', text: await extractPdfText(file) }
  }
  if (/\.docx$/.test(name)) {
    return { kind: 'text', text: await extractDocxText(file) }
  }
  if (/\.txt$/.test(name)) {
    return { kind: 'text', text: await file.text() }
  }

  throw new Error('Desteklenmeyen dosya türü — Excel/CSV, PDF, Word (.docx), resim veya .txt yükleyin.')
}
