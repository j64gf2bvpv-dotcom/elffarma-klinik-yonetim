// Faz 1'de Faturalar ekranı yok — bu dosya sadece Cari Hesap bakiye
// hesaplaması (computeCariLedger) için TÜM faturaları okuyor.
import { supabase } from '@/lib/supabaseClient'
import type { Invoice } from '@shared/types/database'

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false })
  if (error) throw error
  return data as Invoice[]
}
