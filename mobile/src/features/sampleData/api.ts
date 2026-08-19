import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { createCustomer } from '@/features/customers/api'
import { createSale } from '@/features/sales/api'
import { recordStockMovement, fetchProducts } from '@/features/stock/api'
import { createPayment } from '@/features/payments/api'
import { startVisitForCustomer, checkInVisit } from '@/features/doctorVisits/api'
import type { Sale } from '@shared/types/database'

/**
 * Ayarlar > admin-only "Örnek Veri" kartının veri katmanı — kullanıcı
 * isteğiyle (2026-08-20). Eklenen her kayıt "[ÖRNEK]" etiketiyle işaretli
 * (masaüstündeki/önceki manuel eklenen gösterim kayıtlarıyla aynı kural —
 * bkz. CHANGELOG'daki [ÖRNEK] satırlar), silme işlemi de bu etiketi (ve
 * geriye dönük uyumluluk için eski "[TEST]" etiketini) arayarak SADECE
 * bu kayıtları temizler, başka hiçbir veriye dokunmaz.
 */
const TAG = '[ÖRNEK]'
const LEGACY_TAG = '[TEST]'

const SAMPLE_CUSTOMERS = [
  { full_name: `${TAG} Dr. Ayşe Demir`, phone: '05551000001', hospital_name: 'Demo Poliklinik' },
  { full_name: `${TAG} Dr. Mehmet Kaya`, phone: '05551000002', hospital_name: 'Demo Hastanesi' },
  { full_name: `${TAG} Dr. Zeynep Şahin`, phone: '05551000003', hospital_name: 'Demo Klinik' },
]

export interface InsertSampleDataResult {
  customers: number
  sale: boolean
  payment: boolean
  visit: boolean
}

export async function insertSampleData(): Promise<InsertSampleDataResult> {
  const createdCustomers = []
  for (const c of SAMPLE_CUSTOMERS) {
    createdCustomers.push(await createCustomer(c))
  }
  const first = createdCustomers[0]

  const products = await fetchProducts('')
  const product = products[0]

  let sale = false
  let payment = false
  let visit = false

  if (first && product) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const quantity = 2
    const unitPrice = product.unit_price ?? 0
    await createSale({
      type: 'sale',
      customer_id: first.id,
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      sale_date: todayStr,
      note: `${TAG} gösterim amaçlı`,
      status: 'bekleyen',
    })
    await recordStockMovement({
      product_id: product.id,
      movement_type: 'out',
      quantity,
      reason: 'Satış',
      customer_id: first.id,
      unit_price: unitPrice,
      note: `${TAG} gösterim amaçlı`,
    })
    sale = true

    await createPayment({
      customer_id: first.id,
      amount: 1500,
      payment_method: 'havale',
      description: `${TAG} gösterim amaçlı`,
      paid_at: new Date().toISOString(),
    })
    payment = true

    const createdVisit = await startVisitForCustomer(first.id, first.full_name)
    await checkInVisit(createdVisit.id)
    visit = true
  }

  return { customers: createdCustomers.length, sale, payment, visit }
}

export interface DeleteSampleDataResult {
  customers: number
  sales: number
  payments: number
  visits: number
  quotes: number
}

export async function deleteSampleData(): Promise<DeleteSampleDataResult> {
  const tagFilter = `%${TAG}%`
  const legacyFilter = `%${LEGACY_TAG}%`

  const { data: customers, error: customersErr } = await supabase
    .from('customers')
    .select('id')
    .or(`full_name.ilike.${tagFilter},full_name.ilike.${legacyFilter}`)
  if (customersErr) throw customersErr
  const customerIds = (customers ?? []).map((c) => c.id)

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, product_id, quantity, type, unit_price, customer_id')
    .or(
      `note.ilike.${tagFilter},note.ilike.${legacyFilter},product_name.ilike.${tagFilter},product_name.ilike.${legacyFilter}${
        customerIds.length ? `,customer_id.in.(${customerIds.join(',')})` : ''
      }`,
    )
  if (salesErr) throw salesErr
  const saleRows = (sales ?? []) as Pick<Sale, 'id' | 'product_id' | 'quantity' | 'type' | 'unit_price' | 'customer_id'>[]

  // Stok, CLAUDE.md kuralı gereği asla doğrudan yazılmıyor — silinen her
  // satış/iade satırı için ters yönde bir düzeltme hareketi düşülüyor
  // (record_stock_movement RPC'si), audit-trail hiçbir zaman silinmiyor.
  for (const row of saleRows) {
    if (!row.product_id) continue
    await recordStockMovement({
      product_id: row.product_id,
      movement_type: row.type === 'sale' ? 'in' : 'out',
      quantity: row.quantity,
      reason: 'Örnek veri silindi',
      customer_id: row.customer_id,
      unit_price: row.unit_price,
      note: `${TAG} silindi — stok geri alındı`,
    })
  }

  const saleIds = saleRows.map((r) => r.id)
  if (saleIds.length) {
    const { error } = await supabase.from('sales').delete().in('id', saleIds)
    if (error) throw error
  }

  const { data: deletedPayments, error: paymentsErr } = await supabase
    .from('payments')
    .delete()
    .or(
      `description.ilike.${tagFilter},description.ilike.${legacyFilter}${
        customerIds.length ? `,customer_id.in.(${customerIds.join(',')})` : ''
      }`,
    )
    .select('id')
  if (paymentsErr) throw paymentsErr

  const { data: deletedVisits, error: visitsErr } = await supabase
    .from('doctor_visits')
    .delete()
    .or(
      `notes.ilike.${tagFilter},notes.ilike.${legacyFilter}${
        customerIds.length ? `,customer_id.in.(${customerIds.join(',')})` : ''
      }`,
    )
    .select('id')
  if (visitsErr) throw visitsErr

  const { data: deletedQuotes, error: quotesErr } = await supabase
    .from('quotes')
    .delete()
    .or(`note.ilike.${tagFilter},note.ilike.${legacyFilter},quote_number.ilike.${tagFilter}`)
    .select('id')
  if (quotesErr) throw quotesErr

  if (customerIds.length) {
    const { error } = await supabase.from('customers').delete().in('id', customerIds)
    if (error) throw error
  }

  return {
    customers: customerIds.length,
    sales: saleIds.length,
    payments: deletedPayments?.length ?? 0,
    visits: deletedVisits?.length ?? 0,
    quotes: deletedQuotes?.length ?? 0,
  }
}
