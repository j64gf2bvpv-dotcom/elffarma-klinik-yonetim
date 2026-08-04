import * as React from 'react'
import { addMonths, subMonths, format, isToday, isSameDay, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { tr as trLocaleDate } from 'date-fns/locale/tr'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WEEKDAY_LETTERS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

/** Her günün altına o gün düşen etkinlik türlerinin rengiyle küçük noktalar basan, ay gezinmeli mini takvim. */
export function MiniCalendar({
  month,
  onMonthChange,
  selected,
  onSelectDate,
  dotsByDay,
}: {
  month: Date
  onMonthChange: (month: Date) => void
  selected: Date | undefined
  onSelectDate: (date: Date) => void
  dotsByDay: Map<string, string[]>
}) {
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: trLocaleDate })}</p>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onMonthChange(subMonths(month, 1))}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_LETTERS.map((w) => (
          <span key={w} className="text-[10px] font-semibold tracking-wide text-muted-foreground">
            {w}
          </span>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dots = dotsByDay.get(key)
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const isSelected = selected && isSameDay(day, selected)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                'mx-auto flex size-7 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition-colors',
                !inMonth && 'text-muted-foreground/40',
                inMonth && !today && !isSelected && 'text-foreground hover:bg-accent',
                today && !isSelected && 'bg-destructive font-semibold text-white',
                isSelected && 'bg-primary font-semibold text-primary-foreground',
              )}
            >
              <span>{format(day, 'd')}</span>
              {dots && dots.length > 0 && (
                <span className="flex gap-0.5">
                  {dots.slice(0, 3).map((color, i) => (
                    <span
                      key={i}
                      className="size-1 rounded-full"
                      style={{ backgroundColor: isSelected || today ? 'currentColor' : color }}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
