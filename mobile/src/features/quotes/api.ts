import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Quote, QuoteItem, QuoteStatus } from '@shared/types/database'

export interface QuoteWithCustomer extends Quote {
  customer_name: string
}

export interface QuoteItemInput {
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
}

export interface CreateQuoteInput {
  customer_id: string
  valid_until?: string | null
  note?: string | null
  discount_rate?: number
  vat_rate?: number
  items: QuoteItemInput[]
}

function generateQuoteNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 900 + 100)
  return `TKL-${y}${m}${d}-${rand}`
}

export async function fetchQuotes(status?: QuoteStatus | 'all'): Promise<QuoteWithCustomer[]> {
  let query = supabase
    .from('quotes')
    .select('*, customers(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    customer_name: (r as { customers?: { full_name: string | null } }).customers?.full_name ?? 'Bilinmeyen',
  })) as QuoteWithCustomer[]
}

export async function fetchQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  const { data, error } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('created_at')
  if (error) throw error
  return data as QuoteItem[]
}

/** Teklif + kalemlerini tek işlemde oluşturur — offline kuyruk desteği
 * gerektiği için tek bir RPC yerine sıralı insert kullanılıyor (masaüstünde
 * de aynı iki-adımlı desen: önce quotes, sonra quote_items). */
export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const userId = await getCurrentUserId()
  const quote = await offlineInsert<Quote>(
    'quotes',
    {
      quote_number: generateQuoteNumber(),
      customer_id: input.customer_id,
      status: 'taslak',
      valid_until: input.valid_until ?? null,
      note: input.note ?? null,
      discount_rate: input.discount_rate ?? 0,
      vat_rate: input.vat_rate ?? 20,
      created_by: userId,
    },
    `Teklif: ${input.customer_id}`,
  )
  for (const item of input.items) {
    await offlineInsert(
      'quote_items',
      {
        quote_id: quote.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      },
      `Teklif kalemi: ${item.product_name}`,
    )
  }
  return quote
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote> {
  return offlineUpdate<Quote>('quotes', id, { status }, 'Teklif durumu güncelleme')
}

export async function deleteQuote(id: string): Promise<void> {
  return offlineDelete('quotes', id, 'Teklif silme')
}
