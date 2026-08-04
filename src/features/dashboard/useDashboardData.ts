import * as React from 'react'
import {
  AlertTriangle,
  BellRing,
  ClipboardList,
  ClipboardX,
  PackageOpen,
  Presentation,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'

import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useAllParticipantProductSales } from '@/features/congresses/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useProducts } from '@/features/stock/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useBudgetTargets } from '@/features/budget/hooks'
import { useAlertsSummary } from '@/features/alerts/useAlertsSummary'
import { netAmount } from '@/features/sales/netAmount'
import { computeCariLedger, computeCariTotals } from '@/features/customers/cariLedger'
import { pctDelta } from '@/lib/pctDelta'

export interface StatTrend {
  current: number
  previous: number
  deltaPct: number | null
  sparkline: { value: number }[]
}

export interface RankedItem {
  id: string
  name: string
  revenue: number
  deltaPct: number | null
}

export interface NotificationItem {
  key: string
  icon: LucideIcon
  tone: 'destructive' | 'primary'
  title: string
  subtitle: string
  to: string
  createdAt: string | null
  imageUrl?: string | null
}

/** Bir haftalık kovalara toplanmış {tarih, tutar} listesi — sparkline'lar için. */
function weeklyBuckets(items: { date: Date; amount: number }[], weeks: number): { value: number }[] {
  const now = new Date()
  const buckets = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i--) {
    const key = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }).toISOString()
    buckets.set(key, 0)
  }
  for (const item of items) {
    const key = startOfWeek(item.date, { weekStartsOn: 1 }).toISOString()
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + item.amount)
  }
  return Array.from(buckets.values()).map((value) => ({ value }))
}

