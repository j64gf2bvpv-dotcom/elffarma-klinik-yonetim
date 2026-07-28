import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Invoice } from '@/types/database'

export interface InvoiceInput {
  invoice_number: string
  customer_id: string
  amount: number
  issue_date: string
  note?: string | null
}

export type InvoiceWithCustomer = Invoice & { customers: { full_name: string } | null }

export async function fetchInvoices(): Promise<InvoiceWithCustomer[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(full_name)')
    .order('issue_date', { ascending: false })
  if (error) throw error
  return data as unknown as InvoiceWithCustomer[]
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Invoice>('invoices', { ...input, created_by: createdBy }, `Fatura: ${input.invoice_number}`)
}

export async function deleteInvoice(id: string): Promise<void> {
  return offlineDelete('invoices', id, 'Fatura silme')
}
