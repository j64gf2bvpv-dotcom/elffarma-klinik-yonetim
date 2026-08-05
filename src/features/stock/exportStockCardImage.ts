import type { StockCardRow } from './stockCardReport'
import { stockCardRowKindLabels } from './stockCardReport'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Stok Kartı raporunu (başlık + özet + Tarih/[Ürün]/Doktor/Tür/Adet/Fiyat/
 * Tutar tablosu) Canvas ile çizip PNG olarak indirir — Günlük Özet PNG
 * dışa aktarımıyla (exportSummaryImage.ts) aynı yöntem. `showProduct`
 * true ise (toplu/tüm ürünler raporu) ayrı bir Ürün kolonu ekleniyor.
 */
export function exportStockCardImage(
  title: string,
  subtitle: string | null,
  summaryLine: string,
  rows: StockCardRow[],
  showProduct: boolean,
) {
  const width = showProduct ? 920 : 820
  const rowHeight = 30
  const headerHeight = 92
  const summaryHeight = 40
  const tableHeaderHeight = 34
  const height = headerHeight + summaryHeight + tableHeaderHeight + Math.max(rows.length, 1) * rowHeight + 24

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#15121a'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px "Segoe UI", sans-serif'
  ctx.fillText(`Stok Kartı — ${title}`, 28, 40)
  if (subtitle) {
    ctx.fillStyle = '#a8a2b3'
    ctx.font = '13px "Segoe UI", sans-serif'
    ctx.fillText(subtitle, 28, 62)
  }

  ctx.strokeStyle = '#3a3542'
  ctx.beginPath()
  ctx.moveTo(28, headerHeight - 20)
  ctx.lineTo(width - 28, headerHeight - 20)
  ctx.stroke()

  ctx.fillStyle = '#d7d2de'
  ctx.font = '14px "Segoe UI", sans-serif'
  ctx.fillText(summaryLine, 28, headerHeight + 6)

  let y = headerHeight + summaryHeight

  const cols = showProduct
    ? [
        { label: 'TARİH', x: 28, key: 'date' as const },
        { label: 'ÜRÜN', x: 118, key: 'product' as const },
        { label: 'DOKTOR', x: 318, key: 'doctor' as const },
        { label: 'TÜR', x: 478, key: 'kind' as const },
        { label: 'ADET', x: 548, key: 'qty' as const },
        { label: 'BİRİM FİYAT', x: 618, key: 'price' as const },
        { label: 'TUTAR', x: 748, key: 'total' as const },
      ]
    : [
        { label: 'TARİH', x: 28, key: 'date' as const },
        { label: 'DOKTOR', x: 118, key: 'doctor' as const },
        { label: 'TÜR', x: 338, key: 'kind' as const },
        { label: 'ADET', x: 428, key: 'qty' as const },
        { label: 'BİRİM FİYAT', x: 508, key: 'price' as const },
        { label: 'TUTAR', x: 638, key: 'total' as const },
      ]

  ctx.fillStyle = '#a8a2b3'
  ctx.font = 'bold 12px "Segoe UI", sans-serif'
  for (const col of cols) ctx.fillText(col.label, col.x, y)
  y += tableHeaderHeight

  if (rows.length === 0) {
    ctx.fillStyle = '#a8a2b3'
    ctx.font = '14px "Segoe UI", sans-serif'
    ctx.fillText('Kayıt yok', 28, y)
  }

  const cellText: Record<(typeof cols)[number]['key'], (row: StockCardRow) => string> = {
    date: (r) => r.date,
    product: (r) => r.productName.slice(0, 22),
    doctor: (r) => r.doctorName.slice(0, 22),
    kind: (r) => stockCardRowKindLabels[r.kind],
    qty: (r) => String(r.quantity),
    price: (r) => currency(r.unitPrice),
    total: (r) => currency(r.total),
  }

  for (const row of rows) {
    for (const col of cols) {
      ctx.fillStyle =
        col.key === 'kind'
          ? row.kind === 'numune'
            ? '#f0b429'
            : row.kind === 'iade'
              ? '#f87171'
              : '#4ade80'
          : '#ffffff'
      ctx.font = '13px "Segoe UI", sans-serif'
      ctx.fillText(cellText[col.key](row), col.x, y)
    }

    ctx.strokeStyle = '#25212b'
    ctx.beginPath()
    ctx.moveTo(28, y + 10)
    ctx.lineTo(width - 28, y + 10)
    ctx.stroke()
    y += rowHeight
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stok-karti-${title.toLocaleLowerCase('tr').replace(/[^a-z0-9]+/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
