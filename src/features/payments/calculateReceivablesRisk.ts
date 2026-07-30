import type { InstallmentWithPlan } from './api'

export interface CustomerRiskRow {
  customerId: string
  customerName: string
  overdueCount: number
  overdueAmount: number
  maxDaysOverdue: number
  estimatedLateFee: number
}

/**
 * Ödenmemiş (paid_payment_id boş) ve vadesi geçmiş taksitleri doktor bazında
 * toplar. Gecikme faizi, planın late_fee_rate'i taksit tutarına tek seferlik
 * (bileşik değil) uygulanarak tahmini olarak hesaplanır — gerçek faiz
 * muhasebesi yerine basit bir risk göstergesi olarak kullanılmalıdır.
 */
export function calculateReceivablesRisk(installments: InstallmentWithPlan[]): CustomerRiskRow[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const byCustomer = new Map<string, CustomerRiskRow>()

  for (const installment of installments) {
    if (installment.paid_payment_id) continue
    const plan = installment.payment_installment_plans
    if (!plan) continue
    const dueDate = new Date(installment.due_date)
    dueDate.setHours(0, 0, 0, 0)
    const daysOverdue = Math.round((today.getTime() - dueDate.getTime()) / 86_400_000)
    if (daysOverdue <= 0) continue

    let row = byCustomer.get(plan.customer_id)
    if (!row) {
      row = {
        customerId: plan.customer_id,
        customerName: plan.customers?.full_name ?? 'Bilinmeyen Doktor',
        overdueCount: 0,
        overdueAmount: 0,
        maxDaysOverdue: 0,
        estimatedLateFee: 0,
      }
      byCustomer.set(plan.customer_id, row)
    }
    row.overdueCount += 1
    row.overdueAmount += Number(installment.amount)
    row.maxDaysOverdue = Math.max(row.maxDaysOverdue, daysOverdue)
    row.estimatedLateFee += Number(installment.amount) * (Number(plan.late_fee_rate) / 100)
  }

  return Array.from(byCustomer.values()).sort((a, b) => b.overdueAmount - a.overdueAmount)
}
