import { createCustomer } from './api'
import { normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import { readCell, type ImportSummary } from '@/lib/importData'
import type { Customer } from '@/types/database'

export const CUSTOMER_IMPORT_HEADERS = [
  'Ad Soyad',
  'Telefon',
  'Tip',
  'İl',
  'Hastane',
  'Ödeme Vadesi',
  'TC Kimlik No',
  'Vergi Numarası',
  'KDV Oranı',
  'Adres',
  'Fatura Durumu',
  'Etiketler',
]

export const CUSTOMER_IMPORT_SAMPLE_ROWS = [
  {
    'Ad Soyad': 'Dr. Ayşe Yılmaz',
    Telefon: '0532 123 45 67',
    Tip: 'Şahıs',
    İl: 'İstanbul',
    Hastane: '',
    'Ödeme Vadesi': '2026-08-15',
    'TC Kimlik No': '',
    'Vergi Numarası': '',
    'KDV Oranı': '',
    Adres: '',
    'Fatura Durumu': 'Faturasız',
    Etiketler: 'botoks, vip',
  },
]

export const CUSTOMER_IMPORT_FIELD_HINTS: Record<string, string> = {
  Tip: '"Şahıs" veya "Hastane"',
  'Ödeme Vadesi': 'YYYY-AA-GG formatında tarih, yoksa boş',
  'KDV Oranı': 'sayı, % işareti olmadan (ör. 18), yoksa boş',
  'Fatura Durumu': '"Faturalı" veya "Faturasız"',
  Etiketler: 'virgülle ayrılmış kısa etiketler, yoksa boş',
}

/**
 * CustomersPage'in Akıllı İçe Aktar'ı ile Yapay Zeka Analiz > Dosya
 * Özetle'nin "ilgili bölüme aktar"ı bu TEK fonksiyonu paylaşıyor. Telefon
 * numarasına göre dedup yapılır (zaten kayıtlı numara hata değil, atlanan
 * kayıt sayılır). `summary.added > 0` ise `['customers']` query'sini
 * invalidate etmek çağıranın işi.
 */
export async function importCustomerRows(
  rows: Record<string, unknown>[],
  existingCustomers: Customer[],
): Promise<ImportSummary> {
  const existingPhones = new Set(existingCustomers.map((c) => c.phone))
  const summary: ImportSummary = { added: 0, skipped: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowLabel = `Satır ${i + 2}`
    const fullName = readCell(row, 'Ad Soyad', 'Ad', 'İsim')
    const phoneRaw = readCell(row, 'Telefon', 'Phone')
    if (!fullName || !phoneRaw) {
      summary.errors.push(`${rowLabel}: Ad Soyad veya Telefon eksik`)
      continue
    }
    const normalized = normalizeTrPhone(phoneRaw)
    if (!normalized) {
      summary.errors.push(`${rowLabel}: Geçersiz telefon numarası (${phoneRaw})`)
      continue
    }
    if (existingPhones.has(normalized.canonical)) {
      summary.skipped++
      continue
    }

    const tip = readCell(row, 'Tip', 'Doktor Tipi')
    const isInvoicedText = readCell(row, 'Fatura Durumu', 'Faturalı')
    const vatRateText = readCell(row, 'KDV Oranı')

    try {
      await createCustomer({
        full_name: fullName,
        phone: phoneRaw,
        doctor_type: /hastane/i.test(tip) ? 'hastane' : 'sahis',
        province: readCell(row, 'İl') || null,
        hospital_name: readCell(row, 'Hastane') || null,
        next_payment_due: readCell(row, 'Ödeme Vadesi') || null,
        tc_no: readCell(row, 'TC Kimlik No') || null,
        tax_number: readCell(row, 'Vergi Numarası') || null,
        vat_rate: (() => {
          if (!vatRateText) return null
          const n = Number(vatRateText.replace(/[^\d.-]/g, ''))
          return Number.isFinite(n) ? n : null
        })(),
        address: readCell(row, 'Adres') || null,
        is_invoiced: /faturalı|evet/i.test(isInvoicedText),
        tags: readCell(row, 'Etiketler')
          ? readCell(row, 'Etiketler').split(',').map((t) => t.trim()).filter(Boolean)
          : [],
      })
      existingPhones.add(normalized.canonical)
      summary.added++
    } catch (err) {
      summary.errors.push(`${rowLabel}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
    }
  }

  return summary
}
