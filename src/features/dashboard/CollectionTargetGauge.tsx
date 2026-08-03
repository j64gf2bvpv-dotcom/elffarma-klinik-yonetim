import { Link } from 'react-router-dom'
import { Target } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadialGauge } from '@/components/charts/RadialGauge'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function CollectionTargetGauge({
  targetRevenue,
  collected,
  percent,
  remaining,
}: {
  targetRevenue: number | null
  collected: number
  percent: number | null
  remaining: number | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4 text-primary" /> Tahsilat Hedefi
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
        {targetRevenue == null ? (
          <p className="text-sm text-muted-foreground">
            Bu ay için henüz bir hedef girilmemiş.{' '}
            <Link to="/butce-yili" className="text-primary hover:underline">
              Bütçe Yılı
            </Link>{' '}
            sayfasından ekleyebilirsiniz.
          </p>
        ) : (
          <>
            <RadialGauge percent={percent ?? 0}>
              <span className="text-2xl font-semibold tabular-nums">%{Math.round(percent ?? 0)}</span>
            </RadialGauge>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Aylık Tahsilat Hedefi</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {currency(collected)} <span className="text-muted-foreground font-normal">/ {currency(targetRevenue)}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Kalan: {currency(remaining ?? 0)}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
