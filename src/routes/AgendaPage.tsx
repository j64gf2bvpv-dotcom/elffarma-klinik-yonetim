import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import { format, isToday, isTomorrow, isPast, differenceInCalendarDays } from 'date-fns'
import { tr as trLocaleDate } from 'date-fns/locale/tr'
import { Presentation, Wallet, BellRing, CalendarClock } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

const typeMeta: Record<
  AgendaEventType,
  { icon: React.ElementType; label: string; color: string; iconBoxClass: string; badgeClass: string }
> = {
  congress: {
    icon: Presentation,
    label: 'Kongre / Workshop',
    color: 'var(--color-primary)',
    iconBoxClass: 'bg-gradient-to-br from-primary/25 to-primary/5 text-primary ring-1 ring-primary/15',
    badgeClass: 'border-primary/20 bg-primary/10 text-primary',
  },
  payment_due: {
    icon: Wallet,
    label: 'Ödeme Vadesi',
    color: 'var(--color-warning)',
    iconBoxClass: 'bg-gradient-to-br from-warning/30 to-warning/5 text-warning-foreground ring-1 ring-warning/25',
    badgeClass: 'border-warning/25 bg-warning/15 text-warning-foreground',
  },
  reminder: {
    icon: BellRing,
    label: 'Hatırlatma',
    color: 'var(--color-destructive)',
    iconBoxClass: 'bg-gradient-to-br from-destructive/25 to-destructive/5 text-destructive ring-1 ring-destructive/20',
    badgeClass: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
}

function relativeDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Bugün'
  if (isTomorrow(date)) return 'Yarın'
  if (isPast(date)) {
    const days = Math.abs(differenceInCalendarDays(date, new Date()))
    return `${days} gün gecikti`
  }
  const days = differenceInCalendarDays(date, new Date())
  return `${days} gün sonra`
}

export function AgendaPage() {
  const navigate = useNavigate()
  const { data: reminders = [] } = useReminders()
  const { data: congresses = [] } = useCongresses()
  const { data: doctors = [] } = useCustomers('')

  const events = React.useMemo<AgendaEvent[]>(() => {
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

  const upcomingEvents = React.useMemo(
    () =>
      events
        .filter((e) => !isPast(new Date(e.start)) || isToday(new Date(e.start)))
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 8),
    [events],
  )

  const overdueReminders = React.useMemo(
    () => events.filter((e) => e.type === 'reminder' && isPast(new Date(e.start)) && !isToday(new Date(e.start))),
    [events],
  )

  function goToEvent(type: AgendaEventType, linkId: string | null) {
    if (type === 'congress' && linkId) navigate(`/kongreler/${linkId}`)
    if (type === 'payment_due' && linkId) navigate(`/musteriler/${linkId}`)
    if (type === 'reminder') navigate('/hatirlatmalar')
  }

  function handleEventClick(arg: EventClickArg) {
    const { type, linkId } = arg.event.extendedProps as { type: AgendaEventType; linkId: string | null }
    goToEvent(type, linkId)
  }

  function renderEventContent(arg: EventContentArg) {
    const type = (arg.event.extendedProps as { type: AgendaEventType }).type
    const meta = typeMeta[type]
    const Icon = meta.icon
    return (
      <span className="flex items-center gap-1 truncate px-0.5 py-px">
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

  return (
    <div>
      <PageHeader title="Ajanda" description="Kongreler, ödeme vadeleri ve hatırlatmaların takvim görünümü" />

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(typeMeta).map(([key, meta]) => (
          <span
            key={key}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              meta.badgeClass,
            )}
          >
            <meta.icon className="size-3.5" />
            {meta.label}
          </span>
        ))}
        {overdueReminders.length > 0 && (
          <span className="animate-alert-glow-red flex items-center gap-1.5 rounded-full border-transparent bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
            <BellRing className="size-3.5" />
            {overdueReminders.length} gecikmiş hatırlatma
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={trLocale}
              height="auto"
              events={events.map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                extendedProps: { type: e.type, linkId: e.linkId },
              }))}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              dayMaxEvents={3}
              moreLinkText={(n) => `+${n} daha`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" /> Yaklaşan Etkinlikler
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {upcomingEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">Yaklaşan bir etkinlik yok</p>
            )}
            {upcomingEvents.map((event) => {
              const meta = typeMeta[event.type]
              const overdue = event.type === 'reminder' && isPast(new Date(event.start)) && !isToday(new Date(event.start))
              return (
                <Link
                  key={event.id}
                  to="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToEvent(event.type, event.linkId)
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-2.5 text-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                    overdue && 'border-destructive/20 bg-destructive/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      meta.iconBoxClass,
                    )}
                  >
                    <meta.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {format(new Date(event.start), 'd MMMM yyyy', { locale: trLocaleDate })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0', overdue && 'animate-alert-glow-red border-transparent bg-destructive/15 text-destructive')}
                  >
                    {relativeDayLabel(event.start)}
                  </Badge>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
