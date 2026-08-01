import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel, WidthType, AlignmentType } from 'docx'
import { format } from 'date-fns'
import { registerTurkishFont } from '@/lib/exportData'
import type { StockCountItemWithProduct } from './api'
import type { SaleWithRelations } from '@/features/sales/api'

/**
 * Kullanıcının gerçek iş akışında kullandığı sabit tablo formatı: ürün
 * satırları, "STOKLAR" (bir önceki sayım tarihindeki stok) sütunu, o günün
 * tarihi altında HER satış temsilcisi için ayrı bir sütun (o gün o temsilcinin
 * o üründen kaç adet dağıttığı) ve en sonda "kalan stoklar" sütunu. Temsilci
 * sütunları o güne ait satışlardan (type='sale') dinamik olarak çıkarılıyor —
 * sabit bir temsilci listesi YOK.
 */
interface PivotRow {
  productName: string
  stok: number
  repQty: (number | '')[]
  kalan: number | ''
}

interface PivotData {
  repNames: string[]
  prevDateLabel: string
  countDateLabel: string
  rows: PivotRow[]
}

function buildPivotData(
  countDate: string,
  previousDate: string | null,
  items: StockCountItemWithProduct[],
  todayOutgoingSales: SaleWithRelations[],
): PivotData {
  const repNamesSet = new Set<string>()
  for (const s of todayOutgoingSales) if (s.sales_reps?.name) repNamesSet.add(s.sales_reps.name)
  const repNames = Array.from(repNamesSet).sort((a, b) => a.localeCompare(b, 'tr'))

  const qtyMap = new Map<string, Map<string, number>>()
  for (const s of todayOutgoingSales) {
    const repName = s.sales_reps?.name
    if (!repName) continue
    const perRep = qtyMap.get(s.product_name) ?? new Map<string, number>()
    perRep.set(repName, (perRep.get(repName) ?? 0) + s.quantity)
    qtyMap.set(s.product_name, perRep)
  }

  const rows: PivotRow[] = items.map((item) => {
    const perRep = qtyMap.get(item.products.name)
    const repQty = repNames.map((r) => perRep?.get(r) ?? '')
    const kalan: number | '' = perRep && perRep.size > 0 && item.counted_quantity != null ? item.counted_quantity : ''
    return { productName: item.products.name, stok: item.expected_quantity, repQty, kalan }
  })

  return {
    repNames,
    prevDateLabel: previousDate ? format(new Date(previousDate), 'd.MM.yyyy') : 'Önceki',
    countDateLabel: format(new Date(countDate), 'd.MM.yyyy'),
    rows,
  }
}

export function exportDailyCountToExcel(
  countDate: string,
  previousDate: string | null,
  items: StockCountItemWithProduct[],
  todayOutgoingSales: SaleWithRelations[],
) {
  const { repNames, prevDateLabel, countDateLabel, rows } = buildPivotData(countDate, previousDate, items, todayOutgoingSales)
  const kalanColIndex = 2 + repNames.length

  const headerRow1 = [
    'ÜRÜN ADI',
    prevDateLabel,
    countDateLabel,
    ...Array(Math.max(repNames.length - 1, 0)).fill(''),
    'kalan stoklar',
  ]
  const headerRow2 = ['', 'STOKLAR', ...repNames, '']
  const dataRows = rows.map((r) => [r.productName, r.stok, ...r.repQty, r.kalan])

  const worksheet = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...dataRows])
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: kalanColIndex }, e: { r: 1, c: kalanColIndex } },
  ]
  if (repNames.length > 1) merges.push({ s: { r: 0, c: 2 }, e: { r: 0, c: 1 + repNames.length } })
  worksheet['!merges'] = merges

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Günlük Sayım')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `gunluk-sayim-${countDate}.xlsx`)
}

function buildPivotPdf(countDate: string, previousDate: string | null, items: StockCountItemWithProduct[], todayOutgoingSales: SaleWithRelations[]) {
  const { repNames, prevDateLabel, countDateLabel, rows } = buildPivotData(countDate, previousDate, items, todayOutgoingSales)

  const doc = new jsPDF({ orientation: repNames.length > 3 ? 'landscape' : 'portrait', unit: 'pt' })
  registerTurkishFont(doc)
  doc.setFontSize(14)
  doc.setFont('NotoSans', 'bold')
  doc.text(`${countDateLabel} Günlük Sayım`, 40, 40)

  const head = [
    [
      { content: 'ÜRÜN ADI', rowSpan: 2 },
      { content: prevDateLabel },
      { content: countDateLabel, colSpan: Math.max(repNames.length, 1) },
      { content: 'kalan stoklar', rowSpan: 2 },
    ],
    ['STOKLAR', ...repNames],
  ]
  const body = rows.map((r) => [r.productName, r.stok, ...r.repQty, r.kalan])

  autoTable(doc, {
    startY: 56,
    head,
    body,
    styles: { font: 'NotoSans', fontSize: 8, cellPadding: 4 },
    headStyles: { font: 'NotoSans', fontStyle: 'bold', fillColor: [180, 30, 30], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  })

  return doc
}

export function exportDailyCountToPdf(
  countDate: string,
  previousDate: string | null,
  items: StockCountItemWithProduct[],
  todayOutgoingSales: SaleWithRelations[],
) {
  const doc = buildPivotPdf(countDate, previousDate, items, todayOutgoingSales)
  saveAs(doc.output('blob'), `gunluk-sayim-${countDate}.pdf`)
}

export function printDailyCount(
  countDate: string,
  previousDate: string | null,
  items: StockCountItemWithProduct[],
  todayOutgoingSales: SaleWithRelations[],
) {
  const doc = buildPivotPdf(countDate, previousDate, items, todayOutgoingSales)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

export async function exportDailyCountToWord(
  countDate: string,
  previousDate: string | null,
  items: StockCountItemWithProduct[],
  todayOutgoingSales: SaleWithRelations[],
) {
  const { repNames, prevDateLabel, countDateLabel, rows } = buildPivotData(countDate, previousDate, items, todayOutgoingSales)

  function headerCell(text: string, opts?: { rowSpan?: number; columnSpan?: number }) {
    return new TableCell({
      ...opts,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true })] })],
    })
  }

  const headerRow1 = new TableRow({
    children: [
      headerCell('ÜRÜN ADI', { rowSpan: 2 }),
      headerCell(prevDateLabel),
      headerCell(countDateLabel, { columnSpan: Math.max(repNames.length, 1) }),
      headerCell('kalan stoklar', { rowSpan: 2 }),
    ],
  })
  const headerRow2 = new TableRow({
    children: [headerCell('STOKLAR'), ...repNames.map((r) => headerCell(r))],
  })
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.productName)] }),
          new TableCell({ children: [new Paragraph(String(r.stok))] }),
          ...r.repQty.map((q) => new TableCell({ children: [new Paragraph(String(q))] })),
          new TableCell({ children: [new Paragraph(String(r.kalan))] }),
        ],
      }),
  )

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: `${countDateLabel} Günlük Sayım`, heading: HeadingLevel.HEADING_1 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow1, headerRow2, ...dataRows] }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `gunluk-sayim-${countDate}.docx`)
}
