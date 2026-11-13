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
  Plus,
  Loader2,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { DoctorVisitDialog } from '@/features/doctorVisits/DoctorVisitDialog'
import { VisitImportDialog } from '@/features/doctorVisits/VisitImportDialog'
import { useCreateVisit, useDeleteVisit, useVisitDates, useVisitsInRange } from '@/features/doctorVisits/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SalesRepDialog } from '@/features/salesReps/SalesRepDialog'
import { useSalesReps } from '@/features/salesReps/hooks'
import { deleteVisit, deleteVisitsInRange } from '@/features/doctorVisits/api'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usePayments } from '@/features/payments/hooks'
import type { Customer, DoctorVisit, SalesRep } from '@/types/database'
import { ExportMenu } from '@/components/ExportMenu'
import { confirmAction, useConfirmDialog } from '@/hooks/useConfirmDialog'

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

const DOCTOR_NAMES_LIST_ID = 'rep-report-doctor-names'

/**
 * Günün satırında doğrudan doktor ekleme (kullanıcı isteği, 2026-10-23: "günlerin
 * hepsi yazsa, sadece yanlarına doktorları girsek — gün gün tıklayıp girmek daha
 * zor"). Yazarken Cari Kart'taki doktorlar önerilir; Enter ile kaydedilir,
 * virgülle birden fazla doktor aynı anda girilebilir. Cari kartla birebir eşleşen
 * isim karta bağlanır (telefonu da alınır). Ayrıntılı giriş için "Doktor Ekle"
 * penceresi aynen duruyor.
 */
