// Faz 1'de Satışlar ekranı yok (Faz 2) — bu dosya sadece Cari Hesap bakiye
// hesaplaması (computeCariLedger) için TÜM satışları okuyor.
import { supabase } from '@/lib/supabaseClient'
import type { Sale } from '@shared/types/database'

export async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
  if (error) throw error
  return data as Sale[]
}
