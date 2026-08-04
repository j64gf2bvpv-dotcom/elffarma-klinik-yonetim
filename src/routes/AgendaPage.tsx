import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg, EventInput, EventMountArg } from '@fullcalendar/core'
import { addDays } from 'date-fns'
import { BellRing, ListFilter } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import {
  agendaTypeMeta,
  buildAgendaDotsByDay,
  buildAgendaTooltip,
  isAgendaEventUrgent,
  useAgendaEvents,
  type AgendaEventType,
} from '@/features/agenda/useAgendaEvents'

export function AgendaPage() {
  const navigate = useNavigate()
  const { events: allEvents, overdueReminders } = useAgendaEvents()
  const calendarRef = React.useRef<FullCalendar>(null)

  const [miniMonth, setMiniMonth] = React.useState(() => new Date())
  const [selectedDate, setSelectedDate] = React.useState<Date>()
  const [visibleTypes, setVisibleTypes] = React.useState<Set<AgendaEventType>>(
    () => new Set(Object.keys(agendaTypeMeta) as AgendaEventType[]),
  )

  function toggleType(type: AgendaEventType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const events = React.useMemo(
    () => allEvents.filter((e) => visibleTypes.has(e.type)),
    [allEvents, visibleTypes],
  )

  const dotsByDay = React.useMemo(() => buildAgendaDotsByDay(events), [events])

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
        backgroundColor: agendaTypeMeta[e.type].color,
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
        extendedProps: { type: e.type, linkId: e.linkId, urgent: isAgendaEventUrgent(e.start), tooltip: buildAgendaTooltip(e) },
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
  // Aynı zamanda etkinlik kutucuğunun rengini de burada elle veriyoruz —
  // FullCalendar'ın varsayılan mavi arka planı (--fc-event-bg-color) hiç
  // ezilmediği için önceden tüm etkinlikler türden bağımsız aynı mavi kutuda
  // görünüyordu; artık her tür kendi rengiyle soluk bir zemin + sol şerit alıyor.
  function handleEventDidMount(arg: EventMountArg) {
    const { type, tooltip } = arg.event.extendedProps as { type?: AgendaEventType; tooltip?: string }
    if (tooltip) arg.el.title = tooltip
    if (type) {
      const color = agendaTypeMeta[type].color
      arg.el.style.backgroundColor = `color-mix(in oklab, ${color} 15%, transparent)`
      arg.el.style.borderLeft = `2.5px solid ${color}`
      arg.el.style.color = 'var(--color-foreground)'
    }
  }

  function renderEventContent(arg: EventContentArg) {
    const type = arg.event.extendedProps.type as AgendaEventType | undefined
    if (!type) return null
    const meta = agendaTypeMeta[type]
    const Icon = meta.icon
    return (
      <span className="flex items-center gap-1 truncate px-0.5 py-px">
        <Icon className="size-2.5 shrink-0" style={{ color: meta.color }} strokeWidth={2.5} />
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
          <Card>
            <CardContent className="pt-6">
              <MiniCalendar
                month={miniMonth}
                onMonthChange={setMiniMonth}
                selected={selectedDate}
                onSelectDate={goToDate}
                dotsByDay={dotsByDay}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListFilter className="size-4 text-primary" /> Takvimler
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {(Object.entries(agendaTypeMeta) as [AgendaEventType, (typeof agendaTypeMeta)[AgendaEventType]][]).map(
                ([key, meta]) => {
                  const active = visibleTypes.has(key)
                  const count = allEvents.filter((e) => e.type === key).length
                  const Icon = meta.icon
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleType(key)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent',
                        !active && 'opacity-50',
                      )}
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 16%, transparent)`, color: meta.color }}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="flex-1 truncate font-medium">{meta.label}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                        style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
                      >
                        {count}
                      </span>
                    </button>
                  )
                },
              )}
              {overdueReminders.length > 0 && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-2 text-xs font-medium text-destructive">
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
