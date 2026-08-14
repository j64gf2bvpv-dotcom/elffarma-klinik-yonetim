import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, isPast, isToday, startOfDay } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ArrowRight, CalendarDays } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { cn } from '@/lib/utils'
import { agendaTypeMeta, buildAgendaDotsByDay, useAgendaEvents } from '@/features/agenda/useAgendaEvents'

const AGENDA_LINK: Record<string, (linkId: string) => string> = {
  congress: (id) => `/kongreler/${id}`,
  payment_due: (id) => `/musteriler/${id}`,
  reminder: () => '/hatirlatmalar',
}

/**
 * Ana Panel'de Ajanda'ya kısayol veren kart — mini takvimin altında, Ajanda'da
 * (hatırlatma/kongre/ödeme vadesi) eklenen yaklaşan önemli tarihlerin gerçek
 * bir listesi de var; önceden sadece takvimde renkli nokta olarak duruyorlardı,
 * başlık/tarih olarak okunamıyordu.
 */
export function AgendaMiniCard() {
  const navigate = useNavigate()
  const { events } = useAgendaEvents()
  const [month, setMonth] = React.useState(() => new Date())
  const dotsByDay = React.useMemo(() => buildAgendaDotsByDay(events), [events])

  const upcoming = React.useMemo(() => {
    const today = startOfDay(new Date())
    return events
      .filter((e) => new Date(e.start) >= today)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 5)
  }, [events])

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-primary" /> Ajanda
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ajanda">
            Tümünü gör <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <MiniCalendar
          month={month}
          onMonthChange={setMonth}
          selected={undefined}
          onSelectDate={() => navigate('/ajanda')}
          dotsByDay={dotsByDay}
        />
        <div className="grid gap-1.5">
          {upcoming.length === 0 && <p className="text-muted-foreground text-sm">Yaklaşan önemli tarih yok</p>}
          {upcoming.map((e) => {
            const meta = agendaTypeMeta[e.type]
            const Icon = meta.icon
            const overdue = isPast(new Date(e.start)) && !isToday(new Date(e.start))
            return (
              <Link
                key={e.id}
                to={e.linkId ? AGENDA_LINK[e.type](e.linkId) : '/ajanda'}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border p-2 text-sm transition-colors hover:bg-accent',
                  overdue && 'border-destructive/20 bg-destructive/5',
                )}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 15%, transparent)`, color: meta.color }}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                <Badge
                  variant="outline"
                  className={cn('shrink-0', overdue && 'border-transparent bg-destructive/15 text-destructive')}
                >
                  {format(new Date(e.start), 'd MMM', { locale: trLocale })}
                </Badge>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
