// Masaüstündeki src/features/customers/api.ts'in Faz 1 alt kümesi — Cari
// Hesap ekranı sadece okuma (liste + detay) yapıyor, bu yüzden update/delete/
// pending-products burada yok (tam CRUD Faz 2'de). createCustomer istisna:
// kartvizit tarama sonucunu kaydedebilmek için minimal (ad+telefon zorunlu)
// bir ekleme yolu — masaüstündeki CustomerCombobox "Yeni Doktor Ekle" hızlı
// formuyla aynı asgari alan seti.
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert } from '@/lib/offlineMutation'
import type { Customer } from '@shared/types/database'

export interface CreateCustomerInput {
  full_name: string
  phone: string
  email?: string | null
  hospital_name?: string | null
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return offlineInsert<Customer>('customers', { ...input }, `Doktor: ${input.full_name}`)
}

export type InvoiceFilter = 'all' | 'invoiced' | 'not_invoiced'

export async function fetchCustomers(
  search: string,
  invoiceFilter: InvoiceFilter = 'all',
  province?: string,
): Promise<Customer[]> {
  let query = supabase.from('customers').select('*').order('full_name', { ascending: true })
  if (search.trim()) {
    const term = search.trim().replace(/,/g, ' ')
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
