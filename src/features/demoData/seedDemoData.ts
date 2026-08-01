import { supabase } from '@/lib/supabaseClient'
import { createCustomer, deleteCustomer } from '@/features/customers/api'
import { createProduct } from '@/features/stock/api'
import { recordStockMovement } from '@/features/stock/api'
import { createSale } from '@/features/sales/api'
import { createPayment } from '@/features/payments/api'
import { offlineDelete } from '@/lib/offlineMutation'
import type { PaymentMethod } from '@/types/database'

/**
 * Panel/grafikleri ve diğer sayfaları gerçek görünümüyle denemek için tek
 * tıkla eklenip silinebilen örnek veri seti. Gerçek müşteri/ürün verisiyle
 * karışmasın diye her satır açıkça işaretleniyor: doktorlarda `tags` içinde
 * DEMO_TAG, ürünlerde SKU'da DEMO_SKU_PREFIX — silme işlemi SADECE bu
 * işaretli satırları bulup kaldırıyor. Doktorları silmek customers.id'ye
 * `on delete cascade` bağlı payments/sales/vb. satırları da otomatik
 * temizliyor (bkz. supabase/schema.sql); ürünler ayrıca siliniyor
 * (stock_movements/product_lots ürüne cascade bağlı).
 */
export const DEMO_TAG = 'örnek-veri'
const DEMO_SKU_PREFIX = 'ORNEK-'

const DEMO_CUSTOMERS = [
  { full_name: 'Dr. Ayşe Yılmaz', phone: '0532 111 22 33', province: 'İstanbul', doctor_type: 'sahis' as const, total_debt: 15000 },
  {
    full_name: 'Dr. Mehmet Demir',
    phone: '0533 222 33 44',
    province: 'Ankara',
    doctor_type: 'hastane' as const,
    hospital_name: 'Ankara Şehir Hastanesi',
    total_debt: 8000,
  },
  { full_name: 'Dr. Elif Kaya', phone: '0534 333 44 55', province: 'İzmir', doctor_type: 'sahis' as const, total_debt: 0 },
  { full_name: 'Dr. Can Öztürk', phone: '0535 444 55 66', province: 'Bursa', doctor_type: 'sahis' as const, total_debt: 0 },
  {
    full_name: 'Dr. Zeynep Arslan',
    phone: '0536 555 66 77',
    province: 'Antalya',
    doctor_type: 'hastane' as const,
    hospital_name: 'Antalya Eğitim Hastanesi',
    total_debt: 22000,
  },
]

const DEMO_PRODUCTS = [
  { name: '[Örnek] Botoks 100u', sku: `${DEMO_SKU_PREFIX}BTX100`, unit_cost: 800, unit_price: 1200 },
  { name: '[Örnek] Dolgu Hyaluronik 1ml', sku: `${DEMO_SKU_PREFIX}DLG1`, unit_cost: 500, unit_price: 900 },
  { name: '[Örnek] Mezoterapi Seti', sku: `${DEMO_SKU_PREFIX}MEZO`, unit_cost: 350, unit_price: 600 },
  { name: '[Örnek] PRP Kit', sku: `${DEMO_SKU_PREFIX}PRP`, unit_cost: 400, unit_price: 750 },
]

const PAYMENT_METHODS: PaymentMethod[] = ['nakit', 'kredi_karti', 'havale', 'pos']

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function dateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export interface SeedResult {
  customers: number
  products: number
  payments: number
  sales: number
}

export async function seedDemoData(): Promise<SeedResult> {
  const createdCustomers = []
  for (const c of DEMO_CUSTOMERS) {
    const created = await createCustomer({
      full_name: c.full_name,
      phone: c.phone,
      tags: [DEMO_TAG],
      is_invoiced: false,
      doctor_type: c.doctor_type,
      province: c.province,
      hospital_name: 'hospital_name' in c ? c.hospital_name : null,
      total_debt: c.total_debt || null,
    })
    createdCustomers.push(created)
  }

  const createdProducts = []
  for (const p of DEMO_PRODUCTS) {
    const created = await createProduct({
      name: p.name,
      sku: p.sku,
      unit: 'adet',
      critical_stock_threshold: 5,
      unit_cost: p.unit_cost,
      unit_price: p.unit_price,
    })
    await recordStockMovement({
      product_id: created.id,
      movement_type: 'in',
      quantity: randomInt(20, 50),
      reason: 'Örnek veri — başlangıç stoğu',
    })
    createdProducts.push(created)
  }

  let paymentsCount = 0
  let salesCount = 0

  for (const customer of createdCustomers) {
    const paymentRounds = randomInt(2, 3)
    for (let i = 0; i < paymentRounds; i++) {
      await createPayment({
        customer_id: customer.id,
        amount: randomInt(5, 25) * 1000,
        payment_method: PAYMENT_METHODS[randomInt(0, PAYMENT_METHODS.length - 1)],
        description: 'Örnek veri — deneme tahsilatı',
        paid_at: isoDaysAgo(randomInt(1, 150)),
      })
      paymentsCount++
    }

    const saleRounds = randomInt(1, 2)
    for (let i = 0; i < saleRounds; i++) {
      const product = createdProducts[randomInt(0, createdProducts.length - 1)]
      await createSale({
        type: 'sale',
        customer_id: customer.id,
        product_id: product.id,
        product_name: product.name,
        quantity: randomInt(1, 5),
        unit_price: Number(product.unit_price ?? 0),
        sale_date: dateDaysAgo(randomInt(1, 150)),
        note: 'Örnek veri — deneme satışı',
      })
      salesCount++
    }
  }

  return {
    customers: createdCustomers.length,
    products: createdProducts.length,
    payments: paymentsCount,
    sales: salesCount,
  }
}

export interface ClearResult {
  customersDeleted: number
  productsDeleted: number
}

export async function clearDemoData(): Promise<ClearResult> {
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id')
    .contains('tags', [DEMO_TAG])
  if (customersError) throw customersError

  for (const c of customers ?? []) {
    await deleteCustomer(c.id)
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .like('sku', `${DEMO_SKU_PREFIX}%`)
  if (productsError) throw productsError

  for (const p of products ?? []) {
    await offlineDelete('products', p.id, 'Örnek ürün silme')
  }

  return {
    customersDeleted: customers?.length ?? 0,
    productsDeleted: products?.length ?? 0,
  }
}
