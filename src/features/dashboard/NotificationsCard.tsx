import { Link } from 'react-router-dom'
import { ArrowRight, Bell } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NotificationItem } from './useDashboardData'

export function NotificationsCard({ items }: { items: NotificationItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-primary" /> Bildirimler
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/hatirlatmalar">
            Tümünü gör <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Yeni bildirim yok</p>}
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className="flex min-w-0 items-start gap-3 rounded-lg px-1 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <span
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                item.tone === 'primary' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
              )}
            >
              <item.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="text-muted-foreground truncate text-xs">{item.subtitle}</p>
            </div>
            {item.createdAt && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDistanceToNowStrict(new Date(item.createdAt), { locale: trLocale, addSuffix: true })}
              </span>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
