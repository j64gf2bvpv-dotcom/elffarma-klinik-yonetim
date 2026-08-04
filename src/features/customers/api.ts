import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import type { Customer, CustomerPendingProduct, DoctorType, PaymentMethod } from '@/types/database'

export interface CustomerInput {
  full_name: string
  phone: string
  email?: string | null
  notes?: string | null
  tags: string[]
  is_invoiced: boolean
  doctor_type: DoctorType
  province?: string | null
  hospital_name?: string | null
  next_payment_due?: string | null
  total_debt?: number | null
  tc_no?: string | null
  address?: string | null
  tax_number?: string | null
  vat_rate?: number | null
  preferred_payment_method?: PaymentMethod | null
  specialty?: string | null
  clinic_id?: string | null
  mobile_phone?: string | null
  whatsapp_phone?: string | null
  website?: string | null
  instagram?: string | null
  district?: string | null
  tax_office?: string | null
  assistant_info?: string | null
  secretary_info?: string | null
  referrer?: string | null
  sales_rep_id?: string | null
  region_id?: string | null
  is_active?: boolean
  is_vip?: boolean
  photo_url?: string | null
  sample_monthly_quota?: number | null
  sample_yearly_quota?: number | null
}

export type InvoiceFilter = 'all' | 'invoiced' | 'not_invoiced'

export async function fetchCustomers(
  search: string,
  invoiceFilter: InvoiceFilter = 'all',
  province?: string,
): Promise<Customer[]> {
  let query = supabase.from('customers').select('*').order('full_name', { ascending: true })
  if (search.trim()) {
    const term = search.trim()
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
  }
  if (invoiceFilter === 'invoiced') query = query.eq('is_invoiced', true)
  if (invoiceFilter === 'not_invoiced') query = query.eq('is_invoiced', false)
  if (province) query = query.eq('province', province)
  const { data, error } = await query
  if (error) throw error
  return data as Customer[]
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error) throw error
  return data as Customer
}

function toCanonicalPhone(input: string): string {
  const result = normalizeTrPhone(input)
  return result ? result.canonical : input
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Customer>(
    'customers',
    { ...input, phone: toCanonicalPhone(input.phone), created_by: createdBy },
    `Doktor: ${input.full_name}`,
  )
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  return offlineUpdate<Customer>(
    'customers',
    id,
    { ...input, phone: toCanonicalPhone(input.phone) },
    `Doktor güncelleme: ${input.full_name}`,
  )
}

export async function deleteCustomer(id: string): Promise<void> {
  return offlineDelete('customers', id, 'Doktor silme')
}

export async function fetchHospitalNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('hospital_name')
    .eq('doctor_type', 'hastane')
    .not('hospital_name', 'is', null)
  if (error) throw error
  const names = new Set((data as { hospital_name: string | null }[]).map((r) => r.hospital_name).filter(Boolean) as string[])
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'))
}

export interface PendingProductInput {
  customer_id: string
  product_name: string
  quantity: number
  unit_price: number
  note?: string | null
}

export async function fetchPendingProducts(customerId: string): Promise<CustomerPendingProduct[]> {
  const { data, error } = await supabase
    .from('customer_pending_products')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as CustomerPendingProduct[]
}

export type PendingProductWithCustomer = CustomerPendingProduct & { customers: { full_name: string } | null }

export async function fetchAllPendingProducts(): Promise<PendingProductWithCustomer[]> {
  const { data, error } = await supabase
    .from('customer_pending_products')
    .select('*, customers(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as PendingProductWithCustomer[]
}

export async function createPendingProduct(input: PendingProductInput): Promise<CustomerPendingProduct> {
  return offlineInsert<CustomerPendingProduct>(
    'customer_pending_products',
    { ...input },
    `Eksik ürün: ${input.product_name}`,
  )
}

export async function deletePendingProduct(id: string): Promise<void> {
  return offlineDelete('customer_pending_products', id, 'Eksik ürün silme')
}