export function useDashboardData() {
  const { data: sales = [], isLoading: salesLoading } = useSales()
  const { data: participantSales = [], isLoading: participantSalesLoading } = useAllParticipantProductSales()
  const { data: allPayments = [], isLoading: paymentsLoading } = usePayments({})
  const { data: customers = [], isLoading: customersLoading } = useCustomers('')
  const { data: invoices = [] } = useInvoices()
  const { data: products = [] } = useProducts('')
  const { data: salesReps = [] } = useSalesReps()
  const { data: congresses = [] } = useCongresses()
  const currentYear = new Date().getFullYear()
  const { data: budgetTargets = [] } = useBudgetTargets(currentYear)
  const alerts = useAlertsSummary()

  const isLoading = salesLoading || participantSalesLoading || paymentsLoading || customersLoading

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const prevMonthStart = React.useMemo(() => startOfMonth(subMonths(new Date(), 1)), [])
  const currentMonth = monthStart.getMonth() + 1

  // En Çok Satan Ürünler / Doktor Bazlı Satış Performansı için "bu ay" yerine
  // kayan 90 günlük pencere kullanılıyor — sadece takvim ayının başından
  // itibaren satış yoksa liste boş görünmesin diye, gerçek son 90 günlük
  // veriye bakıyor (uydurma veri değil, sadece daha geniş bir gerçek pencere).
  const rankingWindowStart = React.useMemo(() => startOfDay(subDays(new Date(), 90)), [])
  const rankingWindowPrevStart = React.useMemo(() => startOfDay(subDays(new Date(), 180)), [])

  const salesThisMonth = React.useMemo(() => sales.filter((s) => new Date(s.sale_date) >= monthStart), [sales, monthStart])
  const salesPrevMonth = React.useMemo(
    () => sales.filter((s) => new Date(s.sale_date) >= prevMonthStart && new Date(s.sale_date) < monthStart),
    [sales, prevMonthStart, monthStart],
  )
  const congressSalesThisMonth = React.useMemo(
    () => participantSales.filter((s) => new Date(s.created_at) >= monthStart),
    [participantSales, monthStart],
  )
  const congressSalesPrevMonth = React.useMemo(
    () => participantSales.filter((s) => new Date(s.created_at) >= prevMonthStart && new Date(s.created_at) < monthStart),
    [participantSales, prevMonthStart, monthStart],
  )

  const salesInRankingWindow = React.useMemo(
    () => sales.filter((s) => new Date(s.sale_date) >= rankingWindowStart),
    [sales, rankingWindowStart],
  )
  const salesInPrevRankingWindow = React.useMemo(
    () => sales.filter((s) => new Date(s.sale_date) >= rankingWindowPrevStart && new Date(s.sale_date) < rankingWindowStart),
    [sales, rankingWindowPrevStart, rankingWindowStart],
  )
  const congressSalesInRankingWindow = React.useMemo(
    () => participantSales.filter((s) => new Date(s.created_at) >= rankingWindowStart),
    [participantSales, rankingWindowStart],
  )
  const congressSalesInPrevRankingWindow = React.useMemo(
    () =>
      participantSales.filter(
        (s) => new Date(s.created_at) >= rankingWindowPrevStart && new Date(s.created_at) < rankingWindowStart,
      ),
    [participantSales, rankingWindowPrevStart, rankingWindowStart],
  )

  const paymentsThisMonth = React.useMemo(
    () => allPayments.filter((p) => new Date(p.paid_at) >= monthStart),
    [allPayments, monthStart],
  )
  const paymentsPrevMonth = React.useMemo(
    () => allPayments.filter((p) => new Date(p.paid_at) >= prevMonthStart && new Date(p.paid_at) < monthStart),
    [allPayments, prevMonthStart, monthStart],
  )

  const salesStat: StatTrend = React.useMemo(() => {
    const currentGeneral = salesThisMonth.reduce((sum, s) => sum + netAmount(s), 0)
    const currentCongress = congressSalesThisMonth.reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0)
    const prevGeneral = salesPrevMonth.reduce((sum, s) => sum + netAmount(s), 0)
    const prevCongress = congressSalesPrevMonth.reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0)
    const current = currentGeneral + currentCongress
    const previous = prevGeneral + prevCongress
    const items = [
      ...sales.map((s) => ({ date: new Date(s.sale_date), amount: netAmount(s) })),
      ...participantSales.map((s) => ({ date: new Date(s.created_at), amount: Number(s.quantity) * Number(s.unit_price) })),
    ]
    return { current, previous, deltaPct: pctDelta(current, previous), sparkline: weeklyBuckets(items, 8) }
  }, [salesThisMonth, salesPrevMonth, congressSalesThisMonth, congressSalesPrevMonth, sales, participantSales])

  const collectionsStat: StatTrend = React.useMemo(() => {
    const current = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0)
    const previous = paymentsPrevMonth.reduce((sum, p) => sum + Number(p.amount), 0)
    const items = allPayments.map((p) => ({ date: new Date(p.paid_at), amount: Number(p.amount) }))
    return { current, previous, deltaPct: pctDelta(current, previous), sparkline: weeklyBuckets(items, 8) }
  }, [paymentsThisMonth, paymentsPrevMonth, allPayments])

  const cariLedger = React.useMemo(() => computeCariLedger(allPayments, sales, invoices), [allPayments, sales, invoices])
  const cariTotals = React.useMemo(() => computeCariTotals(customers, cariLedger), [customers, cariLedger])
  const cariSparkline = React.useMemo(() => {
    const items = [
      ...sales.map((s) => ({ date: new Date(s.sale_date), amount: s.type === 'sale' ? netAmount(s) : netAmount(s) })),
      ...invoices.map((inv) => ({ date: new Date(inv.issue_date), amount: Number(inv.amount) })),
      ...allPayments.map((p) => ({ date: new Date(p.paid_at), amount: -Number(p.amount) })),
    ]
    return weeklyBuckets(items, 8)
  }, [sales, invoices, allPayments])

  const activeSalesRepCount = React.useMemo(() => salesReps.filter((r) => r.is_active).length, [salesReps])
  const productCount = products.length

  const topProducts = React.useMemo(() => {
    function group(generalItems: typeof salesThisMonth, congressItems: typeof congressSalesThisMonth) {
      const byProduct = new Map<string, { qty: number; revenue: number }>()
      for (const s of generalItems) {
        const cur = byProduct.get(s.product_name) ?? { qty: 0, revenue: 0 }
        const sign = s.type === 'return' ? -1 : 1
        cur.qty += sign * s.quantity
        cur.revenue += sign * s.quantity * Number(s.unit_price)
        byProduct.set(s.product_name, cur)
      }
      for (const s of congressItems) {
        const cur = byProduct.get(s.product_name) ?? { qty: 0, revenue: 0 }
        cur.qty += s.quantity
        cur.revenue += s.quantity * Number(s.unit_price)
        byProduct.set(s.product_name, cur)
      }
      return byProduct
    }
    const current = group(salesInRankingWindow, congressSalesInRankingWindow)
    const previous = group(salesInPrevRankingWindow, congressSalesInPrevRankingWindow)
    const productByName = new Map(products.map((p) => [p.name, p]))
    return Array.from(current.entries())
      .map(([name, v]) => ({
        id: name,
        name,
        qty: v.qty,
        revenue: v.revenue,
        deltaPct: pctDelta(v.revenue, previous.get(name)?.revenue ?? 0),
        imageUrl: productByName.get(name)?.image_url ?? null,
      }))
      .filter((p) => p.qty > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [salesInRankingWindow, salesInPrevRankingWindow, congressSalesInRankingWindow, congressSalesInPrevRankingWindow, products])

  // "Satış Temsilcisi Raporu" (/doktor-ziyaretleri) sayfasındaki "Bu Ay Ciro"
  // ile AYNI tanım kullanılıyor: temsilciye bağlı TAHSİLATLAR (satış değil),
  // bu ay içinde toplanmış — iki yerde farklı rakam görünmesin diye.
  const repMonthlyReport = React.useMemo<RankedItem[]>(() => {
    function group(payments: typeof paymentsThisMonth) {
      const byRep = new Map<string, number>()
      for (const p of payments) {
        if (!p.sales_rep_id) continue
        byRep.set(p.sales_rep_id, (byRep.get(p.sales_rep_id) ?? 0) + Number(p.amount))
      }
      return byRep
    }
    const current = group(paymentsThisMonth)
    const previous = group(paymentsPrevMonth)
    return salesReps
      .filter((r) => r.is_active)
      .map((rep) => ({
        id: rep.id,
        name: rep.name,
        revenue: current.get(rep.id) ?? 0,
        deltaPct: pctDelta(current.get(rep.id) ?? 0, previous.get(rep.id) ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [salesReps, paymentsThisMonth, paymentsPrevMonth])

  const collectionTarget = React.useMemo(() => {
    const exactTarget = budgetTargets.find((t) => t.month === currentMonth)
    // Bu ay için hedef girilmemişse panel boş görünmesin diye, o yıl içinde
    // girilmiş EN YAKIN gerçek hedef gösteriliyor (uydurma rakam değil) —
    // hangi aya ait olduğu net şekilde etiketleniyor.
    const fallbackTarget =
      !exactTarget && budgetTargets.length > 0
        ? [...budgetTargets].sort((a, b) => Math.abs(a.month - currentMonth) - Math.abs(b.month - currentMonth))[0]
        : null
    const target = exactTarget ?? fallbackTarget
    const targetRevenue = target ? Number(target.target_revenue) : null
    const collected = collectionsStat.current
    const percent = targetRevenue ? Math.min(100, (collected / targetRevenue) * 100) : null
    const remaining = targetRevenue != null ? Math.max(0, targetRevenue - collected) : null
    return {
      targetRevenue,
      collected,
      percent,
      remaining,
      targetMonth: target?.month ?? null,
      isFallbackMonth: !exactTarget && !!fallbackTarget,
    }
  }, [budgetTargets, currentMonth, collectionsStat])

  const notifications = React.useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = []
    for (const d of alerts.doctorsWithBalance.slice(0, 3)) {
      items.push({
        key: `balance-${d.id}`,
        icon: Wallet,
        tone: 'destructive',
        title: `${d.full_name} için açık bakiye var`,
        subtitle: 'Cari hesapta vadesi geçen bakiye',
        to: `/musteriler/${d.id}`,
        createdAt: null,
      })
    }
    for (const p of alerts.criticalStock.slice(0, 3)) {
      items.push({
        key: `stock-${p.id}`,
        icon: AlertTriangle,
        tone: 'destructive',
        title: `Düşük stok uyarısı: ${p.name}`,
        subtitle: `Mevcut stok: ${p.current_quantity} ${p.unit}`,
        to: '/stok',
        createdAt: p.created_at,
        imageUrl: p.image_url,
      })
    }
    for (const p of alerts.expiringProducts.slice(0, 2)) {
      items.push({
        key: `expiry-${p.id}`,
        icon: ClipboardX,
        tone: 'destructive',
        title: `${p.name} son kullanım tarihi yaklaşıyor`,
        subtitle: 'Stok listesinden kontrol edin',
        to: '/stok',
        createdAt: p.created_at,
        imageUrl: p.image_url,
      })
    }
    for (const c of alerts.upcomingCongresses.slice(0, 2)) {
      items.push({
        key: `congress-${c.id}`,
        icon: Presentation,
        tone: 'primary',
        title: `${c.name} kongresi yaklaşıyor`,
        subtitle: c.start_date ? `Başlangıç: ${c.start_date}` : 'Tarih belirtilmedi',
        to: `/kongreler/${c.id}`,
        createdAt: c.created_at,
        imageUrl: c.image_url,
      })
    }
    for (const c of alerts.incompleteChecklists.slice(0, 2)) {
      items.push({
        key: `checklist-${c.id}`,
        icon: ClipboardList,
        tone: 'destructive',
        title: `${c.name} kontrol listesi eksik`,
        subtitle: 'Kongre kontrol listesini tamamlayın',
        to: `/kongreler/${c.id}`,
        createdAt: c.created_at,
        imageUrl: c.image_url,
      })
    }
    for (const r of alerts.dueReminders.slice(0, 3)) {
      items.push({
        key: `reminder-${r.id}`,
        icon: BellRing,
        tone: 'destructive',
        title: r.title,
        subtitle: 'Hatırlatma vadesi geldi',
        to: '/hatirlatmalar',
        createdAt: r.created_at,
      })
    }
    for (const p of alerts.pendingProducts.slice(0, 2)) {
      items.push({
        key: `pending-${p.id}`,
        icon: PackageOpen,
        tone: 'destructive',
        title: `${p.customers?.full_name ?? 'Doktor'} için eksik ürün`,
        subtitle: p.product_name,
        to: `/musteriler/${p.customer_id}`,
        createdAt: p.created_at,
      })
    }
    return items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 6)
  }, [alerts])

  const salesTimeline = React.useMemo(
    () => [
      ...sales.map((s) => ({ date: new Date(s.sale_date), amount: netAmount(s) })),
      ...participantSales.map((s) => ({ date: new Date(s.created_at), amount: Number(s.quantity) * Number(s.unit_price) })),
    ],
    [sales, participantSales],
  )

  return {
    isLoading,
    salesStat,
    collectionsStat,
    cariTotals,
    cariSparkline,
    activeSalesRepCount,
    productCount,
    topProducts,
    repMonthlyReport,
    collectionTarget,
    notifications,
    salesTimeline,
    congresses,
  }
}
