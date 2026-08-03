import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ArrowDownRight, Stethoscope } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DoctorPerformanceCard({
  items,
}: {
  items: { id: string; name: string; revenue: number; deltaPct: number | null }[]
}) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="size-4 text-primary" /> Doktor Bazlı Satış Performansı
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/musteriler">
            Tümünü gör <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-1">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Bu ay için doktor bazlı satış verisi yok</p>}
        {items.map((item, i) => (
          <Link
            key={item.id}
            to={`/musteriler/${item.id}`}
            className="flex items-center gap-3 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-accent"
          >
            <span className="flex size-5 shrink-0 items-center justify-center text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(item.name)}</AvatarFallback>
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
