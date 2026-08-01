import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  startOfDay,
  subMonths,
  subWeeks,
  subYears,
  subDays,
  differenceInCalendarDays,
  isPast,
  isToday,
} from 'date-fns'
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
  LayoutGrid,
  X,
  Coins,
  ArrowLeftRight,
  Presentation,
  MapPin,
  ShoppingCart,
  PackagePlus,
  CalendarPlus,
  UserPlus,
  FileText,
  BarChart3,
  PieChart,
  Landmark,
  AlertTriangle,
  ClipboardX,
  CalendarClock,
  BellRing,
  Trophy,
  Percent,
  FlaskConical,
  Layers,
  Users,
  Clock,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useWeather } from '@/features/weather/hooks'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { usePayments } from '@/features/payments/hooks'
import { useProducts } from '@/features/stock/hooks'
import { useExchangeRates } from '@/features/exchangeRates/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useAllParticipantProductSales } from '@/features/congresses/hooks'
import { useSales } from '@/features/sales/hooks'
import { useAlertsSummary } from '@/features/alerts/useAlertsSummary'
import { useReminders } from '@/features/reminders/hooks'
import { getPaymentDueStatus } from '@/lib/paymentDue'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { RevenueChart, type RevenueChartPoint } from '@/components/charts/RevenueChart'
import type { RegionChartPoint } from '@/components/charts/RegionChart'
import { TurkeyMap } from '@/components/charts/TurkeyMap'
import { StockStatusChart, type StockStatusPoint } from '@/components/charts/StockStatusChart'
import { TopProductsChart } from '@/components/charts/TopProductsChart'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCommissionRules } from '@/features/commissions/hooks'
import { calculateCommissions } from '@/features/commissions/calculateCommissions'
import { useCustomers } from '@/features/customers/hooks'
import { useAllProductLots } from '@/features/stock/hooks'
import { useSampleRequests } from '@/features/samples/hooks'
import { calculateSampleConversion } from '@/features/samples/calculateSampleConversion'
import { getExpiryStatus } from '@/lib/expiry'
import { tr } from '@/i18n/tr'

// Ayrı bir yaprak bileşen: saat her saniye kendi içinde güncelleniyor, bu
// yüzden sadece bu küçük bileşen yeniden render oluyor — tüm Dashboard'ı
// saniyede bir yeniden çizmiyor.
function LiveClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
      <Clock className="size-3.5" />
      {format(now, 'HH:mm:ss')}
    </span>
  )
}

