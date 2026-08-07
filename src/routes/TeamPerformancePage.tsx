import * as React from 'react'
import { Link } from 'react-router-dom'
import { startOfMonth, subMonths } from 'date-fns'
import { RefreshCw, Sparkles, TrendingDown, TrendingUp, Wallet, AlertTriangle, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TeamScoreScatterChart, quadrantLabels, type PerformanceQuadrant, type TeamScorePoint } from '@/components/charts/TeamScoreScatterChart'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useVisitsInRange } from '@/features/doctorVisits/hooks'
import { useCrmActivities } from '@/features/crm/hooks'
import { usePayments, useAllInstallments } from '@/features/payments/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { calculateReceivablesRisk } from '@/features/payments/calculateReceivablesRisk'
import { getPaymentDueStatus, getAgingBucket } from '@/lib/paymentDue'
import { useAIService } from '@/features/ai/useAIService'
import { snapshotSystemMessage } from '@/features/ai/snapshotSystemMessage'
import { cn } from '@/lib/utils'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function dateKey(d: Date) {
  const copy = new Date(d)
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset())
  return copy.toISOString().slice(0, 10)
}

const quadrantBadgeClass: Record<PerformanceQuadrant, string> = {
  zayif: 'bg-destructive/15 text-destructive',
  potansiyel: 'bg-warning/15 text-warning-foreground',
  verimli: 'bg-primary/15 text-primary',
  guclu: 'bg-success/15 text-success',
}

/**
 * gocust'un "Track team performance and impact" + "ARYA AI Suggestions"
 * ekranlarından ilham alınarak eklendi (Faz 9). Aktivite/Ciro skoru gerçek
 * ziyaret+CRM aktivitesi ve tahsilat verisinden hesaplanır — gocust'un tam
 * formülü bilinmediği için kendi şeffaf mantığımız kullanıldı (medyan
 * bölünmesiyle 4 çeyrek). AI önerileri de gerçek hesaplanmış sinyallere
 * (gecikmiş tahsilat, aylık ciro trendi) dayanır, sayı uydurmaz.
 */
