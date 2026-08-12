import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg, EventInput, EventMountArg } from '@fullcalendar/core'
import { addDays, isToday, isSameMonth } from 'date-fns'
import { BellRing, ListFilter, CalendarCheck2, CalendarClock, AlertCircle } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { useReminders } from '@/features/reminders/hooks'
import { ReminderForm } from '@/features/reminders/ReminderForm'
import type { Reminder } from '@/types/database'
import {
  agendaGradient,
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
  const { data: reminders = [] } = useReminders()
  const calendarRef = React.useRef<FullCalendar>(null)

  const [editingReminder, setEditingReminder] = React.useState<Reminder | null>(null)
  const [editReminderOpen, setEditReminderOpen] = React.useState(false)
  const [quickAddDate, setQuickAddDate] = React.useState<string>()
  const [quickAddOpen, setQuickAddOpen] = React.useState(false)

  const [miniMonth, setMiniMonth] = React.useState(() => new Date())
  const [selectedDate, setSelectedDate] = React.useState<Date>()
  const [visibleTypes, setVisibleTypes] = React.useState<Set<AgendaEventType>>(
    () => new Set(Object.keys(agendaTypeMeta) as AgendaEventType[]),
  )

  const now = React.useMemo(() => new Date(), [])
  const monthCount = React.useMemo(
    () => allEvents.filter((e) => isSameMonth(new Date(e.start), now)).length,
    [allEvents, now],
  )
  const todayCount = React.useMemo(
    () =>
      allEvents.filter((e) => {
        const start = new Date(e.start)
        const end = e.end ? new Date(e.end) : start
        return start <= now && now <= end ? true : isToday(start)
      }).length,
    [allEvents, now],
  )
  const monthCountAnimated = useCountUp(monthCount)
  const todayCountAnimated = useCountUp(todayCount)
  const overdueCountAnimated = useCountUp(overdueReminders.length)

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
    if (type === 'reminder' && linkId) {
      const reminder = reminders.find((r) => r.id === linkId)
      if (reminder) {
        setEditingReminder(reminder)
        setEditReminderOpen(true)
      }
    }
  }

  function handleDateClick(arg: DateClickArg) {
    setQuickAddDate(arg.dateStr)
    setQuickAddOpen(true)
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
        <Icon className="size-2.5 shrink-0" style={{ color: meta.color }} strokeWidth={2.75} />
        <span className="truncate text-[11.5px] font-semibold">{arg.event.title}</span>
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

  const stats = [
    { label: 'Bu Ay', value: monthCountAnimated, icon: CalendarClock, tone: 'var(--color-primary)' },
    { label: 'Bugün', value: todayCountAnimated, icon: CalendarCheck2, tone: 'var(--color-success)' },
    { label: 'Gecikmiş', value: overdueCountAnimated, icon: AlertCircle, tone: 'var(--color-destructive)' },
  ]

  return (
    <div>
      <PageHeader
        title="Ajanda"
        description="Kongreler, ödeme vadeleri ve hatırlatmaların takvim görünümü — bir güne tıklayarak not/hatırlatma ekleyebilirsiniz"
        actions={<ReminderForm />}
      />

      <ReminderForm
        hideTrigger
        defaultDate={quickAddDate}
        open={quickAddOpen}
        onOpenChange={(next) => {
          setQuickAddOpen(next)
          if (!next) setQuickAddDate(undefined)
        }}
      />
      {editingReminder && (
        <ReminderForm
          hideTrigger
          reminder={editingReminder}
          open={editReminderOpen}
          onOpenChange={(next) => {
            setEditReminderOpen(next)
            if (!next) setEditingReminder(null)
          }}
        />
      )}

      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-lg">
        {stats.map((s, i) => (
          <Card
            key={s.label}
            className="animate-agenda-rise overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardContent className="flex items-center gap-2.5 px-3 py-3">
              <span
                className="animate-agenda-gradient flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                style={{ background: agendaGradient(s.tone) }}
              >
                <s.icon className="size-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl leading-none font-bold tabular-nums">{Math.round(s.value)}</p>
                <p className="text-foreground/60 truncate text-[11px] font-semibold tracking-wide uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-4 lg:w-64">
          <Card className="animate-agenda-rise" style={{ animationDelay: '120ms' }}>
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

          <Card className="animate-agenda-rise" style={{ animationDelay: '180ms' }}>
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
                        'flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-all duration-150 hover:translate-x-0.5 hover:bg-accent',
                        !active && 'opacity-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
                          active && 'animate-agenda-gradient',
                        )}
                        style={{ background: agendaGradient(meta.color) }}
                      >
                        <Icon className="size-4" strokeWidth={2.25} />
                      </span>
                      <span className="flex-1 truncate font-semibold">{meta.label}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums text-white"
                        style={{ background: agendaGradient(meta.color) }}
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

        <Card className="animate-agenda-rise min-w-0 flex-1" style={{ animationDelay: '100ms' }}>
          <CardContent className="pt-6">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={trLocale}
              height="auto"
              events={calendarEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
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
