import * as React from 'react'
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  AtSign,
  User,
  Trash2,
  Wallet,
  Package,
  Users,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { DoctorVisitDialog } from '@/features/doctorVisits/DoctorVisitDialog'
import { useVisitsInRange } from '@/features/doctorVisits/hooks'
import { SalesRepDialog } from '@/features/salesReps/SalesRepDialog'
import { useDeleteSalesRep, useSalesReps } from '@/features/salesReps/hooks'
import { usePayments } from '@/features/payments/hooks'
import type { DoctorVisit, SalesRep } from '@/types/database'
import { ExportMenu } from '@/components/ExportMenu'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function dateKey(d: Date) {
  const copy = new Date(d)
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset())
  return copy.toISOString().slice(0, 10)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface RepPerformance {
  weekRevenue: number
  monthRevenue: number
  monthDoctors: string[]
}

function RepWeekSection({
  rep,
  days,
  visits,
  performance,
}: {
  rep: SalesRep
  days: Date[]
  visits: DoctorVisit[]
  performance: RepPerformance
}) {
  const deleteRepMutation = useDeleteSalesRep()
  const { confirm, dialog } = useConfirmDialog()

  const visitsByDay = React.useMemo(() => {
    const map = new Map<string, DoctorVisit[]>()
    for (const day of days) map.set(dateKey(day), [])
    for (const visit of visits) {
      const list = map.get(visit.visit_date)
      if (list) list.push(visit)
    }
    return map
  }, [visits, days])

  async function handleDeleteRep() {
    if (!(await confirm(`${rep.name} silinsin mi? Bu temsilciye ait tüm doktor ziyaret kayıtları da silinecek.`))) return
    deleteRepMutation.mutate(rep.id)
  }

  return (
    <>
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <SalesRepDialog
            rep={rep}
            trigger={
              <button type="button" title="Fotoğrafı düzenle">
                <Avatar className="size-8">
                  {rep.photo_url && <AvatarImage src={rep.photo_url} alt={rep.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(rep.name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            }
          />
          {rep.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{visits.length} doktor</Badge>
          <Button variant="ghost" size="icon" onClick={handleDeleteRep}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="mb-1 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Bu Hafta Ciro</p>
              <p className="font-semibold">{currency(performance.weekRevenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Bu Ay Ciro</p>
              <p className="font-semibold">{currency(performance.monthRevenue)}</p>
            </div>
          </div>
          {performance.monthDoctors.length > 0 && (
            <div className="col-span-2 flex items-start gap-2">
              <Users className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Bu Ay Tahsilat Alınan Doktorlar</p>
                <p className="text-sm">{performance.monthDoctors.join(', ')}</p>
              </div>
            </div>
          )}
        </div>
        <Separator className="mb-1" />
        {days.map((day) => {
          const key = dateKey(day)
          const dayVisits = visitsByDay.get(key) ?? []
          const isToday = key === dateKey(new Date())
          return (
            <div key={key} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium capitalize">
                  {format(day, 'EEEE, d MMMM', { locale: trLocale })}
                  {isToday && <span className="ml-2 text-xs font-normal text-primary">(bugün)</span>}
                </p>
                <DoctorVisitDialog visitDate={key} salesRepId={rep.id} />
              </div>
              {dayVisits.length === 0 ? (
                <p className="text-xs text-muted-foreground">Bu gün için doktor eklenmedi.</p>
              ) : (
                <div className="grid gap-2">
                  {dayVisits.map((visit) => (
                    <div key={visit.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <User className="size-3.5 text-muted-foreground" /> {visit.doctor_name}
                          </span>
                          {visit.phone && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="size-3.5" /> {visit.phone}
                            </span>
                          )}
                          {visit.email && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="size-3.5" /> {visit.email}
                            </span>
                          )}
                          {visit.social_media && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <AtSign className="size-3.5" /> {visit.social_media}
                            </span>
                          )}
                        </div>
                        <DoctorVisitDialog visitDate={key} salesRepId={rep.id} visit={visit} />
                      </div>
                      {visit.notes && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Package className="mt-0.5 size-3.5 shrink-0" /> {visit.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
    {dialog}
    </>
  )
}

export function DoctorVisitsPage() {
  const { data: salesReps = [] } = useSalesReps()
  const reportRef = React.useRef<HTMLDivElement>(null)

  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const { data: visits = [] } = useVisitsInRange(dateKey(weekStart), dateKey(weekEnd))

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const { data: weekPayments = [] } = usePayments({
    from: weekStart.toISOString(),
    to: new Date(weekEnd.getTime() + 86_399_000).toISOString(),
  })
  const { data: monthPayments = [] } = usePayments({ from: monthStart.toISOString() })

  const activeReps = salesReps.filter((r) => r.is_active)

  const performanceByRep = React.useMemo(() => {
    const map = new Map<string, RepPerformance>()
    for (const rep of activeReps) {
      const weekRevenue = weekPayments
        .filter((p) => p.sales_rep_id === rep.id)
        .reduce((sum, p) => sum + Number(p.amount), 0)
      const monthRepPayments = monthPayments.filter((p) => p.sales_rep_id === rep.id)
      const monthRevenue = monthRepPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const monthDoctors = Array.from(
        new Set(monthRepPayments.map((p) => p.customers?.full_name).filter((n): n is string => !!n)),
      )
      map.set(rep.id, { weekRevenue, monthRevenue, monthDoctors })
    }
    return map
  }, [activeReps, weekPayments, monthPayments])

  const repNameById = React.useMemo(() => new Map(salesReps.map((r) => [r.id, r.name])), [salesReps])
  const exportRows = React.useMemo(
    () =>
      visits
        .slice()
        .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
        .map((v) => ({ ...v, repName: repNameById.get(v.sales_rep_id ?? '') ?? '—' })),
    [visits, repNameById],
  )

  return (
    <div>
      <PageHeader
        title="Haftalık Satış Temsilcisi Raporu"
        description="Her satış temsilcisinin isminin altında kendi haftalık doktor listesi"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => subWeeks(d, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium whitespace-nowrap">
              {format(weekStart, 'd MMM', { locale: trLocale })} – {format(weekEnd, 'd MMM yyyy', { locale: trLocale })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => addWeeks(d, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            <ExportMenu<(typeof exportRows)[number]>
              title={`Haftalık Satış Temsilcisi Raporu (${format(weekStart, 'd MMM', { locale: trLocale })} – ${format(weekEnd, 'd MMM yyyy', { locale: trLocale })})`}
              filename={`satis-temsilcisi-raporu-${format(weekStart, 'yyyy-MM-dd')}`}
              rows={exportRows}
              imageTarget={reportRef}
              columns={[
                { header: 'Tarih', value: (v) => format(new Date(v.visit_date), 'd MMM yyyy', { locale: trLocale }) },
                { header: 'Temsilci', value: (v) => v.repName },
                { header: 'Doktor', value: (v) => v.doctor_name },
                { header: 'Telefon', value: (v) => v.phone ?? '' },
                { header: 'E-posta', value: (v) => v.email ?? '' },
                { header: 'Sosyal Medya', value: (v) => v.social_media ?? '' },
              ]}
            />
            <SalesRepDialog />
          </div>
        }
      />

      {activeReps.length === 0 && (
        <p className="text-muted-foreground">
          Henüz satış temsilcisi eklenmedi. Yukarıdan <strong>"Temsilci Ekle"</strong> ile başlayın.
        </p>
      )}

      <div ref={reportRef} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {activeReps.map((rep) => (
          <RepWeekSection
            key={rep.id}
            rep={rep}
            days={days}
            visits={visits.filter((v) => v.sales_rep_id === rep.id)}
            performance={
              performanceByRep.get(rep.id) ?? { weekRevenue: 0, monthRevenue: 0, monthDoctors: [] }
            }
          />
        ))}
      </div>
    </div>
  )
}
