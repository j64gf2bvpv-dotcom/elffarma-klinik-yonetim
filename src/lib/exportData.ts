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

/**
 * Tamamen boş sütunları atar — ör. Cari listesinde kimsede TC/Vergi No yoksa
 * PDF/PNG'de boş sütun yer kaplamasın, kalan sütunlar sığsın (2026-10-02).
 */
function nonEmptyColumns<T>(columns: ExportColumn<T>[], rows: T[]): ExportColumn<T>[] {
  const kept = columns.filter((c) => rows.some((r) => String(c.value(r) ?? '').trim() !== ''))
  return kept.length > 0 ? kept : columns
}

/**
 * Liste PDF'i — düzeltme/yeniden düzen (kullanıcı geri bildirimi, 2026-10-02:
 * "PDF saçma çıkıyor, temiz düzenli olsun, bütün kayıtlar sığsın"): boş
 * sütunlar atılır; sütun sayısına göre A4 dikey / A4 yatay / A3 yatay ve yazı
 * boyutu seçilir; uzun metin hücre içinde alt satıra kayar; başlık satırı her
 * sayfada tekrarlanır; üstte kayıt sayısı + tarih, altta sayfa numarası.
 */
function buildPdfDoc<T>(title: string, columnsIn: ExportColumn<T>[], rows: T[]): jsPDF {
  const columns = nonEmptyColumns(columnsIn, rows)
  const n = columns.length + 1 // + sıra no
  const format = n > 10 ? 'a3' : 'a4'
  const orientation = n > 5 ? 'landscape' : 'portrait'
  const fontSize = n <= 6 ? 9.5 : n <= 9 ? 8.5 : 7.5
  const doc = new jsPDF({ orientation, unit: 'pt', format })
  registerTurkishFont(doc)
  const margin = 28
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFont('NotoSans', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(20)
  doc.text(title, margin, 38)
  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text(`${rows.length} kayıt · ${new Date().toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}`, margin, 54)
  doc.setTextColor(0)

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin, bottom: 34 },
    head: [['#', ...columns.map((c) => c.header)]],
    body: rows.map((row, i) => [String(i + 1), ...columns.map((c) => String(c.value(row) ?? ''))]),
    theme: 'grid',
    tableWidth: pageWidth - margin * 2,
    styles: {
      font: 'NotoSans',
      fontSize,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [226, 226, 232],
      lineWidth: 0.5,
      textColor: [30, 30, 34],
    },
    headStyles: { font: 'NotoSans', fontStyle: 'bold', fillColor: [180, 30, 30], textColor: 255, lineColor: [180, 30, 30] },
    alternateRowStyles: { fillColor: [249, 249, 251] },
    columnStyles: { 0: { halign: 'right', textColor: [140, 140, 150], cellWidth: 26 } },
    showHead: 'everyPage',
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber
      doc.setFont('NotoSans', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(140)
      doc.text(`${title} · Sayfa ${page}`, margin, doc.internal.pageSize.getHeight() - 16)
      doc.setTextColor(0)
    },
  })

  return doc
}

export function exportToPdf<T>(title: string, filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const doc = buildPdfDoc(title, columns, rows)
  saveAs(doc.output('blob'), `${filename}.pdf`)
}

/**
 * Listeyi çıktı alınabilir, beyaz zeminli PNG olarak indirir (kullanıcı
 * isteği, 2026-10-02: "PNG olarak dışarı aktar olsun"). Boş sütunlar atılır,
 * sütun genişlikleri içeriğe göre ayarlanır (çok uzun metin "…" ile kısalır).
 * Tarayıcıların tuval yükseklik sınırını aşmamak için çok uzun listeler
 * birden fazla PNG dosyasına bölünür ("-1", "-2"…).
 */
export function exportToPng<T>(title: string, filename: string, columnsIn: ExportColumn<T>[], rows: T[]) {
  const columns = nonEmptyColumns(columnsIn, rows)
  const scale = 2
  const font = '13px "Segoe UI", "Helvetica Neue", Arial, sans-serif'
  const boldFont = 'bold 13px "Segoe UI", "Helvetica Neue", Arial, sans-serif'
  const pad = 10
  const rowH = 28
  const headH = 32
  const margin = 32
  const maxCol = 280

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return
  const cells = rows.map((r) => columns.map((c) => String(c.value(r) ?? '')))
  const numW = Math.max(28, String(rows.length).length * 9 + pad * 2)
  const widths = columns.map((c, ci) => {
    measure.font = boldFont
    let w = measure.measureText(c.header).width
    measure.font = font
    for (const row of cells) w = Math.max(w, measure.measureText(row[ci]).width)
    return Math.min(maxCol, Math.ceil(w) + pad * 2)
  })
  const tableW = numW + widths.reduce((a, b) => a + b, 0)
  const width = Math.max(tableW + margin * 2, 640)

  const rowsPerImage = Math.max(1, Math.floor((14000 - 140) / rowH))
  const parts = Math.max(1, Math.ceil(rows.length / rowsPerImage))

  function fit(ctx: CanvasRenderingContext2D, text: string, w: number) {
    if (ctx.measureText(text).width <= w) return text
    let t = text
    while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1)
    return t + '…'
  }

  for (let part = 0; part < parts; part++) {
    const slice = cells.slice(part * rowsPerImage, (part + 1) * rowsPerImage)
    const height = margin + 54 + headH + slice.length * rowH + margin
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale, scale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#141418'
    ctx.font = 'bold 20px "Segoe UI", "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(title + (parts > 1 ? ` (${part + 1}/${parts})` : ''), margin, margin + 18)
    ctx.fillStyle = '#6e6e78'
    ctx.font = '12px "Segoe UI", "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(`${rows.length} kayıt · ${new Date().toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}`, margin, margin + 40)

    let y = margin + 54
    ctx.fillStyle = '#b41e1e'
    ctx.fillRect(margin, y, tableW, headH)
    ctx.fillStyle = '#ffffff'
    ctx.font = boldFont
    let x = margin + numW
    ctx.textAlign = 'right'
    ctx.fillText('#', margin + numW - pad, y + 21)
    ctx.textAlign = 'left'
    columns.forEach((c, ci) => {
      ctx.fillText(fit(ctx, c.header, widths[ci] - pad * 2), x + pad, y + 21)
      x += widths[ci]
    })
    y += headH

    ctx.font = font
    slice.forEach((row, ri) => {
      const index = part * rowsPerImage + ri
      if (index % 2 === 1) {
        ctx.fillStyle = '#f7f7f9'
        ctx.fillRect(margin, y, tableW, rowH)
      }
      ctx.fillStyle = '#8c8c96'
      ctx.textAlign = 'right'
      ctx.fillText(String(index + 1), margin + numW - pad, y + 18)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#1e1e22'
      let cx = margin + numW
      row.forEach((cell, ci) => {
        ctx.fillText(fit(ctx, cell, widths[ci] - pad * 2), cx + pad, y + 18)
        cx += widths[ci]
      })
      ctx.strokeStyle = '#e6e6ec'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(margin, y + rowH)
      ctx.lineTo(margin + tableW, y + rowH)
      ctx.stroke()
      y += rowH
    })

    const name = parts > 1 ? `${filename}-${part + 1}.png` : `${filename}.png`
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, name)
    }, 'image/png')
  }
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
