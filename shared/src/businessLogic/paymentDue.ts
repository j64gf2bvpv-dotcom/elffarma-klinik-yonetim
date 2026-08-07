export type PaymentDueStatus = 'overdue' | 'upcoming' | 'ok'

export function getPaymentDueStatus(dueDate: string | null, withinDays = 7): PaymentDueStatus | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= withinDays) return 'upcoming'
  return 'ok'
}

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export const agingBucketLabels: Record<AgingBucket, string> = {
  current: 'Vadesi Gelmemiş',
  '1-30': '1-30 Gün Gecikmiş',
  '31-60': '31-60 Gün Gecikmiş',
  '61-90': '61-90 Gün Gecikmiş',
  '90+': '90+ Gün Gecikmiş',
}

/** Bir doktorun `next_payment_due` tarihine göre kaç günlük gecikme kovasında olduğunu döner (ERP yaşlandırma raporu için). */
export function getAgingBucket(dueDate: string | null): AgingBucket | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const overdueDays = Math.round((today.getTime() - due.getTime()) / 86_400_000)
  if (overdueDays <= 0) return 'current'
  if (overdueDays <= 30) return '1-30'
  if (overdueDays <= 60) return '31-60'
  if (overdueDays <= 90) return '61-90'
  return '90+'
}
