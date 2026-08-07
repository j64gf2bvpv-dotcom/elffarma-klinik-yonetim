import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { PaymentInstallmentPlan, PaymentInstallment } from '@shared/types/database'

export interface InstallmentPlanWithCustomer extends PaymentInstallmentPlan {
  customer_name: string
  installments: PaymentInstallment[]
  paid_count: number
}

export interface CreateInstallmentPlanInput {
  customer_id: string
  total_amount: number
  installment_count: number
  late_fee_rate?: number
  description?: string | null
}

export async function fetchInstallmentPlans(): Promise<InstallmentPlanWithCustomer[]> {
  const { data, error } = await supabase
    .from('payment_installment_plans')
    .select('*, customers(full_name), payment_installments(*)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r) => {
    const installments = (r as { payment_installments?: PaymentInstallment[] }).payment_installments ?? []
    return {
      ...r,
      customer_name: (r as { customers?: { full_name: string | null } }).customers?.full_name ?? 'Bilinmeyen',
      installments: installments.sort((a, b) => a.installment_no - b.installment_no),
      paid_count: installments.filter((i) => i.paid_payment_id !== null).length,
    }
  }) as InstallmentPlanWithCustomer[]
}

export async function createInstallmentPlan(input: CreateInstallmentPlanInput): Promise<PaymentInstallmentPlan> {
  const userId = await getCurrentUserId()
  const plan = await offlineInsert<PaymentInstallmentPlan>('payment_installment_plans', {
    customer_id: input.customer_id,
    total_amount: input.total_amount,
    installment_count: input.installment_count,
    late_fee_rate: input.late_fee_rate ?? 0,
    description: input.description ?? null,
    created_by: userId,
  }, 'Taksit planı')

  // Taksit satırlarını otomatik oluştur
  const installmentAmount = Math.round((input.total_amount / input.installment_count) * 100) / 100
  const rows = Array.from({ length: input.installment_count }, (_, i) => ({
    plan_id: plan.id,
    installment_no: i + 1,
    due_date: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    amount: installmentAmount,
  }))
  const { error: insError } = await supabase.from('payment_installments').insert(rows)
  if (insError) throw insError

  return plan
}

export async function deleteInstallmentPlan(id: string): Promise<void> {
  return offlineDelete('payment_installment_plans', id, 'Taksit planı silme')
}
