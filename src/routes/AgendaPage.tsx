import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg, EventInput, EventMountArg } from '@fullcalendar/core'
import {
  addDays,
  addMonths,
  subMonths,
  format,
  isToday,
  isPast,
  isSameDay,
  isSameMonth,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns'
import { tr as trLocaleDate } from 'date-fns/locale/tr'
import { ChevronLeft, ChevronRight, Presentation, Wallet, BellRing } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReminders } from '@/features/reminders/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useCustomers } from '@/features/customers/hooks'

type AgendaEventType = 'reminder' | 'congress' | 'payment_due'

interface AgendaEvent {
  id: string
  title: string
  start: string
  end?: string
  type: AgendaEventType
  linkId: string | null
}

const typeMeta: Record<AgendaEventType, { icon: React.ElementType; label: string; color: string }> = {
  congress: { icon: Presentation, label: 'Kongre / Workshop', color: 'var(--color-primary)' },
  payment_due: { icon: Wallet, label: 'Ödeme Vadesi', color: 'var(--color-warning)' },
  reminder: { icon: BellRing, label: 'Hatırlatma', color: 'var(--color-destructive)' },
}

const WEEKDAY_LETTERS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

function isUrgent(dateStr: string): boolean {
  const date = new Date(dateStr)
  if (isPast(date) && !isToday(date)) return true
  return differenceInCalendarDays(date, new Date()) <= 3
}

function buildTooltip(event: AgendaEvent): string {
  const meta = typeMeta[event.type]
  const dateLabel = event.end
    ? `${format(new Date(event.start), 'd MMMM yyyy', { locale: trLocaleDate })} – ${format(new Date(event.end), 'd MMMM yyyy', { locale: trLocaleDate })}`
    : format(new Date(event.start), 'd MMMM yyyy', { locale: trLocaleDate })
  return `${meta.label}: ${event.title}\n${dateLabel}`
}

