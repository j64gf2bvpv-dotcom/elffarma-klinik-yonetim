import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

/** İçe aktarma için örnek/şablon bir Excel dosyası üretir — başlıklar gerçek içe aktarma okuyucusuyla birebir eşleşir. */
export function downloadExcelTemplate(
  filename: string,
  headers: string[],
  sampleRows: Record<string, string | number>[],
) {
  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Şablon')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${filename}.xlsx`)
}

export function readExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Basit "tek satır başlık" varsayımı yapmayan, ham hücre matrisi (array of
 * arrays) döner — birleştirilmiş (merge) tarih başlıkları gibi çok satırlı /
 * düzensiz başlık yapıları için kullanılır (bkz. günlük stok hareket şablonu).
 */
export function readExcelSheetAsMatrix(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsArrayBuffer(file)
  })
}

/** Birleştirilmiş (merge) hücrelerde değer sadece en soldaki hücrede durur — bir satırda, verilen sütundan
 * geriye doğru ilk dolu hücreyi bulur (örn. bir tarih başlığının hangi kişi sütununa ait olduğunu bulmak için). */
export function nearestLeftValue(row: unknown[], fromIndex: number): string {
  for (let i = fromIndex; i >= 0; i--) {
    const value = String(row[i] ?? '').trim()
    if (value) return value
  }
  return ''
}

/** Bir satırdan, birden fazla olası sütun başlığı (eş anlamlı) deneyerek ilk dolu değeri döner. */
export function readCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

export interface ImportSummary {
  added: number
  skipped: number
  errors: string[]
}

/**
 * "d.MM.yyyy" veya "d.MM.yyyy HH:mm" gibi bu uygulamanın dışa aktarımlarında
 * kullandığı Türkçe tarih biçimlerini ayrıştırır (native `Date` bunları
 * güvenilir ayrıştıramaz); tanınmazsa ISO/ay-adı gibi biçimler için `Date`'e
 * düşer.
 */
export function parseFlexibleDate(text: string): Date | null {
  const trMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (trMatch) {
    const [, d, m, y, h, min] = trMatch
    const date = new Date(Number(y), Number(m) - 1, Number(d), h ? Number(h) : 0, min ? Number(min) : 0)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
