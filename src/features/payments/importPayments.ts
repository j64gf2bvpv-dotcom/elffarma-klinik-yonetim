import { format } from 'date-fns'

import { createPayment, type PaymentWithCustomer } from './api'
import { readCell, parseFlexibleDate, type ImportSummary } from '@/lib/importData'
import { tr } from '@/i18n/tr'
import type { Customer, PaymentMethod, SalesRep } from '@/types/database'

export const PAYMENT_IMPORT_HEADERS = ['Doktor', 'Tutar', 'Tarih', 'Yöntem', 'Satış Temsilcisi', 'Açıklama']

export const PAYMENT_IMPORT_SAMPLE_ROWS = [
  {
    Doktor: 'Dr. Ayşe Yılmaz',
    Tutar: 5000,
    Tarih: '15.03.2026',
    Yöntem: 'Nakit',
    'Satış Temsilcisi': '',
    Açıklama: '',
  },
]

export const PAYMENT_IMPORT_FIELD_HINTS: Record<string, string> = {
  Doktor: 'sistemde kayıtlı doktorun tam adı',
  Tutar: 'sayı, para birimi/nokta olmadan',
  Tarih: 'GG.AA.YYYY veya YYYY-AA-GG formatında',
  Yöntem: '"Nakit", "Kredi Kartı", "Havale/EFT" veya "POS", yoksa "Nakit" yaz',
  'Satış Temsilcisi': 'yoksa boş bırak',
  Açıklama: 'yoksa boş bırak',
}

const paymentMethodByLabel = new Map<string, PaymentMethod>(
  Object.entries(tr.paymentMethod).map(([key, label]) => [label.toLocaleLowerCase('tr'), key as PaymentMethod]),
)

/**
 * PaymentsPage'in Akıllı İçe Aktar'ı ile Yapay Zeka Analiz > Dosya
 * Özetle'nin "ilgili bölüme aktar"ı bu TEK fonksiyonu paylaşıyor. Doktor
 * adıyla eşleştirilir (sistemde kayıtlı değilse hata); aynı doktor/tarih/
 * tutar/yöntem kombinasyonu zaten varsa atlanan kayıt sayılır.
 * `summary.added > 0` ise `['payments']` query'sini invalidate etmek
 * çağıranın işi.
 */
export async function importPaymentRows(
  rows: Record<string, unknown>[],
  existingPayments: PaymentWithCustomer[],
  doctors: Customer[],
  salesReps: SalesRep[],
): Promise<ImportSummary> {
  const existingKeys = new Set(
    existingPayments.map(
      (p) => `${p.customer_id}|${format(new Date(p.paid_at), 'yyyy-MM-dd')}|${Number(p.amount)}|${p.payment_method}`,
    ),
  )
  const summary: ImportSummary = { added: 0, skipped: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowLabel = `Satır ${i + 2}`
    const doctorName = readCell(row, 'Doktor', 'Ad Soyad')
    const amountText = readCell(row, 'Tutar')
    const dateText = readCell(row, 'Tarih')
    if (!doctorName || !amountText || !dateText) {
      summary.errors.push(`${rowLabel}: Doktor, Tutar veya Tarih eksik`)
      continue
    }
    const matches = doctors.filter((d) => d.full_name.toLocaleLowerCase('tr') === doctorName.toLocaleLowerCase('tr'))
    if (matches.length === 0) {
      summary.errors.push(`${rowLabel}: "${doctorName}" adında doktor bulunamadı`)
      continue
    }
    if (matches.length > 1) {
      summary.errors.push(`${rowLabel}: "${doctorName}" adında birden fazla doktor var, elle eklenmeli`)
      continue
    }
    const doctor = matches[0]
    const paidAt = parseFlexibleDate(dateText)
    if (!paidAt) {
      summary.errors.push(`${rowLabel}: Geçersiz tarih (${dateText})`)
      continue
    }
    const amount = Number(amountText.replace(/[^\d.-]/g, ''))
    if (!amount || amount <= 0) {
      summary.errors.push(`${rowLabel}: Geçersiz tutar (${amountText})`)
      continue
    }
    const methodText = readCell(row, 'Yöntem').toLocaleLowerCase('tr')
    const paymentMethod = paymentMethodByLabel.get(methodText) ?? 'nakit'
    const repName = readCell(row, 'Satış Temsilcisi')
    const rep = repName ? salesReps.find((r) => r.name.toLocaleLowerCase('tr') === repName.toLocaleLowerCase('tr')) : undefined

    const key = `${doctor.id}|${format(paidAt, 'yyyy-MM-dd')}|${amount}|${paymentMethod}`
    if (existingKeys.has(key)) {
      summary.skipped++
      continue
    }

    try {
      await createPayment({
        customer_id: doctor.id,
        amount,
        payment_method: paymentMethod,
        description: readCell(row, 'Açıklama') || null,
        paid_at: paidAt.toISOString(),
        sales_rep_id: rep?.id ?? null,
      })
      existingKeys.add(key)
      summary.added++
    } catch (err) {
      summary.errors.push(`${rowLabel}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
    }
  }

  return summary
}
