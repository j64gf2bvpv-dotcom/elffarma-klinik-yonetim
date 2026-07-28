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
