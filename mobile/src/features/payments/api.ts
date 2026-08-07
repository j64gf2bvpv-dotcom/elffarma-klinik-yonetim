import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, getCurrentUserId } from '@/lib/offlineMutation'
import type { Payment, PaymentMethod } from '@shared/types/database'

export interface PaymentInput {
  customer_id: string
  amount: number
  payment_method: PaymentMethod
  description?: string | null
  paid_at: string
  sales_rep_id?: string | null
}

export interface PaymentFilters {
  customerId?: string
  from?: string
  to?: string
}

export type PaymentWithCustomer = Payment & {
  customers: { full_name: string; province: string | null } | null
  sales_reps: { name: string } | null
}

export async function fetchPayments(filters: PaymentFilters): Promise<PaymentWithCustomer[]> {
  let query = supabase
    .from('payments')
    .select('*, customers(full_name, province), sales_reps(name)')
    .order('paid_at', { ascending: false })

  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.from) query = query.gte('paid_at', filters.from)
  if (filters.to) query = query.lte('paid_at', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data as unknown as PaymentWithCustomer[]
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  const staffId = await getCurrentUserId()
  return offlineInsert<Payment>('payments', { ...input, staff_id: staffId }, `Tahsilat: ${input.amount} TL`)
}
