import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

import { tr } from '@/i18n/tr'
import type { StockCardRow } from './stockCardReport'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Stok Kartı raporunu (başlık + özet + Tarih/[Ürün]/Doktor/Tür/Fiyat/Giriş/
 * Çıkış/Güncel Stok tablosu) Canvas ile çizip PNG olarak indirir — Günlük Özet
 * PNG dışa aktarımıyla (exportSummaryImage.ts) aynı yöntem. `showProduct` true
 * ise (toplu/tüm ürünler raporu) ayrı bir Ürün kolonu ekleniyor.
 */
export function exportStockCardImage(
  title: string,
  subtitle: string | null,
  summaryLine: string,
  rows: StockCardRow[],
  showProduct: boolean,
) {
  const width = showProduct ? 1000 : 900
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
        { label: 'ÜRÜN', x: 148, key: 'product' as const },
        { label: 'DOKTOR', x: 328, key: 'doctor' as const },
        { label: 'TÜR', x: 488, key: 'kind' as const },
        { label: 'FİYAT', x: 588, key: 'price' as const },
        { label: 'GİRİŞ', x: 698, key: 'in' as const },
        { label: 'ÇIKIŞ', x: 778, key: 'out' as const },
        { label: 'GÜNCEL STOK', x: 858, key: 'balance' as const },
      ]
    : [
        { label: 'TARİH', x: 28, key: 'date' as const },
        { label: 'DOKTOR', x: 148, key: 'doctor' as const },
        { label: 'TÜR', x: 328, key: 'kind' as const },
        { label: 'FİYAT', x: 428, key: 'price' as const },
        { label: 'GİRİŞ', x: 538, key: 'in' as const },
        { label: 'ÇIKIŞ', x: 618, key: 'out' as const },
        { label: 'GÜNCEL STOK', x: 698, key: 'balance' as const },
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
    date: (r) => format(new Date(r.date), 'd MMM yyyy HH:mm', { locale: trLocale }),
    product: (r) => r.productName.slice(0, 30),
    doctor: (r) => (r.doctorName ?? '—').slice(0, 26),
    kind: (r) => tr.movementType[r.kind],
    price: (r) => (r.unitPrice != null ? currency(r.unitPrice) : '—'),
    in: (r) => (r.inQty ? `${r.inQty} ${r.unitKind === 'flakon' ? 'Flakon' : 'Paket'}` : ''),
    out: (r) => (r.outQty ? `${r.outQty} ${r.unitKind === 'flakon' ? 'Flakon' : 'Paket'}` : ''),
    balance: (r) => (r.unitKind === 'flakon' ? `${r.flakonBalance} Flakon` : `${r.balance} Paket`),
  }

  const kindColor: Record<StockCardRow['kind'], string> = {
    in: '#4ade80',
    return: '#4ade80',
    adjustment: '#f0b429',
    sample: '#f0b429',
    out: '#f87171',
    disposal: '#f87171',
  }

  for (const row of rows) {
    for (const col of cols) {
      ctx.fillStyle = col.key === 'kind' ? kindColor[row.kind] : '#ffffff'
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
