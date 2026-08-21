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
    Birim: 'Paket',
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
  Birim: 'ör. "Paket", "kutu" — yoksa "Paket" yaz',
  'Kritik Stok Eşiği': 'sayı, yoksa 5 yaz',
  'Ürün Hattı': '"Dermakor" veya "Swiss", yoksa boş',
  'Son Kullanım Tarihi': 'YYYY-AA-GG formatında, yoksa boş',
  'Başlangıç Stoğu': 'sayı, yoksa 0 yaz',
}

/**
 * Önce tüm satırlar (isim eksikliği, sayı olmayan stok miktarı vb.) yazma
 * yapılmadan doğrulanır, SONRA sadece geçerli olanlar oluşturulur — bir
 * satırdaki hata (ör. tek bir satırda ürün adı eksik) diğer geçerli
 * satırların eklenmesini engellemez; hatalı satırlar açıkça raporlanır (bkz.
 * `summary.errors`), kullanıcı sadece onları düzeltip ayrıca tekrar
 * deneyebilir. (Önceden ya HEPSİ ya HİÇBİRİ şeklinde çalışıyordu — gerçek
 * Excel dosyalarında tek bir bozuk/başlıksız satır yüzünden onlarca geçerli
 * ürünün topluca reddedilmesi kötü bir deneyimdi.)
 *
 * Dosyada zaten kayıtlı bir ürünle (SKU/isim eşleşmesi) karşılaşılırsa
 * kayıt sessizce atlanmaz — dosyada bir miktar/stok değeri varsa ve mevcut
 * `current_quantity`'den FARKLIYSA, `record_stock_movement` RPC'siyle (in/out
 * + mutlak fark, bkz. stockCounts/api.ts'teki completeCount ile aynı desen —
 * işareti kaybetmemek için) stok bu değere denkleştirilip `summary.updated`
 * sayılır; hiç fark yoksa (ya da dosyada miktar hiç yoksa) gerçekten
 * yapılacak bir şey olmadığı için atlanan kayıt sayılır. Kullanıcı "dosyada
 * ne varsa hepsi işlensin, sessizce hiçbir şey yapılmadan 'zaten kayıtlı'
 * denip geçilmesin" istiyor — bu davranış onu karşılıyor.
 *
 * StockPage'in Excel/Akıllı İçe Aktar'ı ile Yapay Zeka Analiz > Dosya
 * Özetle'nin "ilgili bölüme aktar"ı bu TEK fonksiyonu paylaşıyor. Sorumluluk
 * çağırana ait: `summary.added > 0 || summary.updated` ise `['products']`
 * query'sini invalidate etmek çağıranın işi.
 */
export async function importProductRows(
  rows: Record<string, unknown>[],
  existingProducts: Product[],
): Promise<ImportSummary> {
  const existingBySku = new Map(existingProducts.filter((p) => p.sku).map((p) => [p.sku as string, p]))
  const existingByName = new Map(existingProducts.map((p) => [p.name.toLocaleLowerCase('tr'), p]))
  const seenSkusInBatch = new Set<string>()
  const seenNamesInBatch = new Set<string>()
  const errors: string[] = []
  let skipped = 0

  const planned: { rowLabel: string; input: ProductInput; initialQty: number }[] = []
  const quantityUpdates: { rowLabel: string; product: Product; newQty: number }[] = []

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
    const existing = (sku && existingBySku.get(sku)) || existingByName.get(nameKey)

    if (existing || seenNamesInBatch.has(nameKey) || (sku && seenSkusInBatch.has(sku))) {
      if (existing) {
        const qtyText = readCell(row, 'Başlangıç Stoğu', 'Stok')
        const qty = qtyText ? Number(qtyText.replace(/[^\d.-]/g, '')) : NaN
        if (Number.isFinite(qty) && qty !== existing.current_quantity) {
          quantityUpdates.push({ rowLabel, product: existing, newQty: qty })
        } else {
          skipped++
        }
      } else {
        // Dosyanın kendi içinde tekrar eden bir satır (aynı ürün iki kez
        // listelenmiş) — ikinci kez işlemeye/güncellemeye gerek yok.
        skipped++
      }
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
      rowLabel,
      input: {
        name,
        sku,
        category: readCell(row, 'Kategori') || null,
        unit: readCell(row, 'Birim') || 'Paket',
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

  const summary: ImportSummary = { added: 0, skipped, errors, updated: 0 }
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
      summary.errors.push(`${p.rowLabel}: ${p.input.name} — ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
    }
  }

  for (const u of quantityUpdates) {
    try {
      const diff = u.newQty - u.product.current_quantity
      await recordStockMovement({
        product_id: u.product.id,
        movement_type: diff > 0 ? 'in' : 'out',
        quantity: Math.abs(diff),
        reason: 'İçe aktarma — stok miktarını dosyayla eşitleme',
        note: `Önceki: ${u.product.current_quantity}, Yeni: ${u.newQty}`,
      })
      summary.updated = (summary.updated ?? 0) + 1
    } catch (err) {
      summary.errors.push(
        `${u.rowLabel}: ${u.product.name} — ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`,
      )
    }
  }

  return summary
}