function getWeatherDisplay(code: number): { Icon: React.ElementType; label: string } {
  if (code === 0) return { Icon: Sun, label: 'Açık' }
  if (code === 1 || code === 2) return { Icon: CloudSun, label: 'Parçalı bulutlu' }
  if (code === 3) return { Icon: Cloud, label: 'Kapalı' }
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Sisli' }
  if ([51, 53, 55, 56, 57].includes(code)) return { Icon: CloudDrizzle, label: 'Çisenti' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { Icon: CloudRain, label: 'Yağmurlu' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { Icon: CloudSnow, label: 'Karlı' }
  if ([95, 96, 99].includes(code)) return { Icon: CloudLightning, label: 'Fırtınalı' }
  return { Icon: Cloud, label: 'Bilinmiyor' }
}

function WeatherWidget({ city }: { city: string }) {
  const { data, isLoading, isError } = useWeather(city)

  if (isLoading) {
    return <span className="text-muted-foreground text-xs">Hava durumu yükleniyor...</span>
  }
  if (isError || !data) {
    return <span className="text-muted-foreground text-xs">Hava durumu alınamadı</span>
  }

  const { Icon, label } = getWeatherDisplay(data.weatherCode)
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Icon className="size-3.5" />
      {Math.round(data.temperature)}°C · {data.city} · {label}
    </span>
  )
}

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
  to,
}: {
  icon: React.ElementType
  tone: keyof typeof statTone
  label: string
  value: string
  sublabel: string
  deltaPct: number | null
  to: string
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
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
  | 'quick_actions'
  | 'critical_alerts'
  | 'upcoming_reminders'
  | 'revenue_chart'
  | 'sales_trend'
  | 'top_products'
  | 'stock_status'
  | 'upcoming_congresses'
  | 'exchange_rates'
  | 'region_sales'
  | 'congress_prices'
  | 'recent_activity'
  | 'rep_performance'
  | 'commission_summary'
  | 'sample_conversion'
  | 'lot_expiry'

// Widget genişliği sabit birkaç seçenekten biri (üçte bir/yarım/üçte iki/tam) —
// sürekli piksel bazlı sürükle-boyutlandırma KASITLI OLARAK kullanılmıyor: bir
// önceki denemede (react-grid-layout + WidthProvider) grafiklerin kendi otomatik
// boyutlandırma mekanizmasıyla (Recharts ResponsiveContainer) çakışıp sonsuz bir
// ölçüm döngüsüne girmiş ve uygulamayı kilitlemişti. Burada JS tarafında SÜREKLİ
// bir ölçüm/gözlem YOK — genişlik/yükseklik tarayıcının kendi native CSS `resize`
// mekanizmasıyla (köşeden/kenardan sürükleyerek) değiştiriliyor, biz sadece
// kullanıcı sürüklemeyi BIRAKTIĞINDA (mouse up) son boyutu bir kerelik okuyup
// kaydediyoruz — iki ayrı oto-boyutlandırma sisteminin birbirini beslediği o
// çökme sınıfına kapalı.
interface LayoutItem {
  id: WidgetId
  visible: boolean
  /** px cinsinden — null ise DEFAULT_WIDTH_PCT'teki varsayılan yüzde genişlik kullanılır. */
  width: number | null
  /** px cinsinden — null ise içeriğe göre doğal (auto) yükseklik kullanılır. */
  height: number | null
}

const DEFAULT_WIDTH_PCT: Record<WidgetId, number> = {
  stats: 100,
  revenue_chart: 67,
  upcoming_reminders: 33,
  top_products: 33,
  upcoming_congresses: 33,
  rep_performance: 33,
  quick_actions: 100,
  critical_alerts: 50,
  sales_trend: 50,
  stock_status: 50,
  exchange_rates: 50,
  region_sales: 50,
  congress_prices: 50,
  recent_activity: 100,
  commission_summary: 50,
  sample_conversion: 50,
  lot_expiry: 50,
}

// Varsayılan görünüm sade tutuluyor (Özet + Aylık Satış + Hatırlatmalar + En Çok
// Satan + Yaklaşan Kongreler + Temsilci Performansı + Hızlı İşlemler) — geri kalan
// widget'lar SİLİNMEDİ, sadece varsayılan olarak gizli; "Paneli Düzenle" ile admin
// istediği an geri açıp yerini/boyutunu değiştirebilir.
const defaultLayout: LayoutItem[] = [
  { id: 'stats', visible: true, width: null, height: null },
  { id: 'revenue_chart', visible: true, width: null, height: null },
  { id: 'upcoming_reminders', visible: true, width: null, height: null },
  { id: 'top_products', visible: true, width: null, height: null },
  { id: 'upcoming_congresses', visible: true, width: null, height: null },
  { id: 'rep_performance', visible: true, width: null, height: null },
  { id: 'quick_actions', visible: true, width: null, height: null },
  { id: 'critical_alerts', visible: false, width: null, height: null },
  { id: 'sales_trend', visible: false, width: null, height: null },
  { id: 'stock_status', visible: false, width: null, height: null },
  { id: 'exchange_rates', visible: false, width: null, height: null },
  { id: 'region_sales', visible: false, width: null, height: null },
  { id: 'congress_prices', visible: false, width: null, height: null },
  { id: 'recent_activity', visible: false, width: null, height: null },
  { id: 'commission_summary', visible: false, width: null, height: null },
  { id: 'sample_conversion', visible: false, width: null, height: null },
  { id: 'lot_expiry', visible: false, width: null, height: null },
]

const widgetLabels: Record<WidgetId, string> = {
  stats: 'Özet Kartları',
  quick_actions: 'Hızlı İşlemler',
  critical_alerts: 'Kritik Uyarılar',
  upcoming_reminders: 'Yaklaşan Hatırlatmalar',
  revenue_chart: 'Tahsilat Trendi',
  sales_trend: 'Satış Trendi',
  top_products: 'En Çok Satan Ürünler',
  stock_status: 'Stok Durumu',
  upcoming_congresses: 'Yaklaşan Kongreler',
  exchange_rates: 'Döviz Kurları',
  region_sales: 'Satış Haritası (İllere Göre)',
  congress_prices: 'Kongre Paket Fiyatları',
  recent_activity: 'Son İşlemler',
  rep_performance: 'Temsilci Performansı',
  commission_summary: 'Prim Özeti (Bu Ay)',
  sample_conversion: 'Numune Dönüşüm Oranı',
  lot_expiry: 'Lot / SKT Riski',
}

type ChartPeriod = 'day' | 'week' | 'month' | 'year'

const periodLabels: Record<ChartPeriod, string> = {
  day: 'Gün',
  week: 'Hafta',
  month: 'Ay',
  year: 'Yıl',
}

function buildPeriodBuckets(
  items: { date: Date; amount: number }[],
  period: ChartPeriod,
): RevenueChartPoint[] {
  const now = new Date()
  const buckets = new Map<string, { total: number; label: string }>()

  if (period === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(now, i))
      buckets.set(d.toISOString(), { total: 0, label: format(d, 'd MMM', { locale: trLocale }) })
    }
    for (const item of items) {
      const key = startOfDay(item.date).toISOString()
      if (buckets.has(key)) buckets.get(key)!.total += item.amount
    }
  } else if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const d = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      buckets.set(d.toISOString(), { total: 0, label: format(d, 'd MMM', { locale: trLocale }) })
    }
    for (const item of items) {
      const key = startOfWeek(item.date, { weekStartsOn: 1 }).toISOString()
      if (buckets.has(key)) buckets.get(key)!.total += item.amount
    }
  } else if (period === 'year') {
    for (let i = 4; i >= 0; i--) {
      const d = startOfYear(subYears(now, i))
      buckets.set(d.toISOString(), { total: 0, label: format(d, 'yyyy') })
    }
    for (const item of items) {
      const key = startOfYear(item.date).toISOString()
      if (buckets.has(key)) buckets.get(key)!.total += item.amount
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i))
      buckets.set(d.toISOString(), { total: 0, label: format(d, 'MMM', { locale: trLocale }) })
    }
    for (const item of items) {
      const key = startOfMonth(item.date).toISOString()
      if (buckets.has(key)) buckets.get(key)!.total += item.amount
    }
  }

  return Array.from(buckets.values())
}

