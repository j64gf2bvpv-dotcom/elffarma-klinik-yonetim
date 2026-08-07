// Masaüstündeki src/features/customers/api.ts'in Faz 1 alt kümesi — Cari
// Hesap ekranı sadece okuma (liste + detay) yapıyor, bu yüzden create/update/
// delete/pending-products burada yok (Müşteriler CRUD'u Faz 2'de eklenecek).
import { supabase } from '@/lib/supabaseClient'
import type { Customer } from '@shared/types/database'

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
