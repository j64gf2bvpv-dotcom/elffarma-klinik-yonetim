import type * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Sparkline } from '@/components/charts/Sparkline'
import { cn } from '@/lib/utils'

const statTone = {
  gold: 'bg-primary/15 text-primary',
  purple: 'bg-[oklch(0.5_0.18_300)]/15 text-[oklch(0.55_0.2_300)]',
  green: 'bg-[oklch(0.55_0.15_155)]/15 text-[oklch(0.55_0.15_155)]',
  blue: 'bg-[oklch(0.55_0.18_250)]/15 text-[oklch(0.55_0.18_250)]',
  orange: 'bg-[oklch(0.68_0.16_55)]/15 text-[oklch(0.6_0.18_55)]',
} as const

const sparkColor: Record<keyof typeof statTone, string> = {
  gold: 'var(--color-primary)',
  purple: 'oklch(0.55 0.2 300)',
  green: 'oklch(0.55 0.15 155)',
  blue: 'oklch(0.55 0.18 250)',
  orange: 'oklch(0.6 0.18 55)',
}

export function StatCardSparkline({
  icon: Icon,
  tone,
  label,
  value,
  sublabel,
  deltaPct,
  sparkline,
  to,
}: {
  icon: React.ElementType
  tone: keyof typeof statTone
  label: string
  value: string
  sublabel: string
  deltaPct: number | null
  sparkline?: { value: number }[]
  to: string
}) {
  return (
    <Link to={to} className="block">
      <Card className="@container overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex min-w-0 items-center gap-3 pt-6">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', statTone[tone])}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase" title={label}>
              {label}
            </p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums" title={value}>
              {value}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{sublabel}</span>
              {deltaPct != null && (
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-0.5 font-medium',
                    deltaPct >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {deltaPct >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {Math.abs(deltaPct).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          {sparkline && sparkline.length > 1 && (
            <div className="hidden shrink-0 @[210px]:block">
              <Sparkline data={sparkline} color={sparkColor[tone]} width={72} height={32} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
