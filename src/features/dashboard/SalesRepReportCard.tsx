import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ArrowDownRight, UserRound } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { placeholderColor } from '@/lib/placeholderColor'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SalesRepReportCard({
  items,
}: {
  items: { id: string; name: string; revenue: number; deltaPct: number | null; photoUrl?: string | null }[]
}) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
          <UserRound className="size-4 text-primary" /> Satış Temsilcisi Raporu
          <span className="text-muted-foreground text-xs font-normal">Bu ay ciro</span>
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/doktor-ziyaretleri">
            Tümünü gör <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-1">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Aktif satış temsilcisi yok</p>}
        {items.map((item, i) => (
          <Link
            key={item.id}
            to="/doktor-ziyaretleri"
            className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-accent"
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <Avatar className="size-9 shrink-0">
              {item.photoUrl && <AvatarImage src={item.photoUrl} alt={item.name} />}
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: placeholderColor(item.name) }}
              >
                {getInitials(item.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums">{currency(item.revenue)}</p>
              {item.deltaPct != null && (
                <p
                  className={cn(
                    'flex items-center justify-end gap-0.5 text-xs font-medium',
                    item.deltaPct >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {item.deltaPct >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {Math.abs(item.deltaPct).toFixed(1)}%
                </p>
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
