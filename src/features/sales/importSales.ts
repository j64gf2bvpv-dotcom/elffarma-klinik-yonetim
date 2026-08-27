import { format } from 'date-fns'

import { createSale, type SaleWithRelations } from './api'
import { createCustomer } from '@/features/customers/api'
import { createProduct } from '@/features/stock/api'
import { readCell, parseFlexibleDate, type ImportSummary } from '@/lib/importData'
import type { Customer, Product, SalesRep, SaleType } from '@/types/database'

// Sütun sırası ve başlıklar, kullanıcının temsilcilere dağıttığı gerçek
// "Satış formu.xlsx" dosyasıyla birebir eşleşecek şekilde (2026-08-26)
// ayarlandı — "Tür" sütunu bilinçli olarak yok; bu formdan gelen satırlar
// aşağıdaki importSaleRows'ta hep "Satış" kabul edilir (İade elle girilir).
export const SALE_IMPORT_HEADERS = ['Tarih', 'Doktor', 'Ürün', 'Adet', 'Birim Fiyat', 'Satış Temsilcisi', 'Not']

export const SALE_IMPORT_SAMPLE_ROWS = [
  {
    Tarih: '15.03.2026',
    Doktor: 'Dr. Ayşe Yılmaz',
    Ürün: 'Fillicia',
    Adet: 1,
    'Birim Fiyat': 5000,
    'Satış Temsilcisi': '',
    Not: '',
  },
]

export const SALE_IMPORT_FIELD_HINTS: Record<string, string> = {
  Tarih: 'GG.AA.YYYY veya YYYY-AA-GG formatında',
  Doktor: 'sistemde kayıtlı doktorun tam adı',
  Ürün: 'sistemde kayıtlı ürünün tam adı',
  Adet: 'sayı, 0’dan büyük',
  'Birim Fiyat': 'sayı, yoksa ürünün kayıtlı fiyatı kullanılır',
  'Satış Temsilcisi': 'yoksa boş bırak',
  Not: 'yoksa boş bırak',
}

/**
 * SalesPage'in İçe Aktar'ı (kullanıcı isteği, 2026-08-26). Doktor ve ürün
 * adıyla eşleştirilir; aynı tür/doktor/ürün/tarih/adet/fiyat kombinasyonu
 * zaten varsa atlanan kayıt sayılır. Her satır `createSale` üzerinden
 * gerçek bir satış kaydı VE stok hareketi oluşturur (bkz. api.ts — bu artık
 * merkezî, ayrıca bir stok çağrısına gerek yok).
 *
 * Kasıtlı olarak HİÇBİR satır hata olarak raporlanmaz ve mümkün olduğunca
 * hiçbir satır reddedilmez (kullanıcı isteği, 2026-08-27: "hiçbir hata
 * vermesin eksik olsa bile yüklesin"):
 * - Doktor hücresi boşsa, dosyada BİR ÖNCEKİ dolu satırdaki doktor kullanılır
 *   — gerçek dünyadaki Excel listelerinde aynı doktorun art arda gelen birden
 *   fazla ürün satırında doktor adı sadece ilk satıra yazılıp altındakiler
 *   göze hoş görünsün diye boş bırakılıyor (bkz. kullanıcının gerçek dosyası).
 * - Tarih hücresi boşsa bugünün tarihi kullanılır (bir satışın illa bir
 *   tarihi olmak zorunda, tahmin edilebilecek en makul değer budur).
 * - Ürün/Adet zorunlu kalır — bunlar satırdan satıra gerçekten değiştiği için
 *   tahmin edilemez, boşsa o satır atlanır.
 * - Dosyadaki bir doktor/ürün adı sistemde YOKSA (eşleşme sıfır), minimal bir
 *   yeni kayıt otomatik oluşturulur; BİRDEN FAZLA eşleşiyorsa (belirsiz) da
 *   yine hiçbir satır reddedilmesin diye ilk eşleşen kayıt kullanılır.
 */