export function TeamPerformancePage() {
  const { data: salesReps = [] } = useSalesReps()
  const activeReps = React.useMemo(() => salesReps.filter((r) => r.is_active), [salesReps])

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const lastMonthStart = React.useMemo(() => startOfMonth(subMonths(new Date(), 1)), [])
  const today = React.useMemo(() => new Date(), [])

  const { data: visits = [] } = useVisitsInRange(dateKey(monthStart), dateKey(today))
  const { data: activities = [] } = useCrmActivities()
  const { data: monthPayments = [] } = usePayments({ from: monthStart.toISOString() })
  const { data: lastMonthPayments = [] } = usePayments({ from: lastMonthStart.toISOString(), to: monthStart.toISOString() })
  const { data: allPayments = [] } = usePayments({})
  const { data: customers = [] } = useCustomers('')
  const { data: installments = [] } = useAllInstallments()
  const aiService = useAIService()

  const monthActivities = React.useMemo(
    () => activities.filter((a) => new Date(a.occurred_at) >= monthStart),
    [activities, monthStart],
  )

  const points: TeamScorePoint[] = React.useMemo(() => {
    const raw = activeReps.map((rep) => {
      const activity =
        visits.filter((v) => v.sales_rep_id === rep.id).length +
        monthActivities.filter((a) => a.sales_rep_id === rep.id).length
      const revenue = monthPayments
        .filter((p) => p.sales_rep_id === rep.id)
        .reduce((sum, p) => sum + Number(p.amount), 0)
      return { id: rep.id, name: rep.name, activity, revenue }
    })
    const medActivity = median(raw.map((r) => r.activity))
    const medRevenue = median(raw.map((r) => r.revenue))
    return raw.map((r) => {
      const highActivity = r.activity >= medActivity
      const highRevenue = r.revenue >= medRevenue
      const quadrant: PerformanceQuadrant =
        highActivity && highRevenue ? 'guclu' : highActivity && !highRevenue ? 'potansiyel' : !highActivity && highRevenue ? 'verimli' : 'zayif'
      return { ...r, quadrant }
    })
  }, [activeReps, visits, monthActivities, monthPayments])

  const medianActivity = React.useMemo(() => median(points.map((p) => p.activity)), [points])
  const medianRevenue = React.useMemo(() => median(points.map((p) => p.revenue)), [points])

  const quadrantCounts = React.useMemo(() => {
    const counts: Record<PerformanceQuadrant, number> = { zayif: 0, potansiyel: 0, verimli: 0, guclu: 0 }
    for (const p of points) counts[p.quadrant] += 1
    return counts
  }, [points])

  // Tahsilat riski: mevcut doctorsWithBalance mantığı (useAlertsSummary ile aynı) + taksit bazlı gecikme (calculateReceivablesRisk)
  const paidByCustomer = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allPayments) map.set(p.customer_id, (map.get(p.customer_id) ?? 0) + Number(p.amount))
    return map
  }, [allPayments])

  const doctorsWithBalance = React.useMemo(
    () =>
      customers
        .filter((d) => d.total_debt != null && Number(d.total_debt) - (paidByCustomer.get(d.id) ?? 0) > 0)
        .map((d) => ({ ...d, balance: Number(d.total_debt) - (paidByCustomer.get(d.id) ?? 0) })),
    [customers, paidByCustomer],
  )

  const overdueDoctors = React.useMemo(
    () => doctorsWithBalance.filter((d) => getPaymentDueStatus(d.next_payment_due) === 'overdue'),
    [doctorsWithBalance],
  )

  const totalBalance = doctorsWithBalance.reduce((sum, d) => sum + d.balance, 0)
  const overdueBalance = overdueDoctors.reduce((sum, d) => sum + d.balance, 0)
  const toBeCollected = Math.max(0, totalBalance - overdueBalance)
  const avgOverdueDays = React.useMemo(() => {
    const days = overdueDoctors
      .map((d) => {
        const bucket = getAgingBucket(d.next_payment_due)
        if (!bucket || bucket === 'current') return null
        const due = d.next_payment_due ? new Date(d.next_payment_due) : null
        if (!due) return null
        return Math.round((Date.now() - due.getTime()) / 86_400_000)
      })
      .filter((d): d is number => d != null)
    if (days.length === 0) return 0
    return Math.round(days.reduce((a, b) => a + b, 0) / days.length)
  }, [overdueDoctors])

  const receivablesRisk = React.useMemo(() => calculateReceivablesRisk(installments).slice(0, 5), [installments])

  const monthRevenueTotal = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const lastMonthRevenueTotal = lastMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const trendPct = lastMonthRevenueTotal > 0 ? Math.round(((monthRevenueTotal - lastMonthRevenueTotal) / lastMonthRevenueTotal) * 100) : null

  const insightSnapshot = React.useMemo(
    () => ({
      bu_ay_tahsilat: Math.round(monthRevenueTotal),
      gecen_ay_tahsilat: Math.round(lastMonthRevenueTotal),
      trend_yuzde: trendPct,
      toplam_acik_bakiye: Math.round(totalBalance),
      gecikmis_bakiye: Math.round(overdueBalance),
      ortalama_gecikme_gun: avgOverdueDays,
      en_riskli_doktorlar: receivablesRisk.map((r) => ({ doktor: r.customerName, geciken_tutar: Math.round(r.overdueAmount), gun: r.maxDaysOverdue })),
      ekip: points.map((p) => ({ temsilci: p.name, aktivite: p.activity, ciro: Math.round(p.revenue), durum: quadrantLabels[p.quadrant] })),
    }),
    [monthRevenueTotal, lastMonthRevenueTotal, trendPct, totalBalance, overdueBalance, avgOverdueDays, receivablesRisk, points],
  )

  const {
    data: insightText,
    isFetching: insightLoading,
    error: insightError,
    refetch: refetchInsight,
  } = useQuery({
    queryKey: ['team-performance-insights'],
    queryFn: async () => {
      const result = await aiService.chat([
        snapshotSystemMessage(insightSnapshot),
        {
          role: 'user',
          content:
            'Bu ekip performansı ve tahsilat riski verisine bakarak EN FAZLA 3 kısa, aksiyona dönük öneri/uyarı ' +
            'cümlesi yaz (ör. aktif ama satışı düşük bir temsilci, riskli bir doktor, düşen ciro trendi). ' +
            'Her maddeyi "- " ile başlat, başka açıklama ekleme.',
        },
      ])
      return result.content
    },
    staleTime: 15 * 60 * 1000,
    retry: false,
  })

  return (
    <div>
      <PageHeader
        title="Ekip Performansı"
        description="Temsilci aktivite/ciro dağılımı, tahsilat riski ve yapay zeka önerileri"
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" /> Tahsilat Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Toplam Açık Bakiye</span>
              <span className="font-semibold tabular-nums">{currency(totalBalance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gecikmiş</span>
              <span className="font-semibold tabular-nums text-destructive">{currency(overdueBalance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ortalama Gecikme</span>
              <span className="font-semibold tabular-nums">{avgOverdueDays} gün</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">Vadesi Gelecek</span>
              <span className="font-semibold tabular-nums text-success">{currency(toBeCollected)}</span>
            </div>
            <Button variant="ghost" size="sm" className="mt-1 justify-start px-0" asChild>
              <Link to="/cari-hesap">Cari Hesap Listesi →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              {trendPct != null && trendPct < 0 ? (
                <TrendingDown className="size-4 text-destructive" />
              ) : (
                <TrendingUp className="size-4 text-success" />
              )}
              Bu Ay Ciro Trendi
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Bu Ay</span>
              <span className="font-semibold tabular-nums">{currency(monthRevenueTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Geçen Ay</span>
              <span className="font-semibold tabular-nums">{currency(lastMonthRevenueTotal)}</span>
            </div>
            {trendPct != null && (
              <Badge variant={trendPct < 0 ? 'destructive' : 'success'} className="w-fit">
                {trendPct >= 0 ? '+' : ''}
                {trendPct}%
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" /> En Riskli Doktorlar
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {receivablesRisk.length === 0 && <p className="text-muted-foreground">Gecikmiş taksit yok</p>}
            {receivablesRisk.map((r) => (
              <div key={r.customerId} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.customerName}</span>
                <span className="shrink-0 tabular-nums text-destructive">{currency(r.overdueAmount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> Yapay Zeka Önerileri
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => refetchInsight()} disabled={insightLoading}>
            {insightLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          {insightError ? (
            <p className="text-sm text-muted-foreground">
              Yapay zeka sağlayıcısına ulaşılamadı (Ayarlar &gt; Yapay Zekâ'dan kontrol edin).
            </p>
          ) : insightLoading ? (
            <p className="text-sm text-muted-foreground">Analiz ediliyor...</p>
          ) : (
            <div className="grid gap-1.5 text-sm">
              {(insightText ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {line.replace(/^-\s*/, '')}
                  </p>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktivite & Ciro Dağılımı</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(quadrantLabels) as PerformanceQuadrant[]).map((q) => (
              <Badge key={q} variant="outline" className={cn('gap-1.5 border-transparent', quadrantBadgeClass[q])}>
                {quadrantLabels[q]} · {quadrantCounts[q]}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aktif satış temsilcisi yok.</p>
          ) : (
            <TeamScoreScatterChart data={points} medianActivity={medianActivity} medianRevenue={medianRevenue} />
          )}

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Temsilci</TableHead>
                <TableHead className="text-right">Aktivite Sayısı</TableHead>
                <TableHead className="text-right">Ciro</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points
                .slice()
                .sort((a, b) => b.revenue - a.revenue)
                .map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.activity}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(p.revenue)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('border-transparent', quadrantBadgeClass[p.quadrant])}>
                        {quadrantLabels[p.quadrant]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
