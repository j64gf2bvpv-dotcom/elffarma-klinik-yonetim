import { addDays } from 'date-fns'
import { useProducts } from '@/features/stock/hooks'
import { useCustomers, useAllPendingProducts } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useReminders } from '@/features/reminders/hooks'
import { getPaymentDueStatus } from '@/lib/paymentDue'
import { getExpiryStatus } from '@/lib/expiry'

export function useAlertsSummary() {
  const { data: products = [] } = useProducts('')
  const { data: doctors = [] } = useCustomers('')
  const { data: congresses = [] } = useCongresses()
  const { data: allPayments = [] } = usePayments({})
  const { data: pendingProducts = [] } = useAllPendingProducts()
  const { data: reminders = [] } = useReminders()

  const criticalStock = products.filter((p) => p.current_quantity <= p.critical_stock_threshold)

  const expiringProducts = products
    .filter((p) => {
      const status = getExpiryStatus(p.expiry_date)
      return status === 'expired' || status === 'soon'
    })
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))

  const paymentDue = doctors
    .filter((d) => {
      const status = getPaymentDueStatus(d.next_payment_due)
      return status === 'overdue' || status === 'upcoming'
    })
    .sort((a, b) => (a.next_payment_due ?? '').localeCompare(b.next_payment_due ?? ''))

  const paidByCustomer = new Map<string, number>()
  for (const p of allPayments) paidByCustomer.set(p.customer_id, (paidByCustomer.get(p.customer_id) ?? 0) + Number(p.amount))
  const doctorsWithBalance = doctors
    .filter((d) => d.total_debt != null && Number(d.total_debt) - (paidByCustomer.get(d.id) ?? 0) > 0)
    .map((d) => ({ ...d, balance: Number(d.total_debt) - (paidByCustomer.get(d.id) ?? 0) }))
    .sort((a, b) => b.balance - a.balance)

  const upcomingWindow = addDays(new Date(), 14)
  const upcomingCongresses = congresses.filter(
    (c) => c.start_date && new Date(c.start_date) >= new Date() && new Date(c.start_date) <= upcomingWindow,
  )

  const now = new Date()
  const dueReminders = reminders
    .filter((r) => !r.is_done && new Date(r.due_date) <= now)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const total =
    criticalStock.length +
    expiringProducts.length +
    paymentDue.length +
    doctorsWithBalance.length +
    pendingProducts.length +
    dueReminders.length

  return {
    criticalStock,
    expiringProducts,
    paymentDue,
    doctorsWithBalance,
    pendingProducts,
    upcomingCongresses,
    dueReminders,
    total,
  }
}
