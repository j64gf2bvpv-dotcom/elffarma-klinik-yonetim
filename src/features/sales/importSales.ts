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
 * Kasıtlı olarak HİÇBİR satır hata olarak raporlanmaz (kullanıcı isteği,
 * 2026-08-27: "hiçbir hata vermesin eksik olsa bile yüklesin") — eksik hücre,
 * geçersiz tarih/adet veya kayıt sırasında çıkan bir hata, o satırı sessizce
 * atlar; geri kalan doğru satırlar yine de eklenir. Dosyadaki bir doktor/ürün
 * adı sistemde YOKSA (birebir eşleşme sıfır sonuç), yine kullanıcı isteği ile
 * (2026-08-27: "sistemde yoksa otomatik olarak yeni kayıt olarak eklensin")
 * minimal bir yeni doktor/ürün kaydı otomatik oluşturulup satış ona bağlanır
 * — sadece isim/ürün adı bilinir, diğer alanlar (telefon, kategori vb.) boş/
 * varsayılan kalır, sonradan ilgili sayfadan tamamlanabilir. Aynı isim aynı
 * dosya içinde birden fazla satırda geçiyorsa sadece İLK seferinde oluşturulur
 * (localDoctors/localProducts önbelleği). Ad AYNI ANDA BİRDEN FAZLA kayıtla
 * eşleşiyorsa (belirsiz) oluşturma yapılmaz, satır atlanır — hangisinin
 * kastedildiği tahmin edilmez.
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

  for (const row of rows) {
    const doctorName = readCell(row, 'Doktor', 'Ad Soyad')
    const productName = readCell(row, 'Ürün', 'Ürün Adı')
    const quantityText = readCell(row, 'Adet')
    const dateText = readCell(row, 'Tarih')
    if (!doctorName || !productName || !quantityText || !dateText) continue

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
    if (doctorMatches.length !== 1) continue
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
    if (productMatches.length !== 1) continue
    const product = productMatches[0]

    const saleDate = parseFlexibleDate(dateText)
    if (!saleDate) continue
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
