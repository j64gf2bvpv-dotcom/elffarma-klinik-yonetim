import * as React from 'react'
import { format, isToday, isPast, differenceInCalendarDays, eachDayOfInterval } from 'date-fns'
import { tr as trLocaleDate } from 'date-fns/locale/tr'
import { Presentation, Wallet, BellRing, type LucideIcon } from 'lucide-react'

import { useReminders } from '@/features/reminders/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useCustomers } from '@/features/customers/hooks'

export type AgendaEventType = 'reminder' | 'congress' | 'payment_due'

export interface AgendaEvent {
  id: string
  title: string
  start: string
  end?: string
  type: AgendaEventType
  linkId: string | null
}

export const agendaTypeMeta: Record<AgendaEventType, { icon: LucideIcon; label: string; color: string }> = {
  congress: { icon: Presentation, label: 'Kongre / Workshop', color: 'var(--color-primary)' },
  payment_due: { icon: Wallet, label: 'Ödeme Vadesi', color: 'var(--color-warning)' },
  reminder: { icon: BellRing, label: 'Hatırlatma', color: 'var(--color-destructive)' },
}

/** Düz tek renk yerine, ikon rozeti/nokta gibi vurgu öğelerinde kullanılan
 * diyagonal açık→koyu gradyan — her tür kendi rengiyle ama "canlı" görünsün diye. */
export function agendaGradient(color: string): string {
  return `linear-gradient(135deg, color-mix(in oklab, ${color} 82%, white) 0%, color-mix(in oklab, ${color} 78%, black) 100%)`
}

export function isAgendaEventUrgent(dateStr: string): boolean {
  const date = new Date(dateStr)
  if (isPast(date) && !isToday(date)) return true
  return differenceInCalendarDays(date, new Date()) <= 3
}

export function buildAgendaTooltip(event: AgendaEvent): string {
  const meta = agendaTypeMeta[event.type]
  const dateLabel = event.end
    ? `${format(new Date(event.start), 'd MMMM yyyy', { locale: trLocaleDate })} – ${format(new Date(event.end), 'd MMMM yyyy', { locale: trLocaleDate })}`
    : format(new Date(event.start), 'd MMMM yyyy', { locale: trLocaleDate })
  return `${meta.label}: ${event.title}\n${dateLabel}`
}

/** Her günün altına o gün düşen etkinlik türlerinin renklerini eşleyen bir harita üretir — mini takvim noktaları için. */
export function buildAgendaDotsByDay(events: AgendaEvent[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const e of events) {
    const start = new Date(e.start)
    const end = e.end ? new Date(e.end) : start
    for (const day of eachDayOfInterval({ start, end })) {
      const key = format(day, 'yyyy-MM-dd')
      const colors = map.get(key) ?? []
      if (!colors.includes(agendaTypeMeta[e.type].color)) colors.push(agendaTypeMeta[e.type].color)
      map.set(key, colors)
    }
  }
  return map
}

/** Kongreler, ödeme vadeleri ve tamamlanmamış hatırlatmaları tek bir takvim etkinlik listesinde birleştirir. */
export function useAgendaEvents() {
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

  return { events, overdueReminders }
}
