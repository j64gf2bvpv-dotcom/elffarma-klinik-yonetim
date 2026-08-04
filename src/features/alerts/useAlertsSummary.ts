import { addDays } from 'date-fns'
import { useProducts, useAllProductLots } from '@/features/stock/hooks'
import { useCustomers, useAllPendingProducts } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useCongresses, useAllChecklistItems, useAllCongressStockItems } from '@/features/congresses/hooks'
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
  const { data: productLots = [] } = useAllProductLots()
  const { data: allChecklistItems = [] } = useAllChecklistItems()
  const { data: allCongressStockItems = [] } = useAllCongressStockItems()

  const criticalStock = products.filter((p) => p.current_quantity <= p.critical_stock_threshold)

  const expiringProducts = products
    .filter((p) => {
      const status = getExpiryStatus(p.expiry_date)
      return status === 'expired' || status === 'soon'
    })
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))

  const expiringLots = productLots
    .filter((lot) => lot.quantity > 0)
    .map((lot) => {
      const status = getExpiryStatus(lot.expiry_date, 90)
      const band = getExpiryStatus(lot.expiry_date, 30) === 'soon' || status === 'expired'
        ? 30
        : getExpiryStatus(lot.expiry_date, 60) === 'soon'
          ? 60
          : 90
      return { ...lot, status, band }
    })
    .filter((lot) => lot.status === 'expired' || lot.status === 'soon')
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

  const incompleteChecklists = upcomingCongresses
    .map((c) => {
      const items = allChecklistItems.filter((i) => i.congress_id === c.id)
      const missingCount = items.filter((i) => !i.is_done).length
      return { ...c, totalChecklistItems: items.length, missingChecklistItems: missingCount }
    })
    .filter((c) => c.totalChecklistItems === 0 || c.missingChecklistItems > 0)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  const now = new Date()
  const dueReminders = reminders
    .filter((r) => !r.is_done && new Date(r.due_date) <= now)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  // Etkinliği bitmiş (bugünden önce sona ermiş) ama "Götürüldü (Bekliyor)"
  // durumunda kalan — yani kullanıldı/sarf edildi/geri döndü olarak
  // işaretlenmemiş — ürünü olan kongre/workshop'lar. Etkinlik hâlâ devam
  // ediyorsa/gelecekteyse "götürüldü" normal, uyarı değil.
  const congressStockByCongress = new Map<
    string,
    { name: string; pendingQty: number; products: Set<string> }
  >()
  for (const item of allCongressStockItems) {
    if (item.status !== 'goturuldu') continue
    const congress = item.congresses
    if (!congress) continue
    const eventEnd = congress.end_date ?? congress.start_date
    if (!eventEnd || new Date(eventEnd) >= now) continue
    if (!congressStockByCongress.has(item.congress_id)) {
      congressStockByCongress.set(item.congress_id, { name: congress.name, pendingQty: 0, products: new Set() })
    }
    const entry = congressStockByCongress.get(item.congress_id)!
    entry.pendingQty += item.quantity
    entry.products.add(item.product_name)
  }
  const congressStockShortfall = Array.from(congressStockByCongress.entries())
    .map(([congressId, v]) => ({
      id: congressId,
      congress_id: congressId,
      name: v.name,
      pendingQty: v.pendingQty,
      productCount: v.products.size,
    }))
    .sort((a, b) => b.pendingQty - a.pendingQty)

  const total =
    criticalStock.length +
    expiringProducts.length +
    expiringLots.length +
    paymentDue.length +
    doctorsWithBalance.length +
    pendingProducts.length +
    dueReminders.length +
    incompleteChecklists.length +
    congressStockShortfall.length

  return {
    criticalStock,
    expiringProducts,
    expiringLots,
    paymentDue,
    doctorsWithBalance,
    pendingProducts,
    upcomingCongresses,
    incompleteChecklists,
    dueReminders,
    congressStockShortfall,
    total,
  }
}
