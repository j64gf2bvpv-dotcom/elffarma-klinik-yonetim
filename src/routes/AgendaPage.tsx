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
  type AgendaDayEntry,
  type AgendaEventType,
} from '@/features/agenda/useAgendaEvents'

/** Kongre başlıklarının sonundaki tarih tekrarını atar ("… · 9–11 Ekim 2026"). */
function cleanTitle(t: string): string {
  return t.replace(/\s+·\s+[^·]*\d{4}\s*$/, '')
}

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

  // Günleri tamamen boyayan "arka plan" blokları kaldırıldı (kullanıcı isteği, 2026-10-28:
  // "etkinlikler tüm sayfayı kaplıyor, daha sade premium bir şey yap") — etkinlikler artık
  // soluk zeminli, solunda ince renk şeridi olan tek satırlık etiketler.
  const calendarEvents = React.useMemo<EventInput[]>(
    () => [
      ...events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        // FullCalendar'da bitiş günü hariç — son gün de etikette görünsün
        end: e.end ? addDays(new Date(e.end), 1).toISOString().slice(0, 10) : undefined,
        allDay: true,
        extendedProps: { type: e.type, linkId: e.linkId, urgent: isAgendaEventUrgent(e.start), tooltip: buildAgendaTooltip(e) },
      })),
    ],
    [events],
  )

  // Ay görünümünde etkinlikler gün başına küçük renkli bildirim noktaları (kullanıcı isteği,
  // 2026-10-28: "kutucuklar daha küçük olsa, üzerinde tarihlerde bildirim işaretleri olsa");
  // hafta / gün görünümünde etkinlikler normal şekilde.
  const [viewType, setViewType] = React.useState('dayGridMonth')
  const monthDotEvents = React.useMemo<EventInput[]>(
    () => [...dotsByDay].map(([day, entries]) => ({ id: `dots-${day}`, start: day, allDay: true, extendedProps: { dotEntries: entries } })),
    [dotsByDay],
  )

  function handleEventClick(arg: EventClickArg) {
    const dotEntries = arg.event.extendedProps.dotEntries as AgendaDayEntry[] | undefined
    if (dotEntries) {
      // Tek etkinlik varsa doğrudan ilgili kayda git; birden fazlaysa liste bilgi kutusunda
      if (dotEntries.length !== 1) return
      openEntry(dotEntries[0].type, dotEntries[0].linkId)
      return
    }
    const { type, linkId } = arg.event.extendedProps as { type?: AgendaEventType; linkId: string | null }
    if (type) openEntry(type, linkId)
  }

  function openEntry(type: AgendaEventType, linkId: string | null) {
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
    if (arg.event.extendedProps.dotEntries) return ['agenda-dots']
    return arg.event.extendedProps.urgent ? ['agenda-event', 'agenda-event-urgent'] : ['agenda-event']
  }

  // Fare üzerine geldiğinde (tıklamadan, sayfa değiştirmeden) etkinliğin tür/
  // tarih açıklamasını gösteren native tarayıcı tooltip'i (title attribute).
  // Aynı zamanda etkinlik kutucuğunun rengini de burada elle veriyoruz —
  // FullCalendar'ın varsayılan mavi arka planı (--fc-event-bg-color) hiç
  // ezilmediği için önceden tüm etkinlikler türden bağımsız aynı mavi kutuda
  // görünüyordu; artık her tür kendi rengiyle soluk bir zemin + sol şerit alıyor.
  // Takvimde etkinlik adları yazmıyor; üzerine gelince şık bir bilgi kutusu açılır
  // (kullanıcı isteği, 2026-10-28: "isimler yazmasın, üzerine gelince belirtsin, profesyonel olmalı")
  const [hover, setHover] = React.useState<{ x: number; y: number; above: boolean; items: { type: AgendaEventType; title: string; dates?: string }[] } | null>(null)
  function handleEventEnter(arg: { el: HTMLElement; event: { title: string; extendedProps: Record<string, unknown> } }) {
    const r = arg.el.getBoundingClientRect()
    const above = r.top > 200
    const pos = { x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above }
    const dotEntries = arg.event.extendedProps.dotEntries as AgendaDayEntry[] | undefined
    if (dotEntries) {
      setHover({ ...pos, items: dotEntries.slice(0, 8).map((d) => ({ type: d.type, title: cleanTitle(d.title) })) })
      return
    }
    const type = arg.event.extendedProps.type as AgendaEventType | undefined
    if (!type) return
    const tip = String(arg.event.extendedProps.tooltip ?? '')
    setHover({ ...pos, items: [{ type, title: cleanTitle(arg.event.title), dates: tip.split('\n')[1] ?? '' }] })
  }

  function handleEventDidMount(arg: EventMountArg) {
    const { type } = arg.event.extendedProps as { type?: AgendaEventType }
    arg.el.removeAttribute('title')
    if (arg.event.extendedProps.dotEntries) return
    if (type) {
      const color = agendaTypeMeta[type].color
      arg.el.style.setProperty('--agenda-color', color)
    }
  }

  function renderEventContent(arg: EventContentArg) {
    const dotEntries = arg.event.extendedProps.dotEntries as AgendaDayEntry[] | undefined
    if (dotEntries) {
      return (
        <span className="flex items-center justify-center gap-1" aria-label={dotEntries.map((d) => d.title).join(', ')}>
          {dotEntries.slice(0, 4).map((d, i) => (
            <span key={i} className="size-1.5 rounded-full" style={{ background: d.color }} />
          ))}
          {dotEntries.length > 4 && <span className="text-muted-foreground text-[9px] leading-none font-semibold">+{dotEntries.length - 4}</span>}
        </span>
      )
    }
    // Hafta / gün görünümü: ince renkli çizgi — ad / tarih üzerine gelince bilgi kutusunda
    return <span className="sr-only">{arg.event.title}</span>
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

        <Card className="animate-agenda-rise min-w-0 flex-1 self-start" style={{ animationDelay: '100ms' }}>
          <CardContent className="pt-6">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={trLocale}
              events={viewType === 'dayGridMonth' ? monthDotEvents : calendarEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventContent={renderEventContent}
              eventClassNames={eventClassNames}
              eventDidMount={handleEventDidMount}
              eventMouseEnter={handleEventEnter}
              eventMouseLeave={() => setHover(null)}
              datesSet={(arg) => {
                setMiniMonth(arg.view.currentStart)
                setViewType(arg.view.type)
              }}
              customButtons={{ today: { text: 'Bugün', click: goToday } }}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              buttonText={{ month: 'Ay', week: 'Hafta', day: 'Gün' }}
              dayMaxEvents={4}
              // Kompakt ay görünümü — kutucuklar daha küçük (2026-10-28)
              aspectRatio={2.4}
              moreLinkText={(n) => `+${n} daha`}
            />
          </CardContent>
        </Card>
      </div>
      {hover && (
        <div
          className="pointer-events-none fixed z-50 grid w-max max-w-80 gap-2 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
          style={{ left: hover.x, top: hover.y, transform: `translate(-50%, ${hover.above ? '-100%' : '0'})` }}
        >
          {hover.items.map((it, i) => (
            <div key={i}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: agendaTypeMeta[it.type].color }}>
                {React.createElement(agendaTypeMeta[it.type].icon, { className: 'size-3' })}
                {agendaTypeMeta[it.type].label}
              </div>
              <div className="mt-0.5 text-sm leading-snug font-semibold">{it.title}</div>
              {it.dates && <div className="text-muted-foreground mt-0.5 text-xs">{it.dates}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
