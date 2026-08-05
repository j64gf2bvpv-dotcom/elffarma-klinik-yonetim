import { format } from 'date-fns'

import { readCell, parseFlexibleDate, type ImportSummary } from '@/lib/importData'
import { createSale } from '@/features/sales/api'
import { createHistoricalSampleRequest } from '@/features/samples/api'
import type { StockCardRow } from './stockCardReport'
import type { Customer, Product } from '@/types/database'

export const STOCK_CARD_IMPORT_HEADERS = ['Tarih', 'Ürün', 'Doktor', 'Tür', 'Adet', 'Birim Fiyat', 'Not']

export const STOCK_CARD_IMPORT_SAMPLE_ROWS = [
  {
    Tarih: '15.03.2026',
    Ürün: 'Botoks 100u',
    Doktor: 'Dr. Ayşe Yılmaz',
    Tür: 'Satış',
    Adet: 2,
    'Birim Fiyat': 1200,
    Not: '',
  },
]

export const STOCK_CARD_IMPORT_FIELD_HINTS: Record<string, string> = {
  Tarih: 'GG.AA.YYYY veya YYYY-AA-GG formatında',
  Ürün: 'sistemde kayıtlı ürünün tam adı veya SKU/stok kodu',
  Doktor: 'sistemde kayıtlı doktorun/carinin tam adı',
  Tür: '"Satış", "İade" veya "Numune"',
  Adet: 'sayı',
  'Birim Fiyat': 'sayı, para birimi/nokta olmadan — boşsa üründeki güncel satış fiyatı kullanılır',
  Not: 'yoksa boş bırak',
}

function normalizeKind(text: string): StockCardRow['kind'] | null {
  const t = text.trim().toLocaleLowerCase('tr')
  if (t.startsWith('sat')) return 'satis'
  if (t.startsWith('iade')) return 'iade'
  if (t.startsWith('num') || t.startsWith('örn')) return 'numune'
  return null
}

function rowKey(productId: string, doctorId: string, date: string, kind: string, quantity: number, unitPrice: number) {
  return `${productId}|${doctorId}|${date}|${kind}|${quantity}|${unitPrice}`
}

/**
 * Eskiden Excel'de tutulan Stok Kartı dökümünü (Tarih/Ürün/Doktor/Tür/Adet/
 * Birim Fiyat) gerçek satış/numune kayıtlarına çevirir — ürün ve doktor,
 * SİSTEMDE ZATEN KAYITLI olanlarla ada/SKU'ya göre eşleştirilir (yeni ürün/
 * doktor OLUŞTURULMAZ, eşleşmeyen satır hata olarak raporlanıp atlanır).
 * Kullanıcı tercihi gereği bugünkü stok miktarına DOKUNULMAZ — sadece rapor/
 * cari için geçmiş kayıt oluşturulur (bkz. createHistoricalSampleRequest).
 */
export async function importStockCardRows(
  rawRows: Record<string, unknown>[],
  products: Product[],
  customers: Customer[],
  existingRows: StockCardRow[],
): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, skipped: 0, errors: [] }
  const existingKeys = new Set(
    existingRows.map((r) => rowKey(r.productId, r.doctorId, r.date, r.kind, r.quantity, r.unitPrice)),
  )

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rowLabel = `Satır ${i + 2}`

    const productText = readCell(row, 'Ürün', 'Ürün Adı', 'SKU', 'Stok Kodu')
    const doctorText = readCell(row, 'Doktor', 'Ad Soyad')
    const kindText = readCell(row, 'Tür', 'Tip')
    const quantityText = readCell(row, 'Adet', 'Miktar')
    const dateText = readCell(row, 'Tarih')
    if (!productText || !doctorText || !kindText || !quantityText || !dateText) {
      summary.errors.push(`${rowLabel}: Tarih, Ürün, Doktor, Tür veya Adet eksik`)
      continue
    }

    const product = products.find(
      (p) =>
        p.name.toLocaleLowerCase('tr') === productText.toLocaleLowerCase('tr') ||
        (p.sku && p.sku.toLocaleLowerCase('tr') === productText.toLocaleLowerCase('tr')),
    )
    if (!product) {
      summary.errors.push(`${rowLabel}: "${productText}" adında/kodunda ürün bulunamadı`)
      continue
    }

    const doctor = customers.find((c) => c.full_name.toLocaleLowerCase('tr') === doctorText.toLocaleLowerCase('tr'))
    if (!doctor) {
      summary.errors.push(`${rowLabel}: "${doctorText}" adında doktor/cari bulunamadı`)
      continue
    }

    const kind = normalizeKind(kindText)
    if (!kind) {
      summary.errors.push(`${rowLabel}: Tür tanınmadı ("${kindText}" — Satış/İade/Numune olmalı)`)
      continue
    }

    const date = parseFlexibleDate(dateText)
    if (!date) {
      summary.errors.push(`${rowLabel}: Geçersiz tarih (${dateText})`)
      continue
    }
    const dateStr = format(date, 'yyyy-MM-dd')

    const quantity = Number(quantityText.replace(/[^\d.-]/g, ''))
    if (!quantity || quantity <= 0) {
      summary.errors.push(`${rowLabel}: Geçersiz adet (${quantityText})`)
      continue
    }

    const priceText = readCell(row, 'Birim Fiyat', 'Fiyat')
    const unitPrice = priceText ? Number(priceText.replace(/[^\d.-]/g, '')) : Number(product.unit_price ?? 0)

    const key = rowKey(product.id, doctor.id, dateStr, kind, quantity, unitPrice)
    if (existingKeys.has(key)) {
      summary.skipped++
      continue
    }

    const note = readCell(row, 'Not', 'Açıklama') || null

    try {
      if (kind === 'numune') {
        await createHistoricalSampleRequest({
          customer_id: doctor.id,
          request_date: dateStr,
          note,
          items: [{ product_id: product.id, quantity, unit_price: unitPrice }],
        })
      } else {
        await createSale({
          type: kind === 'iade' ? 'return' : 'sale',
          customer_id: doctor.id,
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: unitPrice,
          sale_date: dateStr,
          note,
        })
      }
      existingKeys.add(key)
      summary.added++
    } catch (err) {
      summary.errors.push(`${rowLabel}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
    }
  }

  return summary
}
