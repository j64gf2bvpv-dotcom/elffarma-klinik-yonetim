import * as React from 'react'
import { Pencil, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { findManualRevenue, useManualRevenue, useSetManualRevenue } from './manualRevenue'

const currency = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 })

/** "1.250.000,50" / "1250000.5" / "1 250 000" → sayı */
function parseAmount(s: string): number | null {
  const t = s.replace(/[₺\s]/g, '')
  if (!t) return null
  const normalized = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Temsilci kartındaki ciro kutusu + elle giriş düğmesi (kullanıcı isteği, 2026-11-19). Elle tutar girilmişse o
 * gösterilir ("elle" etiketiyle); "Otomatiğe dön" tahsilatlardan hesaplanan tutara geri döner.
 */
export function RevenueCell({
  repId,
  repName,
  type,
  periodStart,
  autoValue,
  label,
  iconClassName,
}: {
  repId: string
  repName: string
  type: 'week' | 'month'
  periodStart: string
  autoValue: number
  label: string
  iconClassName?: string
}) {
  const { data: manualList = [] } = useManualRevenue()
  const setManual = useSetManualRevenue()
  const manual = findManualRevenue(manualList, repId, type, periodStart)
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const value = manual ? Number(manual.amount) : autoValue
  const parsed = parseAmount(draft)

  function save() {
    if (parsed == null) return
    setManual.mutate({ existingId: manual?.id, sales_rep_id: repId, period_type: type, period_start: periodStart, amount: parsed }, { onSuccess: () => setOpen(false) })
  }

  return (
    <div className="flex items-center gap-2">
      <Wallet className={cn('size-4 shrink-0', iconClassName)} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {label}
          {manual && <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">elle</span>}
        </p>
        <p className="font-semibold tabular-nums">{currency(value)}</p>
      </div>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(manual ? String(manual.amount).replace('.', ',') : '')
          setOpen(next)
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="ml-auto size-7 shrink-0" title={`${label} — elle gir`}>
            <Pencil className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-64 gap-3">
          <div>
            <p className="text-sm font-semibold">{repName} — {label}</p>
            <p className="text-xs text-muted-foreground">Tahsilatlardan hesaplanan: {currency(autoValue)}</p>
          </div>
          <Input
            autoFocus
            inputMode="decimal"
            placeholder="Tutar (₺)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="tabular-nums"
          />
          <div className="flex items-center justify-between gap-2">
            {manual ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                disabled={setManual.isPending}
                onClick={() => setManual.mutate({ existingId: manual.id, sales_rep_id: repId, period_type: type, period_start: periodStart, amount: null }, { onSuccess: () => setOpen(false) })}
              >
                Otomatiğe dön
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={save} disabled={parsed == null || setManual.isPending}>
              Kaydet
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
