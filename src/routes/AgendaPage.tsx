import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import { addDays, isToday, isPast, differenceInCalendarDays } from 'date-fns'
import { Presentation, Wallet, BellRing } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
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

const typeMeta: Record<AgendaEventType, { icon: React.ElementType; label: string; color: string; badgeClass: string }> = {
  congress: {
    icon: Presentation,
    label: 'Kongre / Workshop',
    color: 'var(--color-primary)',
    badgeClass: 'border-primary/20 bg-primary/10 text-primary',
  },
  payment_due: {
    icon: Wallet,
    label: 'Ödeme Vadesi',
    color: 'var(--color-warning)',
    badgeClass: 'border-warning/25 bg-warning/15 text-warning-foreground',
  },
  reminder: {
    icon: BellRing,
    label: 'Hatırlatma',
    color: 'var(--color-destructive)',
    badgeClass: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
}

function isUrgent(dateStr: string): boolean {
  const date = new Date(dateStr)
  if (isPast(date) && !isToday(date)) return true
  return differenceInCalendarDays(date, new Date()) <= 3
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

  const overdueReminders = React.useMemo(
    () => events.filter((e) => e.type === 'reminder' && isPast(new Date(e.start)) && !isToday(new Date(e.start))),
    [events],
  )

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
        extendedProps: { type: e.type, linkId: e.linkId, urgent: isUrgent(e.start) },
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

  return (
    <div>
      <PageHeader title="Ajanda" description="Kongreler, ödeme vadeleri ve hatırlatmaların takvim görünümü" />

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(typeMeta).map(([key, meta]) => (
          <span
            key={key}
            className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', meta.badgeClass)}
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

      <Card>
        <CardContent className="pt-6">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={trLocale}
            height="auto"
            events={calendarEvents}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
            eventClassNames={eventClassNames}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            dayMaxEvents={3}
            moreLinkText={(n) => `+${n} daha`}
          />
        </CardContent>
      </Card>
    </div>
  )
}