export async function importSaleRows(
  rows: Record<string, unknown>[],
  existingSales: SaleWithRelations[],
  doctors: Customer[],
  products: Product[],
  salesReps: SalesRep[],
): Promise<ImportSummary> {
  const existingKeys = new Set(
    existingSales.map(
      (s) =>
        `${s.type}|${s.customer_id}|${s.product_id}|${s.sale_date}|${s.quantity}|${Number(s.unit_price)}`,
    ),
  )
  const summary: ImportSummary = { added: 0, skipped: 0, errors: [], created: 0 }
  const localDoctors = [...doctors]
  const localProducts = [...products]
  let lastDoctorName = ''

  for (const row of rows) {
    const doctorNameRaw = readCell(row, 'Doktor', 'Ad Soyad')
    if (doctorNameRaw) lastDoctorName = doctorNameRaw
    const doctorName = doctorNameRaw || lastDoctorName
    const productName = readCell(row, 'Ürün', 'Ürün Adı')
    const quantityText = readCell(row, 'Adet')
    if (!doctorName || !productName || !quantityText) continue

    let doctorMatches = localDoctors.filter(
      (d) => d.full_name.toLocaleLowerCase('tr') === doctorName.toLocaleLowerCase('tr'),
    )
    if (doctorMatches.length === 0) {
      try {
        const created = await createCustomer({
          full_name: doctorName,
          phone: '',
          doctor_type: 'sahis',
          tags: [],
          is_invoiced: false,
        })
        localDoctors.push(created)
        doctorMatches = [created]
        summary.created = (summary.created ?? 0) + 1
      } catch {
        continue
      }
    }
    const doctor = doctorMatches[0]

    let productMatches = localProducts.filter(
      (p) => p.name.toLocaleLowerCase('tr') === productName.toLocaleLowerCase('tr'),
    )
    if (productMatches.length === 0) {
      try {
        const created = await createProduct({
          name: productName,
          unit: 'Paket',
          critical_stock_threshold: 5,
        })
        localProducts.push(created)
        productMatches = [created]
        summary.created = (summary.created ?? 0) + 1
      } catch {
        continue
      }
    }
    const product = productMatches[0]

    const dateText = readCell(row, 'Tarih')
    const saleDate = dateText ? (parseFlexibleDate(dateText) ?? new Date()) : new Date()
    const quantity = Number(quantityText.replace(/[^\d.-]/g, ''))
    if (!quantity || quantity <= 0) continue
    const unitPriceText = readCell(row, 'Birim Fiyat')
    const unitPrice = unitPriceText ? Number(unitPriceText.replace(/[^\d.-]/g, '')) : (product.unit_price ?? 0)

    const typeText = readCell(row, 'Tür').toLocaleLowerCase('tr')
    const type: SaleType = typeText.includes('iade') ? 'return' : 'sale'

    const repName = readCell(row, 'Satış Temsilcisi')
    const rep = repName
      ? salesReps.find((r) => r.name.toLocaleLowerCase('tr') === repName.toLocaleLowerCase('tr'))
      : undefined

    const saleDateStr = format(saleDate, 'yyyy-MM-dd')
    const key = `${type}|${doctor.id}|${product.id}|${saleDateStr}|${quantity}|${unitPrice}`
    if (existingKeys.has(key)) {
      summary.skipped++
      continue
    }

    try {
      await createSale({
        type,
        customer_id: doctor.id,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        sale_date: saleDateStr,
        sales_rep_id: rep?.id ?? null,
        note: readCell(row, 'Not') || null,
        movement_note: `${doctor.full_name} — Excel'den içe aktarıldı`,
      })
      existingKeys.add(key)
      summary.added++
    } catch {
      // Kasıtlı olarak yutuluyor — bkz. yukarıdaki fonksiyon açıklaması.
    }
  }

  return summary
}