/** Her günün altına o gün düşen etkinlik türlerinin rengiyle küçük noktalar basan, ay gezinmeli mini takvim. */
function MiniCalendar({
  month,
  onMonthChange,
  selected,
  onSelectDate,
  dotsByDay,
}: {
  month: Date
  onMonthChange: (month: Date) => void
  selected: Date | undefined
  onSelectDate: (date: Date) => void
  dotsByDay: Map<string, string[]>
}) {
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: trLocaleDate })}</p>
          <div className="flex gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => onMonthChange(subMonths(month, 1))}
              aria-label="Önceki ay"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => onMonthChange(addMonths(month, 1))}
              aria-label="Sonraki ay"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_LETTERS.map((w) => (
            <span key={w} className="text-[10px] font-semibold tracking-wide text-muted-foreground">
              {w}
            </span>
          ))}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dots = dotsByDay.get(key)
            const inMonth = isSameMonth(day, month)
            const today = isToday(day)
            const isSelected = selected && isSameDay(day, selected)
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  'mx-auto flex size-7 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition-colors',
                  !inMonth && 'text-muted-foreground/40',
                  inMonth && !today && !isSelected && 'text-foreground hover:bg-accent',
                  today && !isSelected && 'bg-destructive font-semibold text-white',
                  isSelected && 'bg-primary font-semibold text-primary-foreground',
                )}
              >
                <span>{format(day, 'd')}</span>
                {dots && dots.length > 0 && (
                  <span className="flex gap-0.5">
                    {dots.slice(0, 3).map((color, i) => (
                      <span
                        key={i}
                        className="size-1 rounded-full"
                        style={{ backgroundColor: isSelected || today ? 'currentColor' : color }}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function AgendaPage() {
  const navigate = useNavigate()
  const { data: reminders = [] } = useReminders()
  const { data: congresses = [] } = useCongresses()
  const { data: doctors = [] } = useCustomers('')
  const calendarRef = React.useRef<FullCalendar>(null)

  const [miniMonth, setMiniMonth] = React.useState(() => new Date())
  const [selectedDate, setSelectedDate] = React.useState<Date>()
  const [visibleTypes, setVisibleTypes] = React.useState<Set<AgendaEventType>>(
    () => new Set(Object.keys(typeMeta) as AgendaEventType[]),
  )

  function toggleType(type: AgendaEventType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const allEvents = React.useMemo<AgendaEvent[]>(() => {
    const list: AgendaEvent[] = []

    for (const r of reminders) {
      if (r.is_done) continue
      list.push({ id: `reminder-${r.id}`, title: r.title, start: r.due_date, type: 'reminder', linkId: null })
    }

    for (const c of congresses) {
      if (!c.start_date) continue
      list.push({
        id: `congress-${c.id}`,
        title: c.name,
        start: c.start_date,
        end: c.end_date ?? undefined,
        type: 'congress',
        linkId: c.id,
      })
    }

    for (const d of doctors) {
      if (!d.next_payment_due) continue
      list.push({
        id: `payment-${d.id}`,
        title: `${d.full_name} — ödeme vadesi`,
        start: d.next_payment_due,
        type: 'payment_due',
        linkId: d.id,
      })
    }

    return list
  }, [reminders, congresses, doctors])

  const events = React.useMemo(
    () => allEvents.filter((e) => visibleTypes.has(e.type)),
    [allEvents, visibleTypes],
  )

  const overdueReminders = React.useMemo(
    () => allEvents.filter((e) => e.type === 'reminder' && isPast(new Date(e.start)) && !isToday(new Date(e.start))),
    [allEvents],
  )

  const dotsByDay = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of events) {
      const start = new Date(e.start)
      const end = e.end ? new Date(e.end) : start
      for (const day of eachDayOfInterval({ start, end })) {
        const key = format(day, 'yyyy-MM-dd')
        const colors = map.get(key) ?? []
        if (!colors.includes(typeMeta[e.type].color)) colors.push(typeMeta[e.type].color)
        map.set(key, colors)
      }
    }
    return map
  }, [events])

  // Sadece ince bir etkinlik çubuğu değil, önemli her tarihin (hatırlatma,
  // ödeme vadesi, kongre/workshop) denk geldiği takvim kutucuğunun TAMAMI
  // türüne göre renkle boyansın diye FullCalendar'ın "background" etkinlik
  // özelliği kullanılıyor. Çok günlü kongrelerde FullCalendar'da end tarihi
  // HARİÇ olduğu için son günün de boyanması adına end tarihine 1 gün
  // ekleniyor; tek günlük etkinliklerde sadece o günün kendisi boyanıyor.
  const backgroundEvents = React.useMemo<EventInput[]>(
    () =>
      events.map((e) => ({
        id: `${e.id}-bg`,
        start: e.start,
        end: e.end ? addDays(new Date(e.end), 1).toISOString().slice(0, 10) : undefined,
        display: 'background' as const,
        backgroundColor: typeMeta[e.type].color,
      })),
    [events],
  )

  const calendarEvents = React.useMemo<EventInput[]>(
    () => [
      ...events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        extendedProps: { type: e.type, linkId: e.linkId, urgent: isUrgent(e.start), tooltip: buildTooltip(e) },
      })),
      ...backgroundEvents,
    ],
    [events, backgroundEvents],
  )

  function handleEventClick(arg: EventClickArg) {
    const { type, linkId } = arg.event.extendedProps as { type?: AgendaEventType; linkId: string | null }
    if (!type) return
    if (type === 'congress' && linkId) navigate(`/kongreler/${linkId}`)
    if (type === 'payment_due' && linkId) navigate(`/musteriler/${linkId}`)
    if (type === 'reminder') navigate('/hatirlatmalar')
  }

  function eventClassNames(arg: { event: { extendedProps: Record<string, unknown> } }) {
    if (arg.event.extendedProps.urgent) return ['animate-alert-glow-red']
    return []
  }

  // Fare üzerine geldiğinde (tıklamadan, sayfa değiştirmeden) etkinliğin tür/
  // tarih açıklamasını gösteren native tarayıcı tooltip'i (title attribute).
  function handleEventDidMount(arg: EventMountArg) {
    const tooltip = (arg.event.extendedProps as { tooltip?: string }).tooltip
    if (tooltip) arg.el.title = tooltip
  }

  function renderEventContent(arg: EventContentArg) {
    const type = arg.event.extendedProps.type as AgendaEventType | undefined
    if (!type) return null
    const meta = typeMeta[type]
    const Icon = meta.icon
    return (
      <span className="flex items-center gap-1 truncate rounded px-0.5 py-px">
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: meta.color }}
        >
          <Icon className="size-2 text-white" strokeWidth={2.5} />
        </span>
        <span className="truncate text-[11px] font-medium">{arg.event.title}</span>
      </span>
    )
  }

  function goToDate(date: Date) {
    setSelectedDate(date)
    setMiniMonth(date)
    calendarRef.current?.getApi().gotoDate(date)
  }

  function goToday() {
    goToDate(new Date())
  }

  return (
    <div>
      <PageHeader title="Ajanda" description="Kongreler, ödeme vadeleri ve hatırlatmaların takvim görünümü" />

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-4 lg:w-64">
          <MiniCalendar
            month={miniMonth}
            onMonthChange={setMiniMonth}
            selected={selectedDate}
            onSelectDate={goToDate}
            dotsByDay={dotsByDay}
          />

          <Card>
            <CardContent className="flex flex-col gap-1 pt-5">
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Takvimler</p>
              {(Object.entries(typeMeta) as [AgendaEventType, (typeof typeMeta)[AgendaEventType]][]).map(
                ([key, meta]) => {
                  const active = visibleTypes.has(key)
                  const count = allEvents.filter((e) => e.type === key).length
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleType(key)}
                      className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span
                        className="flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                        style={{
                          borderColor: meta.color,
                          backgroundColor: active ? meta.color : 'transparent',
                        }}
                      />
                      <span className={cn('flex-1 truncate', !active && 'text-muted-foreground line-through')}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    </button>
                  )
                },
              )}
              {overdueReminders.length > 0 && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-1.5 py-1.5 text-xs font-medium text-destructive">
                  <BellRing className="size-3.5 shrink-0" />
                  {overdueReminders.length} gecikmiş hatırlatma
                </p>
              )}
            </CardContent>
          </Card>
        </aside>

        <Card className="min-w-0 flex-1">
          <CardContent className="pt-6">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={trLocale}
              height="auto"
              events={calendarEvents}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              eventClassNames={eventClassNames}
              eventDidMount={handleEventDidMount}
              datesSet={(arg) => setMiniMonth(arg.view.currentStart)}
              customButtons={{ today: { text: 'Bugün', click: goToday } }}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              buttonText={{ month: 'Ay', week: 'Hafta', day: 'Gün' }}
              dayMaxEvents={3}
              moreLinkText={(n) => `+${n} daha`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
