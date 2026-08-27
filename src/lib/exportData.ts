import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from './notoSansBase64'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number
}

export function registerTurkishFont(doc: jsPDF) {
  doc.addFileToVFS('NotoSans-Regular.ttf', NOTO_SANS_REGULAR_BASE64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', NOTO_SANS_BOLD_BASE64)
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
  doc.setFont('NotoSans', 'normal')
}

export function exportToExcel<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const data = rows.map((row) => {
    const record: Record<string, string | number> = {}
    for (const col of columns) record[col.header] = col.value(row)
    return record
  })
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Liste')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${filename}.xlsx`)
}

/**
 * Tek dosyada kişi/kategori başına ayrı sekme — ör. Personel Satış Raporu'nda
 * "Tüm Personel" seçiliyken kişi kişi ayrı rapor almak (kullanıcı isteği,
 * 2026-08-28: "dışarı aktarırken kişi kişi alabilmeliyim"). Excel sekme adı
 * kuralı gereği (en fazla 31 karakter, `: \ / ? * [ ]` yasak) isimler
 * temizlenip kısaltılıyor; aynı isim/kısaltma birden fazla sekmede çakışırsa
 * sonuna sayaç ekleniyor.
 */
export function exportToExcelMultiSheet<T>(filename: string, sheets: { name: string; columns: ExportColumn<T>[]; rows: T[] }[]) {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  for (const sheet of sheets) {
    const data = sheet.rows.map((row) => {
      const record: Record<string, string | number> = {}
      for (const col of sheet.columns) record[col.header] = col.value(row)
      return record
    })
    const worksheet = XLSX.utils.json_to_sheet(data)
    const base = sheet.name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sayfa'
    let name = base
    let n = 2
    while (usedNames.has(name)) {
      const suffix = ` (${n})`
      name = base.slice(0, 31 - suffix.length) + suffix
      n++
    }
    usedNames.add(name)
    XLSX.utils.book_append_sheet(workbook, worksheet, name)
  }
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${filename}.xlsx`)
}

export async function exportToWord<T>(
  title: string,
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  const headerRow = new TableRow({
    children: columns.map(
      (col) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: col.header, bold: true })] })],
        }),
    ),
  })

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: columns.map(
          (col) => new TableCell({ children: [new Paragraph(String(col.value(row)))] }),
        ),
      }),
  )

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: new Date().toLocaleDateString('tr-TR'), spacing: { after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${filename}.docx`)
}

/** Tablo yerine serbest metin (AI tarafından üretilen rapor gibi) içeren belgeler için — paragraf paragraf Word'e aktarır. */
export async function exportTextReportToWord(title: string, filename: string, bodyText: string) {
  const paragraphs = bodyText
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => new Paragraph({ text: line, spacing: { after: 120 } }))

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: new Date().toLocaleDateString('tr-TR'), spacing: { after: 200 } }),
          ...paragraphs,
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${filename}.docx`)
}

function buildPdfDoc<T>(title: string, columns: ExportColumn<T>[], rows: T[]): jsPDF {
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt' })
  registerTurkishFont(doc)

  doc.setFontSize(14)
  doc.setFont('NotoSans', 'bold')
  doc.text(title, 40, 40)

  doc.setFontSize(9)
  doc.setFont('NotoSans', 'normal')
  doc.setTextColor(120)
  doc.text(new Date().toLocaleDateString('tr-TR'), 40, 56)
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 72,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.value(row)))),
    styles: { font: 'NotoSans', fontSize: 9, cellPadding: 5 },
    headStyles: { font: 'NotoSans', fontStyle: 'bold', fillColor: [180, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  })

  return doc
}

export function exportToPdf<T>(title: string, filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const doc = buildPdfDoc(title, columns, rows)
  saveAs(doc.output('blob'), `${filename}.pdf`)
}

/** Aynı PDF görünümünü indirmeden, doğrudan tarayıcının yazdırma diyaloğuyla açar (jsPDF autoPrint). */
export function printRows<T>(title: string, columns: ExportColumn<T>[], rows: T[]) {
  const doc = buildPdfDoc(title, columns, rows)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

/**
 * Rapor tablosunu, bir e-posta gövdesine yapıştırılabilecek düz metin
 * bir listeye çevirir — sütunlar sabit genişlikte hizalanır. URL üzerinden
 * webmail'e ön dolum yapılabilmesi için satır sayısı `maxRows` ile sınırlanır
 * (URL uzunluğu tarayıcılarda ~2000 karakterle sınırlı); sınır aşılırsa
 * altına kalan satır sayısını belirten bir not eklenir.
 */
export function buildPlainTextReport<T>(title: string, columns: ExportColumn<T>[], rows: T[], maxRows = 40): string {
  const widths = columns.map(
    (col) => Math.max(col.header.length, ...rows.slice(0, maxRows).map((r) => String(col.value(r)).length), 0) + 2,
  )
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('').trimEnd()

  const lines = [title, new Date().toLocaleDateString('tr-TR'), '', line(columns.map((c) => c.header))]
  for (const row of rows.slice(0, maxRows)) {
    lines.push(line(columns.map((c) => String(c.value(row)))))
  }
  if (rows.length > maxRows) lines.push('', `... ve ${rows.length - maxRows} satır daha (tam liste ekli dosyada)`)
  return lines.join('\n')
}
