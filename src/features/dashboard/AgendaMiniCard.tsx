import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { buildAgendaDotsByDay, useAgendaEvents } from '@/features/agenda/useAgendaEvents'

/**
 * Ana Panel'de Ajanda'ya kısayol veren, o ayın etkinlik noktalarını gösteren
 * mini takvim kartı — bir tarihin altındaki noktanın üzerine gelince o
 * güne düşen etkinliklerin kısa bir listesi (başlık) tooltip olarak çıkar
 * (bkz. MiniCalendar), ayrıca bir liste tutulmuyor — kartın altta ayrı bir
 * etkinlik listesiyle uzayıp Ana Panel'deki diğer kartlarla boy uyuşmazlığı
 * yaratması istenmedi.
 */
export function AgendaMiniCard() {
  const navigate = useNavigate()
  const { events } = useAgendaEvents()
  const [month, setMonth] = React.useState(() => new Date())
  const dotsByDay = React.useMemo(() => buildAgendaDotsByDay(events), [events])

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
      <CardContent>
        <MiniCalendar
          month={month}
          onMonthChange={setMonth}
          selected={undefined}
          onSelectDate={() => navigate('/ajanda')}
          dotsByDay={dotsByDay}
        />
      </CardContent>
    </Card>
  )
}
