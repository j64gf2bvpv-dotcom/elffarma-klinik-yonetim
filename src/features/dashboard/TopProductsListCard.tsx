import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ArrowDownRight, Package, Trophy } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SafeThumbnail } from '@/components/SafeThumbnail'
import { cn } from '@/lib/utils'
import { placeholderColor } from '@/lib/placeholderColor'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function TopProductsListCard({
  items,
}: {
  items: { id: string; name: string; qty: number; revenue: number; deltaPct: number | null; imageUrl?: string | null }[]
}) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
          <Trophy className="size-4 text-[oklch(0.72_0.16_70)]" /> En Çok Satan Ürünler
          <span className="text-muted-foreground text-xs font-normal">Son 90 gün</span>
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/satislar">
            Tümünü gör <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-1">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Bu ay henüz ürün satışı yok</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-2 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <SafeThumbnail
              src={item.imageUrl}
              alt={item.name}
              className="size-9 shrink-0 rounded-lg border object-cover"
              fallback={
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: placeholderColor(item.name) }}
                >
                  <Package className="size-4" />
                </span>
              }
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.qty} adet</p>
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
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
