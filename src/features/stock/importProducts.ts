import { createProduct, recordStockMovement, type ProductInput } from './api'
import { readCell, type ImportSummary } from '@/lib/importData'
import type { Product } from '@/types/database'

export const PRODUCT_IMPORT_HEADERS = [
  'Ürün',
  'SKU',
  'Kategori',
  'Birim',
  'Kritik Stok Eşiği',
  'Birim Maliyet',
  'Satış Fiyatı',
  'Kampanya',
  'Barkod',
  'Ürün Hattı',
  'Son Kullanım Tarihi',
  'Başlangıç Stoğu',
]

export const PRODUCT_IMPORT_SAMPLE_ROWS = [
  {
    Ürün: 'Botoks 100u',
    SKU: 'BTX-100',
    Kategori: 'Botoks',
    Birim: 'adet',
    'Kritik Stok Eşiği': 5,
    'Birim Maliyet': 800,
    'Satış Fiyatı': 1200,
    Kampanya: '',
    Barkod: '',
    'Ürün Hattı': 'Dermakor',
    'Son Kullanım Tarihi': '2027-01-01',
    'Başlangıç Stoğu': 20,
  },
]

export const PRODUCT_IMPORT_FIELD_HINTS: Record<string, string> = {
  Birim: 'ör. "adet", "kutu" — yoksa "adet" yaz',
  'Kritik Stok Eşiği': 'sayı, yoksa 5 yaz',
  'Ürün Hattı': '"Dermakor" veya "Swiss", yoksa boş',
  'Son Kullanım Tarihi': 'YYYY-AA-GG formatında, yoksa boş',
  'Başlangıç Stoğu': 'sayı, yoksa 0 yaz',
}

/**
 * Stok kritik olduğu için içe aktarma ya HEPSİ ya HİÇBİRİ şeklinde çalışır:
 * önce tüm satırlar (isim eksikliği, sayı olmayan stok miktarı vb.) yazma
 * yapılmadan doğrulanır; herhangi bir satırda hata varsa hiçbir ürün
 * oluşturulmaz. Zaten var olan ürünler (SKU/isim eşleşmesi) hata değil,
 * atlanan kayıt sayılır. StockPage'in Excel/Akıllı İçe Aktar'ı ile Yapay
 * Zeka Analiz > Dosya Özetle'nin "ilgili bölüme aktar"ı bu TEK fonksiyonu
 * paylaşıyor. Sorumluluk çağırana ait: `summary.added > 0` ise
 * `['products']` query'sini invalidate etmek çağıranın işi.
 */
export async function importProductRows(
  rows: Record<string, unknown>[],
  existingProducts: Product[],
): Promise<ImportSummary> {
  const existingSkus = new Set(existingProducts.filter((p) => p.sku).map((p) => p.sku))
  const existingNames = new Set(existingProducts.map((p) => p.name.toLocaleLowerCase('tr')))
  const seenSkusInBatch = new Set<string>()
  const seenNamesInBatch = new Set<string>()
  const errors: string[] = []
  let skipped = 0

  const planned: { input: ProductInput; initialQty: number }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowLabel = `Satır ${i + 2}`
    const name = readCell(row, 'Ürün', 'Ürün Adı')
    if (!name) {
      errors.push(`${rowLabel}: Ürün adı eksik`)
      continue
    }
    const nameKey = name.toLocaleLowerCase('tr')
    const sku = readCell(row, 'SKU') || null
    if (
      (sku && existingSkus.has(sku)) ||
      existingNames.has(nameKey) ||
      seenNamesInBatch.has(nameKey) ||
      (sku && seenSkusInBatch.has(sku))
    ) {
      skipped++
      continue
    }

    const initialQtyText = readCell(row, 'Başlangıç Stoğu', 'Stok')
    const initialQty = initialQtyText ? Number(initialQtyText.replace(/[^\d.-]/g, '')) : 0
    if (initialQtyText && !Number.isFinite(initialQty)) {
      errors.push(`${rowLabel}: Başlangıç stoğu sayı değil ("${initialQtyText}")`)
      continue
    }

    const criticalStockText = readCell(row, 'Kritik Stok Eşiği')
    const criticalStock = criticalStockText ? Number(criticalStockText.replace(/[^\d.-]/g, '')) : 5
    if (criticalStockText && !Number.isFinite(criticalStock)) {
      errors.push(`${rowLabel}: Kritik stok eşiği sayı değil ("${criticalStockText}")`)
      continue
    }
    const unitCostText = readCell(row, 'Birim Maliyet')
    const unitCostNum = unitCostText ? Number(unitCostText.replace(/[^\d.-]/g, '')) : null
    const unitPriceText = readCell(row, 'Satış Fiyatı')
    const unitPriceNum = unitPriceText ? Number(unitPriceText.replace(/[^\d.-]/g, '')) : null

    const brandText = readCell(row, 'Ürün Hattı')
    seenNamesInBatch.add(nameKey)
    if (sku) seenSkusInBatch.add(sku)
    planned.push({
      input: {
        name,
        sku,
        category: readCell(row, 'Kategori') || null,
        unit: readCell(row, 'Birim') || 'adet',
        critical_stock_threshold: criticalStock,
        unit_cost: Number.isFinite(unitCostNum) ? unitCostNum : null,
        unit_price: Number.isFinite(unitPriceNum) ? unitPriceNum : null,
        campaign: readCell(row, 'Kampanya') || null,
        expiry_date: readCell(row, 'Son Kullanım Tarihi') || null,
        barcode: readCell(row, 'Barkod') || null,
        brand_line: /dermakor/i.test(brandText) ? 'dermakor' : /swiss/i.test(brandText) ? 'swiss' : null,
      },
      initialQty,
    })
  }

  if (errors.length > 0) {
    return { added: 0, skipped: 0, errors }
  }

  const summary: ImportSummary = { added: 0, skipped, errors: [] }
  for (const p of planned) {
    try {
      const created = await createProduct(p.input)
      if (p.initialQty > 0) {
        await recordStockMovement({
          product_id: created.id,
          movement_type: 'in',
          quantity: p.initialQty,
          reason: 'İçe aktarma — başlangıç stoğu',
        })
      }
      summary.added++
    } catch (err) {
      summary.errors.push(`${p.input.name}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
    }
  }

  return summary
}
