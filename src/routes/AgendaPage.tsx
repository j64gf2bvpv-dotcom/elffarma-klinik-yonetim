import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import { Presentation, Wallet, BellRing, CheckCircle2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { useReminders } from '@/features/reminders/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'

type AgendaEventType = 'reminder' | 'congress' | 'payment_due' | 'payment_paid'

interface AgendaEvent {
  id: string
  title: string
  start: string
  end?: string
  backgroundColor: string
  borderColor: string
  extendedProps: { type: AgendaEventType; linkId: string | null }
}

const typeMeta: Record<AgendaEventType, { icon: React.ElementType; color: string; label: string }> = {
  congress: { icon: Presentation, color: 'var(--color-primary)', label: 'Kongre / Workshop' },
  payment_due: { icon: Wallet, color: 'oklch(0.6 0.16 75)', label: 'Ödeme Vadesi' },
  payment_paid: { icon: CheckCircle2, color: 'var(--color-success)', label: 'Ödendi' },
  reminder: { icon: BellRing, color: 'oklch(0.55 0.2 38)', label: 'Hatırlatma' },
}

export function AgendaPage() {
  const navigate = useNavigate()
  const { data: reminders = [] } = useReminders()
  const { data: congresses = [] } = useCongresses()
  const { data: doctors = [] } = useCustomers('')
  const { data: allPayments = [] } = usePayments({})

  const paidByCustomer = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allPayments) map.set(p.customer_id, (map.get(p.customer_id) ?? 0) + Number(p.amount))
    return map
  }, [allPayments])

  const events = React.useMemo<AgendaEvent[]>(() => {
    const list: AgendaEvent[] = []

    for (const r of reminders) {
      if (r.is_done) continue
      list.push({
        id: `reminder-${r.id}`,
        title: r.title,
        start: r.due_date,
        backgroundColor: typeMeta.reminder.color,
        borderColor: typeMeta.reminder.color,
        extendedProps: { type: 'reminder', linkId: null },
      })
    }

    for (const c of congresses) {
      if (!c.start_date) continue
      list.push({
        id: `congress-${c.id}`,
        title: c.name,
        start: c.start_date,
        end: c.end_date ?? undefined,
        backgroundColor: typeMeta.congress.color,
        borderColor: typeMeta.congress.color,
        extendedProps: { type: 'congress', linkId: c.id },
      })
    }

    for (const d of doctors) {
      if (!d.next_payment_due) continue
      const remainingBalance = d.total_debt != null ? Number(d.total_debt) - (paidByCustomer.get(d.id) ?? 0) : null
      const isPaid = remainingBalance != null && remainingBalance <= 0
      const type: AgendaEventType = isPaid ? 'payment_paid' : 'payment_due'
      list.push({
        id: `payment-${d.id}`,
        title: isPaid ? `${d.full_name} — ödendi` : `${d.full_name} — ödeme vadesi`,
        start: d.next_payment_due,
        backgroundColor: typeMeta[type].color,
        borderColor: typeMeta[type].color,
        extendedProps: { type, linkId: d.id },
      })
    }

    return list
  }, [reminders, congresses, doctors, paidByCustomer])

  function handleEventClick(arg: EventClickArg) {
    const { type, linkId } = arg.event.extendedProps as AgendaEvent['extendedProps']
    if (type === 'congress' && linkId) navigate(`/kongreler/${linkId}`)
    if ((type === 'payment_due' || type === 'payment_paid') && linkId) navigate(`/musteriler/${linkId}`)
    if (type === 'reminder') navigate('/hatirlatmalar')
  }

  function renderEventContent(arg: EventContentArg) {
    const type = (arg.event.extendedProps as AgendaEvent['extendedProps']).type
    const Icon = typeMeta[type].icon
    return (
      <span className="flex items-center gap-1 truncate px-0.5">
        <Icon className="size-2.5 shrink-0" />
        <span className="truncate text-[11px] font-medium">{arg.event.title}</span>
      </span>
    )
  }

  return (
    <div>
      <PageHeader title="Ajanda" description="Kongreler, ödeme vadeleri ve hatırlatmaların takvim görünümü" />

      <div className="mb-4 flex flex-wrap gap-4">
        {Object.values(typeMeta).map((meta) => (
          <span key={meta.label} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
          </span>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={trLocale}
            height="auto"
            events={events}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
