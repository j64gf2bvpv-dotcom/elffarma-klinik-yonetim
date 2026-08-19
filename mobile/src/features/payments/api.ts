import { decode } from 'base64-arraybuffer'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Payment, PaymentInstallment, PaymentInstallmentPlan, PaymentMethod } from '@shared/types/database'

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

// Masaüstündeki src/features/payments/api.ts'teki uploadInvoiceFile/
// saveInvoiceInfo/getInvoiceFileUrl'in mobil karşılığı — aynı `invoices`
// private bucket'ı ve aynı payments.invoice_number/invoice_file_path
// kolonlarını kullanır. RN'de tarayıcı File nesnesi yok; masaüstünün
// aksine expo-image-picker'ın base64 çıktısı base64-arraybuffer ile
// çözülüp yükleniyor (bkz. attachments/api.ts'teki aynı desen — documents
// yerine invoices bucket'ı hedefliyor).
export async function uploadInvoiceFile(
  paymentId: string,
  base64: string,
  ext = 'jpg',
  contentType = 'image/jpeg',
): Promise<string> {
  const path = `${paymentId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('invoices').upload(path, decode(base64), { contentType, upsert: true })
  if (uploadError) throw uploadError
  return path
}

export async function saveInvoiceInfo(
  paymentId: string,
  input: Partial<{ invoice_number: string | null; invoice_file_path: string | null }>,
): Promise<void> {
  await offlineUpdate('payments', paymentId, { ...input }, 'Fatura bilgisi güncelleme')
}

export async function getInvoiceFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

// Masaüstündeki taksitli tahsilat planı (payment_installment_plans /
// payment_installments) mantığının birebir mobil karşılığı — aynı
// tablolar, aynı hesaplama (son taksit, küsuratı toplasın diye
// baseAmount * (count-1) farkını alıyor).
export interface InstallmentPlanInput {
  customer_id: string
  total_amount: number
  installment_count: number
  late_fee_rate: number
  description?: string | null
  first_due_date: string
  interval_days: number
}

export type InstallmentPlanWithCustomer = PaymentInstallmentPlan & { customers: { full_name: string } | null }
export type InstallmentWithPlan = PaymentInstallment & { payment_installment_plans: InstallmentPlanWithCustomer | null }

export async function fetchInstallmentPlans(customerId?: string): Promise<InstallmentPlanWithCustomer[]> {
  let query = supabase
    .from('payment_installment_plans')
    .select('*, customers(full_name)')
    .order('created_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as InstallmentPlanWithCustomer[]
}

export async function fetchAllInstallments(): Promise<InstallmentWithPlan[]> {
  const { data, error } = await supabase
    .from('payment_installments')
    .select('*, payment_installment_plans(*, customers(full_name))')
    .order('due_date', { ascending: true })
  if (error) throw error
  return data as unknown as InstallmentWithPlan[]
}

export async function createInstallmentPlan(input: InstallmentPlanInput): Promise<PaymentInstallmentPlan> {
  const createdBy = await getCurrentUserId()
  const plan = await offlineInsert<PaymentInstallmentPlan>(
    'payment_installment_plans',
    {
      customer_id: input.customer_id,
      total_amount: input.total_amount,
      installment_count: input.installment_count,
      late_fee_rate: input.late_fee_rate,
      description: input.description ?? null,
      created_by: createdBy,
    },
    `Taksit planı: ${input.total_amount} TL / ${input.installment_count} taksit`,
  )

  const baseAmount = Math.floor((input.total_amount / input.installment_count) * 100) / 100
  const firstDue = new Date(input.first_due_date)
  for (let i = 0; i < input.installment_count; i++) {
    const dueDate = new Date(firstDue)
    dueDate.setDate(dueDate.getDate() + i * input.interval_days)
    const isLast = i === input.installment_count - 1
    const amount = isLast ? input.total_amount - baseAmount * (input.installment_count - 1) : baseAmount
    await offlineInsert(
      'payment_installments',
      {
        plan_id: plan.id,
        installment_no: i + 1,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        amount,
      },
      `Taksit ${i + 1}/${input.installment_count}`,
    )
  }

  return plan
}

export async function markInstallmentPaid(installmentId: string, paymentId: string): Promise<void> {
  await offlineUpdate('payment_installments', installmentId, { paid_payment_id: paymentId }, 'Taksit tahsilatı')
}

export async function deleteInstallmentPlan(id: string): Promise<void> {
  return offlineDelete('payment_installment_plans', id, 'Taksit planı silme')
}
