import { Link } from 'react-router-dom'
import { format, differenceInCalendarDays, startOfDay } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ArrowRight, Presentation } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SafeThumbnail } from '@/components/SafeThumbnail'
import { cn } from '@/lib/utils'
import { placeholderColor } from '@/lib/placeholderColor'
import type { Congress } from '@/types/database'

export function UpcomingCongressesCard({ congresses }: { congresses: Congress[] }) {
  const today = new Date()
  const upcoming = congresses
    .filter((c) => {
      const end = c.end_date ?? c.start_date
      return end && new Date(end) >= startOfDay(today)
    })
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    .slice(0, 3)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Presentation className="size-4 text-primary" /> Yaklaşan Kongreler
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/kongreler">
            Tümünü gör <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-2">
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Yaklaşan kongre yok</p>}
        {upcoming.map((c) => {
          const start = c.start_date ? new Date(c.start_date) : null
          const daysLeft = start ? differenceInCalendarDays(start, today) : null
          return (
            <Link
              key={c.id}
              to={`/kongreler/${c.id}`}
              className="flex min-w-0 items-center gap-3 rounded-lg p-1.5 text-sm transition-colors hover:bg-accent"
            >
              <SafeThumbnail
                src={c.image_url}
                alt={c.name}
                className="size-12 shrink-0 rounded-lg border object-cover"
                fallback={
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg border text-white"
                    style={{ backgroundColor: placeholderColor(c.name) }}
                  >
                    <Presentation className="size-5" />
                  </span>
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.city ?? ''}
                  {start ? ` · ${format(start, 'd MMM yyyy', { locale: trLocale })}` : ''}
                </p>
              </div>
              {daysLeft != null && daysLeft >= 0 && (
                <Badge
                  variant="outline"
                  className={cn('shrink-0 text-[10px]', 'border-destructive/20 bg-destructive/10 text-destructive')}
                >
                  {daysLeft} gün kaldı
                </Badge>
              )}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
