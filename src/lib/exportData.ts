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

function registerTurkishFont(doc: jsPDF) {
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

export function exportToPdf<T>(title: string, filename: string, columns: ExportColumn<T>[], rows: T[]) {
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

  saveAs(doc.output('blob'), `${filename}.pdf`)
}
