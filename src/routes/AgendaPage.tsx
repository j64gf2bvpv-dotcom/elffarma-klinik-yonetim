import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg, EventInput, EventMountArg } from '@fullcalendar/core'
import { addDays } from 'date-fns'
import { BellRing } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
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
  function handleEventDidMount(arg: EventMountArg) {
    const tooltip = (arg.event.extendedProps as { tooltip?: string }).tooltip
    if (tooltip) arg.el.title = tooltip
  }

  function renderEventContent(arg: EventContentArg) {
    const type = arg.event.extendedProps.type as AgendaEventType | undefined
    if (!type) return null
    const meta = agendaTypeMeta[type]
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
          <Card>
            <CardContent className="pt-5">
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
            <CardContent className="flex flex-col gap-1 pt-5">
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Takvimler</p>
              {(Object.entries(agendaTypeMeta) as [AgendaEventType, (typeof agendaTypeMeta)[AgendaEventType]][]).map(
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
