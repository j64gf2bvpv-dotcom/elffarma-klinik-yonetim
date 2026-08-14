import * as React from 'react'
import { addMonths, subMonths, format, isToday, isSameDay, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { tr as trLocaleDate } from 'date-fns/locale/tr'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WEEKDAY_LETTERS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

export interface MiniCalendarDayEntry {
  color: string
  title: string
}

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
  dotsByDay: Map<string, MiniCalendarDayEntry[]>
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
      <div key={month.toISOString()} className="animate-agenda-rise grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAY_LETTERS.map((w) => (
          <span key={w} className="text-foreground/55 pb-1 text-[10.5px] font-bold tracking-wide">
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
            <div key={key} className="group relative mx-auto">
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  'mx-auto flex size-9 flex-col items-center justify-center gap-0.5 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-90',
                  !inMonth && 'text-muted-foreground/35',
                  inMonth && !today && !isSelected && 'text-foreground hover:scale-105 hover:bg-accent',
                  today && !isSelected && 'bg-destructive font-bold text-white',
                  isSelected && 'scale-110 bg-primary font-bold text-primary-foreground shadow-md',
                )}
              >
                <span>{format(day, 'd')}</span>
                <span className="flex h-1 gap-0.5">
                  {dots &&
                    dots.length > 0 &&
                    dots.slice(0, 3).map((entry, i) => (
                      <span
                        key={i}
                        className="size-1 rounded-full"
                        style={{ backgroundColor: isSelected || today ? 'currentColor' : entry.color }}
                      />
                    ))}
                </span>
              </button>
              {dots && dots.length > 0 && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 grid w-max max-w-48 -translate-x-1/2 gap-0.5 rounded-md bg-foreground px-2.5 py-1.5 text-left text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
                >
                  {dots.slice(0, 4).map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="truncate">{entry.title}</span>
                    </div>
                  ))}
                  {dots.length > 4 && <div className="text-background/70">+{dots.length - 4} daha</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