function PeriodToggle({ value, onChange }: { value: ChartPeriod; onChange: (p: ChartPeriod) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
      {(Object.keys(periodLabels) as ChartPeriod[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            value === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const { data: products = [] } = useProducts('')
  const { data: monthPayments = [] } = usePayments({ from: startOfMonth(new Date()).toISOString() })
  const { data: recentPayments = [] } = usePayments({})
  const { data: exchangeRates = [], isLoading: ratesLoading } = useExchangeRates()
  const { data: congresses = [] } = useCongresses()
  const { data: participantSales = [] } = useAllParticipantProductSales()
  const { data: sales = [] } = useSales()
  const { data: reminders = [] } = useReminders()
  const alerts = useAlertsSummary()
  const { data: salesReps = [] } = useSalesReps()
  const { data: commissionRules = [] } = useCommissionRules()
  const { data: doctors = [] } = useCustomers('')
  const { data: productLots = [] } = useAllProductLots()
  const { data: sampleRequests = [] } = useSampleRequests()

  const { data: welcomeSetting } = useAppSetting<{ text?: string; city?: string }>('dashboard_welcome')
  const saveWelcomeMutation = useSaveAppSetting<{ text?: string; city?: string }>('dashboard_welcome')
  const welcomeText = welcomeSetting?.text?.trim() || 'Hoş geldiniz'
  const weatherCity = welcomeSetting?.city?.trim() || 'İstanbul'
  const [welcomePopoverOpen, setWelcomePopoverOpen] = React.useState(false)
  const [draftWelcomeText, setDraftWelcomeText] = React.useState('')
  const [draftCity, setDraftCity] = React.useState('')

  function openWelcomeEditor() {
    setDraftWelcomeText(welcomeText)
    setDraftCity(weatherCity)
    setWelcomePopoverOpen(true)
  }

  async function saveWelcomeSettings() {
    await saveWelcomeMutation.mutateAsync({ text: draftWelcomeText.trim(), city: draftCity.trim() })
    setWelcomePopoverOpen(false)
  }

  const repPerformance = React.useMemo(() => {
    const bySalesRep = new Map<string, { name: string; sold: number; collected: number }>()
    for (const rep of salesReps) bySalesRep.set(rep.id, { name: rep.name, sold: 0, collected: 0 })
    for (const s of sales) {
      if (!s.sales_rep_id) continue
      const entry = bySalesRep.get(s.sales_rep_id)
      if (!entry) continue
      entry.sold += (s.type === 'return' ? -1 : 1) * Number(s.quantity) * Number(s.unit_price)
    }
    for (const p of recentPayments) {
      if (!p.sales_rep_id) continue
      const entry = bySalesRep.get(p.sales_rep_id)
      if (!entry) continue
      entry.collected += Number(p.amount)
    }
    return Array.from(bySalesRep.values())
      .filter((r) => r.sold !== 0 || r.collected !== 0)
      .sort((a, b) => b.sold + b.collected - (a.sold + a.collected))
      .slice(0, 5)
  }, [salesReps, sales, recentPayments])

  const commissionSummary = React.useMemo(
    () => calculateCommissions(commissionRules, sales, monthPayments, products, doctors, salesReps, []),
    [commissionRules, sales, monthPayments, products, doctors, salesReps],
  )
  const totalCommissionThisMonth = commissionSummary.reduce((sum, r) => sum + r.netTotal, 0)

  const sampleConversion = React.useMemo(
    () => calculateSampleConversion(sampleRequests, sales),
    [sampleRequests, sales],
  )

  const expiringLotsCount = React.useMemo(
    () => productLots.filter((lot) => lot.quantity > 0 && getExpiryStatus(lot.expiry_date, 90) !== 'ok' && getExpiryStatus(lot.expiry_date, 90) !== null).length,
    [productLots],
  )
  const expiringLotsValue = React.useMemo(
    () =>
      productLots
        .filter((lot) => lot.quantity > 0 && getExpiryStatus(lot.expiry_date, 90) !== 'ok' && getExpiryStatus(lot.expiry_date, 90) !== null)
        .reduce((sum, lot) => {
          const product = products.find((p) => p.id === lot.product_id)
          return sum + lot.quantity * Number(product?.unit_price ?? 0)
        }, 0),
    [productLots, products],
  )
  const [convertAmount, setConvertAmount] = React.useState('100')
  const [fromCurrency, setFromCurrency] = React.useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [toCurrency, setToCurrency] = React.useState<'TRY' | 'USD' | 'EUR'>('USD')
  const [chartPeriod, setChartPeriod] = React.useState<ChartPeriod>('month')

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
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)
  const gridContainerRef = React.useRef<HTMLDivElement>(null)

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

  // Kullanıcı kenardan/köşeden tutup native CSS resize ile boyutu değiştirip
  // bıraktığında (mouseUp) çağrılır — sürükleme SIRASINDA hiçbir React state
  // güncellenmiyor, sadece BİTİNCE son boyut bir kerelik okunup kaydediliyor.
  function handleResizeEnd(id: WidgetId, el: HTMLDivElement) {
    const width = Math.round(el.offsetWidth)
    const height = Math.round(el.offsetHeight)
    setDraftLayout((prev) => (prev ?? layout).map((item) => (item.id === id ? { ...item, width, height } : item)))
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndexRef.current
    dragIndexRef.current = null
    setDragOverIndex(null)
    if (from === null || from === targetIndex) return
    setDraftLayout((prev) => {
      const list = [...(prev ?? layout)]
      const [moved] = list.splice(from, 1)
      list.splice(targetIndex, 0, moved)
      return list
    })
  }

  // "Ekrana Sığdır": mevcut satırları (DOM'daki offsetTop'a göre) bir kerelik
  // ölçüp, her satırdaki widget'lara o satırı tam dolduracak eşit genişlik
  // veriyor — böylece elle sürükle-boyutlandırma sonucu oluşan boşluk/taşma
  // tek tıkla düzeltilebiliyor. Sürekli bir ölçüm/gözlem YOK, sadece tıklama
  // anında bir kerelik okuma yapılıyor.
  function handleFitToScreen() {
    const container = gridContainerRef.current
    if (!container) return
    const containerWidth = container.clientWidth
    const gap = 16

    const itemEls = Array.from(container.children) as HTMLElement[]
    const rows: HTMLElement[][] = []
    for (const el of itemEls) {
      const lastRow = rows[rows.length - 1]
      if (lastRow && Math.abs(lastRow[0].offsetTop - el.offsetTop) < 4) {
        lastRow.push(el)
      } else {
        rows.push([el])
      }
    }

    const widthById = new Map<string, number>()
    for (const row of rows) {
      const count = row.length
      const widthPerItem = Math.floor((containerWidth - gap * (count - 1)) / count)
      for (const el of row) {
        const id = el.dataset.widgetId
        if (id) widthById.set(id, widthPerItem)
      }
    }

    setDraftLayout((prev) =>
      (prev ?? layout).map((item) =>
        widthById.has(item.id) ? { ...item, width: widthById.get(item.id)!, height: null } : item,
      ),
    )
  }

  const monthTotal = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const recentActivity = React.useMemo(() => {
    const paymentItems = recentPayments.slice(0, 10).map((p) => ({
      key: `payment-${p.id}`,
      date: p.paid_at,
      title: p.customers?.full_name ?? '—',
      subtitle: 'Tahsilat',
      amount: Number(p.amount),
      to: '/tahsilatlar',
    }))
    const saleItems = sales.slice(0, 10).map((s) => ({
      key: `sale-${s.id}`,
      date: s.sale_date,
      title: s.product_name,
      subtitle: s.type === 'return' ? 'İade' : 'Satış',
      amount: (s.type === 'return' ? -1 : 1) * s.quantity * Number(s.unit_price),
      to: '/satislar',
    }))
    return [...paymentItems, ...saleItems].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  }, [recentPayments, sales])

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

  const totalReceivable = doctors.reduce((sum, d) => sum + (d.total_debt ?? 0), 0)
  const activeSalesRepsCount = salesReps.filter((r) => r.is_active).length

  const monthTotalAnimated = useCountUp(monthTotal)
  const salesTotalAnimated = useCountUp(salesTotal)
  const totalReceivableAnimated = useCountUp(totalReceivable)
  const activeSalesRepsAnimated = useCountUp(activeSalesRepsCount)

  const revenueData = React.useMemo<RevenueChartPoint[]>(
    () =>
      buildPeriodBuckets(
        recentPayments.map((p) => ({ date: new Date(p.paid_at), amount: Number(p.amount) })),
        chartPeriod,
      ),
    [recentPayments, chartPeriod],
  )

  const salesTrendData = React.useMemo<RevenueChartPoint[]>(() => {
    const salesItems = sales.map((s) => ({ date: new Date(s.sale_date), amount: netAmount(s) }))
    const congressItems = participantSales.map((s) => ({
      date: new Date(s.created_at),
      amount: Number(s.quantity) * Number(s.unit_price),
    }))
    return buildPeriodBuckets([...salesItems, ...congressItems], chartPeriod)
  }, [sales, participantSales, chartPeriod])

  const topProducts = React.useMemo(() => {
    const byProduct = new Map<string, { qty: number; revenue: number }>()
    for (const s of generalSalesThisMonth) {
      const cur = byProduct.get(s.product_name) ?? { qty: 0, revenue: 0 }
      const sign = s.type === 'return' ? -1 : 1
      cur.qty += sign * s.quantity
      cur.revenue += sign * s.quantity * Number(s.unit_price)
      byProduct.set(s.product_name, cur)
    }
    for (const s of congressSalesThisMonth) {
      const cur = byProduct.get(s.product_name) ?? { qty: 0, revenue: 0 }
      cur.qty += s.quantity
      cur.revenue += s.quantity * Number(s.unit_price)
      byProduct.set(s.product_name, cur)
    }
    return Array.from(byProduct.entries())
      .map(([name, v]) => ({ name, ...v }))
      .filter((p) => p.qty > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [generalSalesThisMonth, congressSalesThisMonth])

  const upcomingReminders = React.useMemo(() => {
    const now = new Date()
    return reminders
      .filter((r) => !r.is_done)
      .filter((r) => isPast(new Date(r.due_date)) || isToday(new Date(r.due_date)) || new Date(r.due_date) <= subDays(now, -7))
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)
  }, [reminders])

  const criticalAlertItems = React.useMemo(() => {
    const items: { key: string; icon: React.ElementType; title: string; subtitle: string; to: string }[] = []
    for (const p of alerts.criticalStock.slice(0, 3)) {
      items.push({
        key: `stock-${p.id}`,
        icon: AlertTriangle,
        title: p.name,
        subtitle: `Kritik stok (${p.current_quantity} ${p.unit})`,
        to: '/stok',
      })
    }
    for (const p of alerts.expiringProducts.slice(0, 2)) {
      items.push({
        key: `expiry-${p.id}`,
        icon: ClipboardX,
        title: p.name,
        subtitle: 'Son kullanım tarihi yaklaşıyor/doldu',
        to: '/stok',
      })
    }
    for (const d of alerts.paymentDue.slice(0, 3)) {
      items.push({
        key: `due-${d.id}`,
        icon: CalendarClock,
        title: d.full_name,
        subtitle: `Ödeme vadesi ${getPaymentDueStatus(d.next_payment_due) === 'overdue' ? 'geçti' : 'yaklaşıyor'}`,
        to: `/musteriler/${d.id}`,
      })
    }
    return items.slice(0, 4)
  }, [alerts.criticalStock, alerts.expiringProducts, alerts.paymentDue])

  const last6MonthsStart = React.useMemo(() => startOfMonth(subMonths(new Date(), 5)), [])

  const regionSalesData = React.useMemo<RegionChartPoint[]>(() => {
    const byProvince = new Map<string, number>()
    for (const payment of recentPayments) {
      if (new Date(payment.paid_at) < last6MonthsStart) continue
      const province = payment.customers?.province
      if (!province) continue
      byProvince.set(province, (byProvince.get(province) ?? 0) + Number(payment.amount))
    }
    return Array.from(byProvince.entries())
      .map(([province, total]) => ({ province, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [recentPayments, last6MonthsStart])

  function renderWidget(id: WidgetId) {
    if (id === 'stats') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardV2
            icon={ShoppingCart}
            tone="blue"
            label="Toplam Satış"
            value={salesTotalAnimated.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Bu ay"
            deltaPct={pctDelta(salesTotal, salesPrevTotal)}
            to="/satislar"
          />
          <StatCardV2
            icon={Wallet}
            tone="green"
            label="Tahsilatlar"
            value={monthTotalAnimated.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Bu ay"
            deltaPct={pctDelta(monthTotal, prevMonthTotal)}
            to="/tahsilatlar"
          />
          <StatCardV2
            icon={Landmark}
            tone="gold"
            label="Toplam Cari"
            value={totalReceivableAnimated.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
            sublabel="Açık bakiye"
            deltaPct={null}
            to="/cari-hesap"
          />
          <StatCardV2
            icon={Users}
            tone="purple"
            label="Aktif Temsilci"
            value={Math.round(activeSalesRepsAnimated).toLocaleString('tr-TR')}
            sublabel="Toplam"
            deltaPct={null}
            to="/doktor-ziyaretleri"
          />
        </div>
      )
    }

    if (id === 'quick_actions') {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hızlı İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickAction to="/satislar" icon={FileText} label="Fatura Oluştur" />
              <QuickAction to="/tahsilatlar" icon={Wallet} label="Tahsilat Ekle" />
              <QuickAction to="/musteriler" icon={UserPlus} label="Yeni Cari" />
              <QuickAction to="/ai-analiz" icon={BarChart3} label="Raporlar" />
              <QuickAction to="/ajanda" icon={CalendarPlus} label="Ajandaya Ekle" />
              <QuickAction to="/hatirlatmalar" icon={BellRing} label="Hatırlatma Ekle" />
              <QuickAction to="/prim" icon={Percent} label="Prim Hesapla" />
              <QuickAction to="/stok" icon={PackagePlus} label="Stok Durumu" />
            </div>
          </CardContent>
        </Card>
      )
    }

    if (id === 'critical_alerts') {
      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" /> Kritik Uyarılar
              {criticalAlertItems.length > 0 && <Badge variant="secondary">{criticalAlertItems.length}</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/hatirlatmalar">
                Tümünü gör <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {criticalAlertItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Kritik uyarı yok</p>
            )}
            {criticalAlertItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="border-destructive/20 bg-destructive/5 flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-destructive/10"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <item.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{item.subtitle}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )
    }

    if (id === 'upcoming_reminders') {
      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="size-4 text-primary" /> Yaklaşan Hatırlatmalar
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/hatirlatmalar">
                Tümünü gör <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {upcomingReminders.length === 0 && (
              <p className="text-sm text-muted-foreground">Yaklaşan hatırlatma yok</p>
            )}
            {upcomingReminders.map((r) => {
              const overdue = isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))
              return (
                <Link
                  key={r.id}
                  to="/hatirlatmalar"
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent',
                    overdue && 'border-destructive/20 bg-destructive/5',
                  )}
                >
                  <span
                    className={cn(
                      'animate-alert-glow-red flex size-8 shrink-0 items-center justify-center rounded-lg',
                      overdue ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary',
                    )}
                  >
                    <BellRing className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0', overdue && 'animate-alert-glow-red border-transparent bg-destructive/15 text-destructive')}
                  >
                    {format(new Date(r.due_date), 'd MMM', { locale: trLocale })}
                  </Badge>
                </Link>
              )
            })}
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
        <Card>
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
            <div className="grid flex-1 items-center gap-3 sm:grid-cols-2">
              <StockStatusChart data={stockStatusData} />
              <div className="grid gap-1.5">
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
      const today = new Date()
      const upcoming = congresses
        .filter((c) => {
          const end = c.end_date ?? c.start_date
          return end && new Date(end) >= startOfDay(today)
        })
        .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
        .slice(0, 4)

      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Presentation className="size-4 text-primary" /> Yaklaşan Kongreler
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/kongreler">
                Tümü <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Yaklaşan kongre yok</p>}
            {upcoming.map((c) => {
              const start = c.start_date ? new Date(c.start_date) : null
              const end = c.end_date ? new Date(c.end_date) : start
              const daysLeft = start ? differenceInCalendarDays(start, today) : null
              const isOngoingToday = !!(start && end && start <= today && today <= end)
              const status: { label: string; className: string } = isOngoingToday
                ? { label: 'Bugün', className: 'border-destructive/30 bg-destructive/10 text-destructive' }
                : { label: 'Yaklaşıyor', className: 'border-primary/30 bg-primary/10 text-primary' }
              return (
                <Link
                  key={c.id}
                  to={`/kongreler/${c.id}`}
                  className="flex items-center gap-2.5 rounded-lg border p-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Presentation className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {start && format(start, 'd MMM', { locale: trLocale })}
                      {c.city ? ` · ${c.city}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className={cn('text-[10px]', status.className)}>
                      {status.label}
                    </Badge>
                    {daysLeft != null && daysLeft >= 0 && (
                      <span className="text-muted-foreground text-[10px]">{daysLeft} gün</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )
    }

    if (id === 'exchange_rates') {
      return (
        <Card>
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
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" /> Tahsilat Trendi
            </CardTitle>
            <div className="flex items-center gap-2">
              <PeriodToggle value={chartPeriod} onChange={setChartPeriod} />
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tahsilatlar">
                  Tahsilatlara git <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>
      )
    }

    if (id === 'sales_trend') {
      return (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4 text-primary" /> Satış Trendi
            </CardTitle>
            <div className="flex items-center gap-2">
              <PeriodToggle value={chartPeriod} onChange={setChartPeriod} />
              <Button variant="ghost" size="sm" asChild>
                <Link to="/satislar">
                  Satışlara git <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <RevenueChart data={salesTrendData} />
          </CardContent>
        </Card>
      )
    }

    if (id === 'top_products') {
      return (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-[oklch(0.72_0.16_70)]" /> En Çok Satan Ürünler
              <span className="text-muted-foreground text-xs font-normal">Bu ay</span>
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/satislar">
                Tüm satışlar <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu ay henüz ürün satışı yok</p>
            ) : (
              <TopProductsChart data={topProducts} />
            )}
          </CardContent>
        </Card>
      )
    }

    if (id === 'region_sales') {
      return (
        <Card>
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

    if (id === 'congress_prices') {
      const pricedCongresses = congresses
        .filter((c) => c.single_person_price != null || c.two_person_price != null)
        .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
        .slice(0, 4)

      return (
        <Card>
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

    if (id === 'rep_performance') {
      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" /> Temsilci Performansı
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/doktor-ziyaretleri">
                Detaya git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {repPerformance.length === 0 && (
              <p className="text-sm text-muted-foreground">Bu ay için temsilci bazlı satış/tahsilat verisi yok</p>
            )}
            {repPerformance.map((rep) => (
              <div key={rep.name} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                <span className="font-medium">{rep.name}</span>
                <span className="flex gap-3 text-xs text-muted-foreground">
                  <span>Satış: {rep.sold.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</span>
                  <span>Tahsilat: {rep.collected.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )
    }

    if (id === 'commission_summary') {
      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="size-4 text-primary" /> Prim Özeti (Bu Ay)
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/prim">
                Prim sayfasına git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-2xl font-semibold">
              {totalCommissionThisMonth.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </p>
            {commissionSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu ay prim üreten kural/satış yok</p>
            ) : (
              commissionSummary.slice(0, 5).map((r) => (
                <div key={r.salesRepId} className="flex items-center justify-between text-sm">
                  <span>{r.salesRepName}</span>
                  <span className="font-medium">{r.netTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )
    }

    if (id === 'sample_conversion') {
      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="size-4 text-primary" /> Numune Dönüşüm Oranı
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/numuneler">
                Numunelere git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold">{sampleConversion.totalItems}</p>
              <p className="text-muted-foreground text-xs">Toplam Numune</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-success">{sampleConversion.convertedItems}</p>
              <p className="text-muted-foreground text-xs">Satışa Döndü</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">%{sampleConversion.percent.toFixed(1)}</p>
              <p className="text-muted-foreground text-xs">Dönüşüm Oranı</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (id === 'lot_expiry') {
      return (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-destructive" /> Lot / SKT Riski
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/stok">
                Stoğa git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold text-destructive">{expiringLotsCount}</p>
              <p className="text-muted-foreground text-xs">90 gün içinde dolan lot</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {expiringLotsValue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
              </p>
              <p className="text-muted-foreground text-xs">Riskteki stok değeri</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Son İşlemler</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tahsilatlar">
                Tahsilatlara git <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">Henüz işlem yok</p>}
            {recentActivity.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-muted-foreground">
                    {item.subtitle} · {format(new Date(item.date), 'd MMM yyyy', { locale: trLocale })}
                  </p>
                </div>
                <Badge variant="outline" className={cn('shrink-0', item.amount < 0 && 'text-destructive')}>
                  {item.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Düzenleme modunda TÜM widget'lar (gizli olanlar soluk halde) listede kalır ki
  // kullanıcı yerini/boyutunu ayarlayabilsin ve göz ikonuyla geri açabilsin; normal
  // görünümde sadece görünür olanlar render edilir. flex-wrap + sabit genişlik
  // class'ları (SIZE_CLASS) ile aynı satıra sığan widget'lar otomatik yan yana
  // dizilir — bilinçli olarak sürekli JS ölçümü/ResizeObserver YOK (bkz. yukarıdaki
  // WidgetSize açıklaması).
  const visibleItems = editMode ? layout : layout.filter((item) => item.visible)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            {`${welcomeText}${staff?.full_name ? ', ' + staff.full_name : ''}`}
            {staff && (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {tr.staffRole[staff.role]}
              </Badge>
            )}
            {isAdmin && (
              <Popover open={welcomePopoverOpen} onOpenChange={setWelcomePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={openWelcomeEditor}
                    title="Karşılama metni ve şehri düzenle"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1 transition-colors"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dashboard-welcome-text">Karşılama metni</Label>
                    <Input
                      id="dashboard-welcome-text"
                      value={draftWelcomeText}
                      onChange={(e) => setDraftWelcomeText(e.target.value)}
                      placeholder="Hoş geldiniz"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="dashboard-welcome-city">Hava durumu şehri</Label>
                    <Input
                      id="dashboard-welcome-city"
                      value={draftCity}
                      onChange={(e) => setDraftCity(e.target.value)}
                      placeholder="İstanbul"
                    />
                  </div>
                  <Button size="sm" onClick={saveWelcomeSettings} disabled={saveWelcomeMutation.isPending}>
                    <Save className="size-3.5" /> Kaydet
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-3">
            {format(new Date(), 'd MMMM yyyy, EEEE', { locale: trLocale })}
            <span className="text-border">|</span>
            <LiveClock />
            <span className="text-border">|</span>
            <WeatherWidget city={weatherCity} />
          </span>
        }
        actions={
          <div className="flex gap-2">
            {isAdmin && !editMode && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="size-3.5" /> Paneli Düzenle
              </Button>
            )}
            {isAdmin && editMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleFitToScreen}>
                  <LayoutGrid className="size-3.5" /> Ekrana Sığdır
                </Button>
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

      <div className="flex flex-wrap items-center gap-2.5 rounded-full border bg-muted/30 px-4 py-2 text-sm">
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground">
          <Coins className="size-4 text-primary" /> Döviz:
        </span>
        {ratesLoading ? (
          <span className="text-xs text-muted-foreground">Yükleniyor...</span>
        ) : exchangeRates.length === 0 ? (
          <span className="text-xs text-muted-foreground">Kur bilgisi alınamadı</span>
        ) : (
          exchangeRates.map((r) => (
            <span key={r.currency} className="shrink-0 tabular-nums">
              <span className="font-semibold">{r.currency}</span>{' '}
              {r.rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₺
            </span>
          ))
        )}
        <span className="text-border">|</span>
        <Input
          type="text"
          inputMode="numeric"
          value={convertAmountDisplay}
          onChange={(e) => handleConvertAmountChange(e.target.value)}
          className="h-7 w-20 px-2 text-sm"
        />
        <Select value={fromCurrency} onValueChange={(v) => setFromCurrency(v as typeof fromCurrency)}>
          <SelectTrigger className="h-7 w-[4.5rem] px-2 text-xs">
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
          className="size-6 shrink-0"
          onClick={() => {
            setFromCurrency(toCurrency)
            setToCurrency(fromCurrency)
          }}
        >
          <ArrowLeftRight className="size-3.5" />
        </Button>
        <Select value={toCurrency} onValueChange={(v) => setToCurrency(v as typeof toCurrency)}>
          <SelectTrigger className="h-7 w-[4.5rem] px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRY">TRY</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
        <span className="shrink-0 font-semibold tabular-nums">
          = {convertedAmount.toLocaleString('tr-TR', { style: 'currency', currency: toCurrency })}
        </span>
      </div>

      {editMode && (
        <p className="text-muted-foreground text-xs">
          Çerçeveleri sürükleyerek yerini değiştirebilir (bırakacağınız yer vurgulanır), sağ-alt
          köşesinden tutup kenarlarından çekerek büyütüp küçültebilir, göz ikonuyla gizleyip
          gösterebilir, "Ekrana Sığdır" ile aynı satırdaki çerçeveleri otomatik eşit genişliğe
          getirebilirsiniz.
        </p>
      )}

      <div ref={gridContainerRef} className="flex flex-wrap items-start gap-4">
        {visibleItems.map((item, index) => (
          <div
            key={item.id}
            data-widget-id={item.id}
            draggable={editMode}
            onDragStart={() => (dragIndexRef.current = index)}
            onDragOver={(e) => {
              if (!editMode) return
              e.preventDefault()
              if (dragOverIndex !== index) setDragOverIndex(index)
            }}
            onDragLeave={() => {
              if (dragOverIndex === index) setDragOverIndex(null)
            }}
            onDrop={() => editMode && handleDrop(index)}
            onMouseUp={editMode ? (e) => handleResizeEnd(item.id, e.currentTarget) : undefined}
            style={{
              width: item.width ? `${item.width}px` : `${DEFAULT_WIDTH_PCT[item.id]}%`,
              height: item.height ?? undefined,
              minWidth: 260,
              maxWidth: '100%',
            }}
            className={cn(
              editMode && 'resize overflow-auto rounded-lg border border-dashed border-border/60 p-1 transition-colors',
              editMode && !item.visible && 'opacity-40',
              editMode && dragOverIndex === index && 'border-primary bg-primary/5',
            )}
          >
            {editMode && (
              <div className="mb-1.5 flex cursor-grab items-center justify-between rounded-lg border bg-muted/50 px-2 py-1 text-xs active:cursor-grabbing">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <GripVertical className="size-3.5" /> {widgetLabels[item.id]}
                </span>
                <button
                  type="button"
                  onClick={() => toggleVisible(item.id)}
                  title={item.visible ? 'Gizle' : 'Göster'}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {item.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              </div>
            )}
            {renderWidget(item.id)}
          </div>
        ))}
      </div>
    </div>
  )
}