function QuickVisitInput({ visitDate, salesRepId, customers }: { visitDate: string; salesRepId: string; customers: Customer[] }) {
  const [value, setValue] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const createMutation = useCreateVisit()

  async function save() {
    const names = value
      .split(/[,;\n]/)
      .map((n) => n.trim())
      .filter((n) => n.length >= 2)
    if (names.length === 0 || saving) return
    setSaving(true)
    try {
      for (const name of names) {
        const key = name.toLocaleLowerCase('tr-TR')
        const customer = customers.find((c) => c.full_name.trim().toLocaleLowerCase('tr-TR') === key)
        await createMutation.mutateAsync({
          visit_date: visitDate,
          sales_rep_id: salesRepId,
          doctor_name: customer?.full_name ?? name,
          customer_id: customer?.id ?? null,
          phone: customer?.phone || null,
        })
      }
      setValue('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        list={DOCTOR_NAMES_LIST_ID}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void save()
          }
        }}
        placeholder="Doktor adı"
        title="Doktor adı yazıp Enter'a basın — virgülle birden fazla doktor girilebilir"
        className="h-8 text-sm"
        disabled={saving}
      />
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="size-8 shrink-0"
        title="Ekle"
        onClick={() => void save()}
        disabled={saving || value.trim().length < 2}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      </Button>
    </div>
  )
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
  customers,
}: {
  rep: SalesRep
  days: Date[]
  visits: DoctorVisit[]
  performance: RepPerformance
  customers: Customer[]
}) {
  const queryClient = useQueryClient()
  const [clearing, setClearing] = React.useState(false)
  const deleteVisitMutation = useDeleteVisit()
  const { confirm, dialog } = useConfirmDialog()

  const weekKeys = days.map(dateKey)
  const [pickedDate, setEntryDate] = React.useState('')
  // Seçilen gün bu haftada değilse (hafta değişti): bugün bu haftadaysa bugün, değilse haftanın ilk günü
  const entryDate = weekKeys.includes(pickedDate) ? pickedDate : weekKeys.includes(dateKey(new Date())) ? dateKey(new Date()) : weekKeys[0]

  const visitsByDay = React.useMemo(() => {
    const map = new Map<string, DoctorVisit[]>()
    for (const day of days) map.set(dateKey(day), [])
    for (const visit of visits) {
      const list = map.get(visit.visit_date)
      if (list) list.push(visit)
    }
    return map
  }, [visits, days])

  // Çöp kutusu temsilciyi DEĞİL, sadece bu haftaki doktor listesini siler (kullanıcı isteği, 2026-11-13:
  // "sil yaptığımda personel silinmesin, sadece içeriye eklediğim haftalık doktorlar silinsin")
  async function handleClearWeek() {
    if (!visits.length || clearing) return
    if (!(await confirm(`${rep.name} listesindeki bu haftanın ${visits.length} doktoru silinsin mi? Temsilci silinmez.`))) return
    setClearing(true)
    let failed = 0
    for (const visit of visits) {
      try {
        await deleteVisit(visit.id)
      } catch {
        failed++
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
    void queryClient.invalidateQueries({ queryKey: ['doctor_visit_dates'] })
    setClearing(false)
    if (failed) toast.error(`${failed} doktor silinemedi`)
    else toast.success(`${rep.name} listesindeki bu haftanın doktorları silindi`)
  }

  async function handleDeleteVisit(visit: DoctorVisit) {
    if (!(await confirm(`${visit.doctor_name} bu günün listesinden silinsin mi?`))) return
    deleteVisitMutation.mutate(visit.id)
  }

  return (
    <>
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <SalesRepDialog
            rep={rep}
            trigger={
              <button type="button" title="Temsilciyi düzenle (isim/fotoğraf)" className="flex items-center gap-2">
                <Avatar className="size-8">
                  {rep.photo_url && <AvatarImage src={rep.photo_url} alt={rep.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(rep.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate hover:underline">{rep.name}</span>
              </button>
            }
          />
        </CardTitle>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className="whitespace-nowrap">{visits.length} doktor</Badge>
          <VisitImportDialog rep={rep} days={days} visits={visits} customers={customers} />
          <Button variant="ghost" size="icon" title="Bu haftanın doktorlarını sil (temsilci silinmez)" disabled={!visits.length || clearing} onClick={() => void handleClearWeek()}>
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
        {/* Gün satırları hazır gösterilmez (kullanıcı isteği, 2026-11-13: "günleri ben gireyim tek tek,
            sen gösterme"): günü seçip doktoru yazınca o gün listede belirir. */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-2">
          <Input
            type="date"
            className="w-[9.5rem] shrink-0"
            title="Gün seçin"
            min={dateKey(days[0])}
            max={[dateKey(days[days.length - 1]), dateKey(new Date())].sort()[0]}
            value={entryDate}
            onChange={(e) => e.target.value && e.target.value <= dateKey(new Date()) && setEntryDate(e.target.value)}
          />
          <div className="min-w-0 flex-1">
            <QuickVisitInput visitDate={entryDate} salesRepId={rep.id} customers={customers} />
          </div>
        </div>
        {visits.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">Bu hafta henüz doktor girilmedi.</p>}
        {days.filter((day) => (visitsByDay.get(dateKey(day))?.length ?? 0) > 0).map((day) => {
          const key = dateKey(day)
          const dayVisits = visitsByDay.get(key) ?? []
          const isToday = key === dateKey(new Date())
          return (
            <div key={key} className="rounded-lg border p-3">
              <p
                className={cn('text-sm font-medium capitalize', isToday && 'text-primary')}
                title={format(day, 'EEEE, d MMMM', { locale: trLocale }) + (isToday ? ' (bugün)' : '')}
              >
                {format(day, 'EEEE d MMMM', { locale: trLocale })}
                {isToday && <span className="ml-1.5 text-xs font-normal">bugün</span>}
              </p>
              {dayVisits.length > 0 && (
                <div className="mt-2 grid gap-2">
                  {dayVisits.map((visit) => (
                    <div key={visit.id} className="flex items-start gap-2 rounded-md bg-muted/50 py-1.5 pr-1 pl-3 text-sm">
                      <div className="min-w-0 flex-1 py-0.5">
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
                        {visit.notes && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Package className="mt-0.5 size-3.5 shrink-0" /> {visit.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center">
                        <DoctorVisitDialog visitDate={key} salesRepId={rep.id} visit={visit} />
                        <Button variant="ghost" size="icon" className="size-8" title="Doktoru sil" onClick={() => void handleDeleteVisit(visit)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
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
  // Eski/ileri tarihli raporlar (kullanıcı isteği, 2026-11-13): kaydı olan haftalar listesi + takvimden hafta seçme
  const { data: visitDates = [] } = useVisitDates()
  const thisWeekKey = dateKey(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const reportWeeks = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of visitDates) {
      const k = dateKey(startOfWeek(new Date(`${d}T00:00:00`), { weekStartsOn: 1 }))
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [visitDates])
  // Günü gelmemiş tarihlere gidilmez (kullanıcı isteği, 2026-11-13)
  // Rapordaki kayıtları toplu silme — Cari Kart'a eklenmiş doktorlar silinmez
  const queryClient = useQueryClient()
  const [clearingAll, setClearingAll] = React.useState(false)
  async function clearAll(scope: 'week' | 'all') {
    const label = scope === 'week' ? `${format(weekStart, 'd MMM', { locale: trLocale })} – ${format(weekEnd, 'd MMM yyyy', { locale: trLocale })} haftasının bütün kayıtları (${visits.length} doktor)` : 'raporun BÜTÜN haftalarındaki tüm kayıtlar'
    if (!(await confirmAction(`${label} silinsin mi? Bu işlem geri alınamaz. (Cari Kart'taki doktor kartları silinmez.)`))) return
    setClearingAll(true)
    try {
      const n = scope === 'week' ? await deleteVisitsInRange(dateKey(weekStart), dateKey(weekEnd)) : await deleteVisitsInRange()
      toast.success(`${n} kayıt silindi`)
    } catch (err) {
      toast.error('Silinemedi', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setClearingAll(false)
      void queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      void queryClient.invalidateQueries({ queryKey: ['doctor_visit_dates'] })
    }
  }
  const goToDate = (value: string) => value && value <= dateKey(new Date()) && setWeekStart(startOfWeek(new Date(`${value}T00:00:00`), { weekStartsOn: 1 }))
  const isCurrentWeek = dateKey(weekStart) >= thisWeekKey

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const { data: weekPayments = [] } = usePayments({
    from: weekStart.toISOString(),
    to: new Date(weekEnd.getTime() + 86_399_000).toISOString(),
  })
  const { data: monthPayments = [] } = usePayments({ from: monthStart.toISOString() })

  const activeReps = salesReps.filter((r) => r.is_active)
  // Hızlı ekleme kutusundaki öneriler için Cari Kart doktorları
  const { data: customers = [] } = useCustomers('')

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
      <datalist id={DOCTOR_NAMES_LIST_ID}>
        {customers.map((c) => (
          <option key={c.id} value={c.full_name} />
        ))}
      </datalist>
      <PageHeader
        title="Haftalık Satış Temsilcisi Raporu"
        description="Her satış temsilcisinin isminin altında kendi haftalık doktor listesi"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="icon" title="Önceki hafta" onClick={() => setWeekStart((d) => subWeeks(d, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium whitespace-nowrap">
              {format(weekStart, 'd MMM', { locale: trLocale })} – {format(weekEnd, 'd MMM yyyy', { locale: trLocale })}
            </span>
            <Button variant="outline" size="icon" title="Sonraki hafta" disabled={isCurrentWeek} onClick={() => setWeekStart((d) => addWeeks(d, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            <Input type="date" className="w-40" title="Tarih seçin — o haftanın raporu açılır" max={dateKey(new Date())} value={dateKey(weekStart)} onChange={(e) => goToDate(e.target.value)} />
            <Select value={dateKey(weekStart)} onValueChange={goToDate}>
              <SelectTrigger className="w-56 gap-2 [&>span]:min-w-0 [&>span]:truncate" title="Kayıtlı Raporlar">
                <SelectValue placeholder="Kayıtlı Raporlar" />
              </SelectTrigger>
              <SelectContent>
                {!reportWeeks.some(([k]) => k === dateKey(weekStart)) && (
                  <SelectItem value={dateKey(weekStart)}>
                    {format(weekStart, 'd MMM yyyy', { locale: trLocale })} · boş
                  </SelectItem>
                )}
                {reportWeeks.filter(([k]) => k <= thisWeekKey).map(([k, n]) => (
                  <SelectItem key={k} value={k}>
                    {format(new Date(`${k}T00:00:00`), 'd MMM yyyy', { locale: trLocale })} · {n} doktor
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dateKey(weekStart) !== thisWeekKey && (
              <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Bu Hafta
              </Button>
            )}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={clearingAll}>
                  <Trash2 className="text-destructive" /> Kayıtları Sil
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!visits.length} onSelect={() => void clearAll('week')}>
                  Bu haftanın tüm kayıtlarını sil ({visits.length})
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onSelect={() => void clearAll('all')}>
                  Bütün kayıtları sil (tüm haftalar)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <RepWeekSection customers={customers}
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
