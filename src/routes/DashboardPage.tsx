import * as React from 'react'
import { Link } from 'react-router-dom'
import { format, startOfMonth, startOfDay, subMonths, differenceInCalendarDays } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import {
  Wallet,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  Save,
  X,
  Coins,
  ArrowLeftRight,
  Presentation,
  MapPin,
  Boxes,
  ShoppingCart,
  PackagePlus,
  ListPlus,
  CalendarPlus,
  UserPlus,
  FileText,
  BarChart3,
  PieChart,
  Landmark,
  CalendarClock,
  AlertTriangle,
  Wrench,
  Trophy,
  UserRound,
  History,
  Undo2,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { usePayments } from '@/features/payments/hooks'
import { useProducts } from '@/features/stock/hooks'
import { useExchangeRates } from '@/features/exchangeRates/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useAllParticipantProductSales } from '@/features/congresses/hooks'
import { useWorkshops } from '@/features/workshops/hooks'
import { useSales } from '@/features/sales/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { RevenueChart, type RevenueChartPoint } from '@/components/charts/RevenueChart'
import type { RegionChartPoint } from '@/components/charts/RegionChart'
import { TurkeyMap } from '@/components/charts/TurkeyMap'
import { StockStatusChart, type StockStatusPoint } from '@/components/charts/StockStatusChart'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { tr } from '@/i18n/tr'

const statTone = {
  gold: 'bg-primary/15 text-primary',
  purple: 'bg-[oklch(0.5_0.18_300)]/15 text-[oklch(0.55_0.2_300)]',
  green: 'bg-[oklch(0.55_0.15_155)]/15 text-[oklch(0.55_0.15_155)]',
  blue: 'bg-[oklch(0.55_0.18_250)]/15 text-[oklch(0.55_0.18_250)]',
} as const

function StatCardV2({
  icon: Icon,
  tone,
  label,
  value,
  sublabel,
  deltaPct,
  delayMs,
  to,
}: {
  icon: React.ElementType
  tone: keyof typeof statTone
  label: string
  value: string
  sublabel: string
  deltaPct: number | null
  delayMs: number
  to: string
}) {
  return (
    <Link to={to} className="block">
      <Card
        className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 transition-all hover:-translate-y-0.5 hover:shadow-md"
        style={{ animationDelay: `${delayMs}ms` }}
      >
      <CardContent className="flex items-start gap-3 pt-6">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', statTone[tone])}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{sublabel}</span>
            {deltaPct != null && (
              <span
                className={cn(
                  'flex items-center gap-0.5 font-medium',
                  deltaPct >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {deltaPct >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(deltaPct).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </CardContent>
      </Card>
    </Link>
  )
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: React.ElementType
  label: string
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
        <Icon className="size-5" />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = React.useState(0)
  React.useEffect(() => {
    let raf: number
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(value * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return display
}

type WidgetId =
  | 'stats'
  | 'extra_stats'
  | 'quick_actions'
  | 'stock_status'
  | 'upcoming_congresses'
  | 'upcoming_workshops'
  | 'exchange_rates'
  | 'revenue_chart'
  | 'alerts'
  | 'recent_transactions'
  | 'congress_prices'
  | 'region_sales'
  | 'top_products'
  | 'top_doctors'
  | 'sales_rep_performance'

interface LayoutItem {
  id: WidgetId
  visible: boolean
}

const defaultLayout: LayoutItem[] = [
  { id: 'stats', visible: true },
  { id: 'extra_stats', visible: true },
  { id: 'quick_actions', visible: true },
  { id: 'stock_status', visible: true },
  { id: 'upcoming_congresses', visible: true },
  { id: 'upcoming_workshops', visible: true },
  { id: 'exchange_rates', visible: true },
  { id: 'revenue_chart', visible: true },
  { id: 'region_sales', visible: true },
  { id: 'top_products', visible: true },
  { id: 'top_doctors', visible: true },
  { id: 'sales_rep_performance', visible: true },
  { id: 'congress_prices', visible: true },
  { id: 'recent_transactions', visible: true },
  { id: 'alerts', visible: true },
]

const widgetLabels: Record<WidgetId, string> = {
  stats: 'Özet Kartları',
  extra_stats: 'Bugünkü Satış / Tahsil Edilecek / Kritik Stok',
  quick_actions: 'Hızlı Erişim',
  stock_status: 'Stok Durumu',
  upcoming_congresses: 'Yaklaşan Kongreler',
  upcoming_workshops: 'Yaklaşan Workshoplar',
  exchange_rates: 'Döviz Kurları',
  revenue_chart: 'Tahsilat Trendi',
  region_sales: 'Satış Haritası (İllere Göre)',
  top_products: 'En Çok Satan Ürünler',
  top_doctors: 'En Çok Alış Yapan Doktorlar',
  sales_rep_performance: 'Satış Temsilcisi Performansı',
  congress_prices: 'Kongre Paket Fiyatları',
  recent_transactions: 'Son İşlemler',
  alerts: 'Son Tahsilatlar',
}

export function DashboardPage() {
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const { data: products = [] } = useProducts('')
  const { data: monthPayments = [] } = usePayments({ from: startOfMonth(new Date()).toISOString() })
  const sixMonthsAgo = React.useMemo(() => startOfMonth(subMonths(new Date(), 5)), [])
  const { data: recentPayments = [] } = usePayments({ from: sixMonthsAgo.toISOString() })
  const { data: exchangeRates = [], isLoading: ratesLoading } = useExchangeRates()
  const { data: congresses = [] } = useCongresses()
  const { data: workshops = [] } = useWorkshops()
  const { data: participantSales = [] } = useAllParticipantProductSales()
  const { data: sales = [] } = useSales()
  const { data: doctors = [] } = useCustomers('')
  const { data: allPayments = [] } = usePayments({})
  const [convertAmount, setConvertAmount] = React.useState('100')
  const [fromCurrency, setFromCurrency] = React.useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [toCurrency, setToCurrency] = React.useState<'TRY' | 'USD' | 'EUR'>('USD')

  const rateToTry = React.useMemo(() => {
    const map: Record<'TRY' | 'USD' | 'EUR', number> = { TRY: 1, USD: 0, EUR: 0 }
    for (const r of exchangeRates) map[r.currency] = r.rate
    return map
  }, [exchangeRates])

  const convertedAmount = React.useMemo(() => {
    const amount = Number(convertAmount) || 0
    const fromRate = rateToTry[fromCurrency]
    const toRate = rateToTry[toCurrency]
    if (!fromRate || !toRate) return 0
    return (amount * fromRate) / toRate
  }, [convertAmount, fromCurrency, toCurrency, rateToTry])

  const convertAmountDisplay = convertAmount ? Number(convertAmount).toLocaleString('tr-TR') : ''

  function handleConvertAmountChange(raw: string) {
    setConvertAmount(raw.replace(/\D/g, ''))
  }

  const { data: savedLayout } = useAppSetting<LayoutItem[]>('dashboard_layout')
  const saveLayoutMutation = useSaveAppSetting<LayoutItem[]>('dashboard_layout')
  const [editMode, setEditMode] = React.useState(false)
  const [draftLayout, setDraftLayout] = React.useState<LayoutItem[] | null>(null)
  const dragIndexRef = React.useRef<number | null>(null)

  const validWidgetIds = React.useMemo(() => new Set(defaultLayout.map((i) => i.id)), [])

  function sanitizeLayout(input: LayoutItem[]): LayoutItem[] {
    const known = input.filter((item) => validWidgetIds.has(item.id))
    const presentIds = new Set(known.map((item) => item.id))
    const missing = defaultLayout.filter((item) => !presentIds.has(item.id))
    return [...known, ...missing]
  }

  const layout = sanitizeLayout(draftLayout ?? savedLayout ?? defaultLayout)

  function startEditing() {
    setDraftLayout(layout)
    setEditMode(true)
  }

  function cancelEditing() {
    setDraftLayout(null)
    setEditMode(false)
  }

  async function saveLayout() {
    if (draftLayout) await saveLayoutMutation.mutateAsync(draftLayout)
    setEditMode(false)
  }

  function toggleVisible(id: WidgetId) {
    setDraftLayout((prev) => (prev ?? layout).map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)))
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndexRef.current
    dragIndexRef.current = null
    if (from === null || from === targetIndex) return
    setDraftLayout((prev) => {
      const list = [...(prev ?? layout)]
      const [moved] = list.splice(from, 1)
      list.splice(targetIndex, 0, moved)
      return list
    })
  }

  const monthTotal = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const lastPayments = recentPayments.slice(0, 6)

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const prevMonthStart = React.useMemo(() => startOfMonth(subMonths(new Date(), 1)), [])
  const prevMonthPayments = recentPayments.filter(
    (p) => new Date(p.paid_at) >= prevMonthStart && new Date(p.paid_at) < monthStart,
  )
  const prevMonthTotal = prevMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const congressSalesThisMonth = participantSales.filter((s) => new Date(s.created_at) >= monthStart)
  const congressSalesPrevMonth = participantSales.filter(
    (s) => new Date(s.created_at) >= prevMonthStart && new Date(s.created_at) < monthStart,
  )
  const congressSalesTotal = congressSalesThisMonth.reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0)
  const congressSalesPrevTotal = congressSalesPrevMonth.reduce(
    (sum, s) => sum + Number(s.quantity) * Number(s.unit_price),
    0,
  )

  const generalSalesThisMonth = sales.filter((s) => new Date(s.sale_date) >= monthStart)
  const generalSalesPrevMonth = sales.filter(
    (s) => new Date(s.sale_date) >= prevMonthStart && new Date(s.sale_date) < monthStart,
  )
  const netAmount = (s: (typeof sales)[number]) =>
    (s.type === 'return' ? -1 : 1) * s.quantity * Number(s.unit_price)
  const generalSalesTotal = generalSalesThisMonth.reduce((sum, s) => sum + netAmount(s), 0)
  const generalSalesPrevTotal = generalSalesPrevMonth.reduce((sum, s) => sum + netAmount(s), 0)

  const salesTotal = congressSalesTotal + generalSalesTotal
  const salesPrevTotal = congressSalesPrevTotal + generalSalesPrevTotal

  const upcomingCongresses = congresses.filter((c) => c.start_date && new Date(c.start_date) >= new Date())

  const todayStart = React.useMemo(() => startOfDay(new Date()), [])
  const todayCongressSales = participantSales.filter((s) => new Date(s.created_at) >= todayStart)
  const todayGeneralSales = sales.filter((s) => new Date(s.sale_date) >= todayStart)
  const todaySalesTotal =
    todayCongressSales.reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0) +
    todayGeneralSales.reduce((sum, s) => sum + netAmount(s), 0)

  const paidByCustomer = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allPayments) map.set(p.customer_id, (map.get(p.customer_id) ?? 0) + Number(p.amount))
    return map
  }, [allPayments])
  const receivablesTotal = doctors.reduce((sum, d) => {
    if (d.total_debt == null) return sum
    const balance = Number(d.total_debt) - (paidByCustomer.get(d.id) ?? 0)
    return sum + Math.max(0, balance)
  }, 0)

  const criticalStockCount = products.filter((p) => p.current_quantity <= p.critical_stock_threshold).length

  const topProducts = React.useMemo<RevenueChartPoint[]>(() => {
    const map = new Map<string, number>()
    for (const s of sales) map.set(s.product_name, (map.get(s.product_name) ?? 0) + netAmount(s))
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [sales])

  const topDoctors = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const name = s.customers?.full_name ?? 'Bilinmeyen'
      map.set(name, (map.get(name) ?? 0) + netAmount(s))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [sales])

  const repPerformance = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const name = s.sales_reps?.name ?? 'Belirtilmemiş'
      map.set(name, (map.get(name) ?? 0) + netAmount(s))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [sales])

  const recentTransactions = React.useMemo(() => {
    const fromSales = sales.slice(0, 8).map((s) => ({
      id: `sale-${s.id}`,
      date: s.sale_date,
      label: `${s.customers?.full_name ?? 'Doktor'} — ${s.product_name}`,
      amount: netAmount(s),
      kind: s.type === 'sale' ? ('sale' as const) : ('return' as const),
    }))
    const fromPayments = recentPayments.slice(0, 8).map((p) => ({
      id: `payment-${p.id}`,
      date: p.paid_at,
      label: p.customers?.full_name ?? 'Doktor',
      amount: Number(p.amount),
      kind: 'payment' as const,
    }))
    return [...fromSales, ...fromPayments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  }, [sales, recentPayments])

  const monthTotalAnimated = useCountUp(monthTotal)
  const productCountAnimated = useCountUp(products.length)
  const upcomingCongressAnimated = useCountUp(upcomingCongresses.length)
  const salesTotalAnimated = useCountUp(salesTotal)

  const revenueData = React.useMemo<RevenueChartPoint[]>(() => {
    const buckets = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      buckets.set(format(d, 'yyyy-MM'), 0)
    }
    for (const payment of recentPayments) {
      const key = format(new Date(payment.paid_at), 'yyyy-MM')
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount))
    }
    return Array.from(buckets.entries()).map(([key, total]) => ({
      label: format(new Date(`${key}-01`), 'MMM', { locale: trLocale }),
      total,
    }))
  }, [recentPayments])

  const regionSalesData = React.useMemo<RegionChartPoint[]>(() => {
    const byProvince = new Map<string, number>()
    for (const payment of recentPayments) {
      const province = payment.customers?.province
      if (!province) continue
      byProvince.set(province, (byProvince.get(province) ?? 0) + Number(payment.amount))
    }
    return Array.from(byProvince.entries())
      .map(([province, total]) => ({ province, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [recentPayments])

  function renderWidget(id: WidgetId, delayMs: number) {
    const delayStyle = { animationDelay: `${delayMs}ms` }
    if (id === 'stats') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardV2
            icon={Boxes}
            tone="gold"
            label="Toplam Stok"
            value={Math.round(productCountAnimated).toLocaleString('tr-TR')}
            sublabel="Ürün çeşidi"
            deltaPct={null}
            delayMs={delayMs}
            to="/stok"
          />
          <StatCardV2
            icon={Presentation}
            tone="purple"
            label="Kongre Sayısı"
            value={Math.round(upcomingCongressAnimated).toLocaleString('tr-TR')}
            sublabel="Yaklaşan kongre"
            deltaPct={null}
            delayMs={delayMs + 80}
            to="/kongreler"
          />
          <StatCardV2
            icon={Wallet}
            tone="green"
            label="Tahsilat Tutarı"
            value={monthTotalAnimated.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Bu ay tahsilat"
            deltaPct={pctDelta(monthTotal, prevMonthTotal)}
            delayMs={delayMs + 160}
            to="/tahsilatlar"
          />
          <StatCardV2
            icon={ShoppingCart}
            tone="blue"
            label="Satış Tutarı"
            value={salesTotalAnimated.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Bu ay ürün satışı"
            deltaPct={pctDelta(salesTotal, salesPrevTotal)}
            delayMs={delayMs + 240}
            to="/satislar"
          />
        </div>
      )
    }

    if (id === 'extra_stats') {
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCardV2
            icon={ShoppingCart}
            tone="blue"
            label="Bugünkü Satış"
            value={todaySalesTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Bugün yapılan satış"
            deltaPct={null}
            delayMs={delayMs}
            to="/satislar"
          />
          <StatCardV2
            icon={CalendarClock}
            tone="purple"
            label="Tahsil Edilecek"
            value={receivablesTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Açık bakiyeli doktorlar"
            deltaPct={null}
            delayMs={delayMs + 80}
            to="/cari-hesap"
          />
          <StatCardV2
            icon={AlertTriangle}
            tone="gold"
            label="Kritik Stok"
            value={criticalStockCount.toLocaleString('tr-TR')}
            sublabel="Ürün çeşidi"
            deltaPct={null}
            delayMs={delayMs + 160}
            to="/stok"
          />
        </div>
      )
    }

    if (id === 'quick_actions') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader>
            <CardTitle className="text-base">Hızlı Erişim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickAction to="/stok" icon={PackagePlus} label="Stok Ekle" />
              <QuickAction to="/stok" icon={ListPlus} label="Ürün Listele" />
              <QuickAction to="/kongreler" icon={CalendarPlus} label="Kongre Ekle" />
              <QuickAction to="/tahsilatlar" icon={Wallet} label="Tahsilat Ekle" />
              <QuickAction to="/satislar" icon={ShoppingCart} label="Satış Yap" />
              <QuickAction to="/satislar" icon={FileText} label="Fatura Kes" />
              <QuickAction to="/musteriler" icon={UserPlus} label="Doktor Ekle" />
              <QuickAction to="/cari-hesap" icon={Landmark} label="Cari Hesap" />
              <QuickAction to="/satislar" icon={BarChart3} label="Raporla" />
            </div>
          </CardContent>
        </Card>
      )
    }

    if (id === 'stock_status') {
      const inStock = products.filter((p) => p.current_quantity > p.critical_stock_threshold).length
      const lowStock = products.filter(
        (p) => p.current_quantity > 0 && p.current_quantity <= p.critical_stock_threshold,
      ).length
      const outOfStock = products.filter((p) => p.current_quantity <= 0).length
      const stockStatusData: StockStatusPoint[] = [
        { key: 'in_stock', label: 'Stokta', value: inStock, color: 'var(--color-success)' },
        { key: 'low_stock', label: 'Azalan Stok', value: lowStock, color: 'var(--color-warning)' },
        { key: 'out_of_stock', label: 'Stokta Yok', value: outOfStock, color: 'var(--color-destructive)' },
      ]

      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="size-4 text-primary" /> Stok Durumu
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/stok">
                Tüm Stoklar <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid items-center gap-4 sm:grid-cols-2">
              <StockStatusChart data={stockStatusData} />
              <div className="grid gap-2">
                {stockStatusData.map((point) => (
                  <div key={point.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: point.color }} />
                      {point.label}
                    </span>
                    <span className="font-semibold tabular-nums">{point.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (id === 'upcoming_congresses') {
      const upcoming = congresses
        .filter((c) => c.start_date && new Date(c.start_date) >= new Date())
        .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
        .slice(0, 4)

      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Presentation className="size-4 text-primary" /> Yaklaşan Kongreler
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/kongreler">
                Tüm Kongreler <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Yaklaşan kongre yok</p>}
            {upcoming.map((c) => {
              const daysLeft = c.start_date ? differenceInCalendarDays(new Date(c.start_date), new Date()) : null
              return (
                <Link
                  key={c.id}
                  to={`/kongreler/${c.id}`}
                  className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent"
                >
                  {c.image_url ? (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted p-1">
                      <img src={c.image_url} alt={c.name} className="size-full object-contain" />
                    </span>
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                      <Presentation className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.start_date && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.start_date), 'd MMMM yyyy', { locale: trLocale })}
                      </p>
                    )}
                  </div>
                  {daysLeft != null && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary shrink-0">
                      {daysLeft} Gün
                    </Badge>
                  )}
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )
    }

    if (id === 'upcoming_workshops') {
      const upcoming = workshops
        .filter((w) => w.workshop_date && new Date(w.workshop_date) >= new Date())
        .sort((a, b) => (a.workshop_date ?? '').localeCompare(b.workshop_date ?? ''))
        .slice(0, 4)

      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4 text-primary" /> Yaklaşan Workshoplar
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/workshoplar">
                Tüm Workshoplar <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Yaklaşan workshop yok</p>}
            {upcoming.map((w) => {
              const daysLeft = w.workshop_date ? differenceInCalendarDays(new Date(w.workshop_date), new Date()) : null
              return (
                <Link
                  key={w.id}
                  to={`/workshoplar/${w.id}`}
                  className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Wrench className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{w.name}</p>
                    {w.workshop_date && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(w.workshop_date), 'd MMMM yyyy', { locale: trLocale })}
                      </p>
                    )}
                  </div>
                  {daysLeft != null && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary shrink-0">
                      {daysLeft} Gün
                    </Badge>
                  )}
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )
    }

    if (id === 'exchange_rates') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="size-4 text-primary" /> Günlük Döviz Kurları
            </CardTitle>
            {exchangeRates[0]?.date && (
              <span className="text-xs text-muted-foreground">{exchangeRates[0].date}</span>
            )}
          </CardHeader>
          <CardContent>
            {ratesLoading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            ) : exchangeRates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kur bilgisi alınamadı</p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-4">
                  {exchangeRates.map((r) => (
                    <div key={r.currency} className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground">{r.currency}/TRY</p>
                      <p className="text-xl font-semibold tabular-nums">
                        {r.rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border bg-muted/30 p-3">
                  <Label htmlFor="convert-amount" className="text-xs font-medium text-muted-foreground">
                    Döviz Çevir
                  </Label>
                  <div className="mt-1.5 flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        id="convert-amount"
                        type="text"
                        inputMode="numeric"
                        value={convertAmountDisplay}
                        onChange={(e) => handleConvertAmountChange(e.target.value)}
                      />
                    </div>
                    <Select value={fromCurrency} onValueChange={(v) => setFromCurrency(v as typeof fromCurrency)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 shrink-0"
                      onClick={() => {
                        setFromCurrency(toCurrency)
                        setToCurrency(fromCurrency)
                      }}
                    >
                      <ArrowLeftRight className="size-4" />
                    </Button>
                    <Select value={toCurrency} onValueChange={(v) => setToCurrency(v as typeof toCurrency)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-3 text-lg font-semibold tabular-nums">
                    {(Number(convertAmount) || 0).toLocaleString('tr-TR')} {fromCurrency} ={' '}
                    {convertedAmount.toLocaleString('tr-TR', { style: 'currency', currency: toCurrency })}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )
    }

    if (id === 'revenue_chart') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" /> Son 6 Ay Tahsilat Trendi
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tahsilatlar">
                Tahsilatlara git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>
      )
    }

    if (id === 'region_sales') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" /> Satış Haritası — İllere Göre (Son 6 Ay)
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/musteriler">
                Doktorlara git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {regionSalesData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz il bilgisi girilmiş doktora ait tahsilat yok — Doktorlar'dan il bilgisi ekleyin.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <TurkeyMap data={regionSalesData} />
                </div>
                <div className="grid content-start gap-1.5">
                  {regionSalesData.map((r, i) => (
                    <div key={r.province} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                          {i + 1}
                        </span>
                        {r.province}
                      </span>
                      <span className="text-muted-foreground">
                        {r.total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    if (id === 'top_products') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" /> En Çok Satan Ürünler
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/satislar">
                Raporlara git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz satış verisi yok</p>
            ) : (
              <RevenueChart data={topProducts} />
            )}
          </CardContent>
        </Card>
      )
    }

    if (id === 'top_doctors') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" /> En Çok Alış Yapan Doktorlar
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/musteriler">
                Doktorlara git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {topDoctors.length === 0 && <p className="text-sm text-muted-foreground">Henüz satış verisi yok</p>}
            {topDoctors.map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{d.name}</span>
                <Badge variant="outline">
                  {d.total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )
    }

    if (id === 'sales_rep_performance') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" /> Satış Temsilcisi Performansı
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/doktor-ziyaretleri">
                Ziyaretlere git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {repPerformance.length === 0 && <p className="text-sm text-muted-foreground">Henüz satış verisi yok</p>}
            {repPerformance.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <Badge variant="outline">
                  {r.total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )
    }

    if (id === 'recent_transactions') {
      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" /> Son İşlemler
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {recentTransactions.length === 0 && <p className="text-sm text-muted-foreground">Henüz işlem yok</p>}
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="flex items-center gap-2">
                  {t.kind === 'payment' && <Wallet className="size-3.5 text-success" />}
                  {t.kind === 'sale' && <ShoppingCart className="size-3.5 text-primary" />}
                  {t.kind === 'return' && <Undo2 className="size-3.5 text-destructive" />}
                  <span>
                    <span className="font-medium">{t.label}</span>{' '}
                    <span className="text-muted-foreground">
                      — {format(new Date(t.date), 'd MMM yyyy', { locale: trLocale })}
                    </span>
                  </span>
                </span>
                <span className="font-medium">
                  {t.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )
    }

    if (id === 'congress_prices') {
      const pricedCongresses = congresses
        .filter((c) => c.single_person_price != null || c.two_person_price != null)
        .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))

      return (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Presentation className="size-4 text-primary" /> Kongre Paket Fiyatları
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/kongreler">
                Kongrelere git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pricedCongresses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Henüz paket fiyatı girilmiş kongre yok — Kongreler'den bir kongreyi düzenleyip fiyat ekleyebilirsiniz.
              </p>
            )}
            {pricedCongresses.map((c) => (
              <Link
                key={c.id}
                to={`/kongreler/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  {c.start_date && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.start_date), 'd MMMM yyyy', { locale: trLocale })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.single_person_price != null && (
                    <Badge variant="outline">
                      Tek Kişi: {Number(c.single_person_price).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </Badge>
                  )}
                  {c.two_person_price != null && (
                    <Badge variant="outline">
                      2 Kişi: {Number(c.two_person_price).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )
    }

    return (
      <div>
        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700" style={delayStyle}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Son Tahsilatlar</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tahsilatlar">
                Tahsilatlara git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {lastPayments.length === 0 && <p className="text-sm text-muted-foreground">Tahsilat yok</p>}
            {lastPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{p.customers?.full_name ?? '—'}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(p.paid_at), 'd MMM yyyy', { locale: trLocale })}
                  </p>
                </div>
                <Badge variant="outline">
                  {Number(p.amount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            {`Hoş geldiniz${staff?.full_name ? ', ' + staff.full_name : ''}`}
            {staff && (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {tr.staffRole[staff.role]}
              </Badge>
            )}
          </span>
        }
        description={format(new Date(), 'd MMMM yyyy, EEEE', { locale: trLocale })}
        actions={
          <div className="flex gap-2">
            {isAdmin && !editMode && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="size-3.5" /> Paneli Düzenle
              </Button>
            )}
            {isAdmin && editMode && (
              <>
                <Button variant="outline" size="sm" onClick={cancelEditing}>
                  <X className="size-3.5" /> Vazgeç
                </Button>
                <Button size="sm" onClick={saveLayout} disabled={saveLayoutMutation.isPending}>
                  <Save className="size-3.5" /> Kaydet
                </Button>
              </>
            )}
            <CustomerForm />
          </div>
        }
      />

      <div className="grid gap-6">
        {layout.map((item, index) => {
          if (!editMode && !item.visible) return null
          if (!editMode) return <div key={item.id}>{renderWidget(item.id, index * 80)}</div>

          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => (dragIndexRef.current = index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className={cn(
                'rounded-xl border-2 border-dashed p-3 transition-opacity',
                item.visible ? 'border-border' : 'border-border/50 opacity-40',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="flex cursor-grab items-center gap-1.5 text-xs font-medium text-muted-foreground active:cursor-grabbing">
                  <GripVertical className="size-3.5" /> {widgetLabels[item.id]}
                </span>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => toggleVisible(item.id)}>
                  {item.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
              </div>
              {renderWidget(item.id, 0)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
