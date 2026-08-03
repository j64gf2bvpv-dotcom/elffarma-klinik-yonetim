import type * as React from 'react'
import { Link } from 'react-router-dom'
import { Receipt, HandCoins, ShoppingCart, UserPlus, Boxes, ReceiptText, CalendarPlus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const actionTone = {
  blue: 'bg-[oklch(0.55_0.18_250)]/12 text-[oklch(0.55_0.18_250)]',
  green: 'bg-[oklch(0.55_0.15_155)]/12 text-[oklch(0.55_0.15_155)]',
  purple: 'bg-[oklch(0.5_0.18_300)]/12 text-[oklch(0.55_0.2_300)]',
  gold: 'bg-primary/12 text-primary',
  teal: 'bg-[oklch(0.55_0.12_195)]/12 text-[oklch(0.5_0.12_195)]',
  orange: 'bg-[oklch(0.68_0.16_55)]/12 text-[oklch(0.6_0.18_55)]',
  red: 'bg-destructive/12 text-destructive',
} as const

const actions: { to: string; icon: React.ElementType; label: string; tone: keyof typeof actionTone }[] = [
  { to: '/satislar', icon: Receipt, label: 'Fatura Görüntüle', tone: 'blue' },
  { to: '/tahsilatlar', icon: HandCoins, label: 'Tahsilat Ekle', tone: 'green' },
  { to: '/satislar', icon: ShoppingCart, label: 'Yeni Satış', tone: 'gold' },
  { to: '/musteriler', icon: UserPlus, label: 'Yeni Cari', tone: 'purple' },
  { to: '/stok', icon: Boxes, label: 'Stok Durumu', tone: 'teal' },
  { to: '/giderler', icon: ReceiptText, label: 'Gider Ekle', tone: 'orange' },
  { to: '/ajanda', icon: CalendarPlus, label: 'Ajandaya Ekle', tone: 'red' },
]

export function QuickActionsRow() {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="group flex items-center gap-2.5 rounded-xl border border-border/60 px-3.5 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40"
          >
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', actionTone[action.tone])}>
              <action.icon className="size-4" />
            </span>
            {action.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
