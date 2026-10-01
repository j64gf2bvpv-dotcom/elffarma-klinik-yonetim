import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCustomerStockMovements } from '@/features/stock/hooks'
import { tr } from '@/i18n/tr'
import { cn } from '@/lib/utils'
import type { MovementType } from '@/types/database'

/** Stoğu artıran türler — Stok Kartı defteriyle (stockCardReport) aynı tanım. */
const INCREASES_STOCK: ReadonlySet<MovementType> = new Set(['in', 'return', 'adjustment'])

/**
 * Cari Kart > Stok Hareketleri (kullanıcı isteği, 2026-10-01: "cari isimdeki
 * kişileri stokla birbirine bağla, gelen giden aldığı ürün ve benzeri
 * olduğunda bilgilerine eklensin") — bu doktora bağlı tüm stok hareketleri:
 * satış, iade, numune, kargo ve Stok Kartı'ndan doktor seçilerek elle girilen
 * giriş/çıkışlar. Ürün bazında toplam giden/gelen özeti üstte.
 */
export function CustomerStockMovementsTab({ customerId }: { customerId: string }) {
  const { data: movements = [], isLoading } = useCustomerStockMovements(customerId)

  const totals = new Map<string, { name: string; out: number; back: number; unit: string }>()
  for (const m of movements) {
    const name = m.products?.name ?? 'Bilinmeyen ürün'
    const key = `${m.product_id}-${m.unit_kind}`
    const t = totals.get(key) ?? { name, out: 0, back: 0, unit: m.unit_kind === 'flakon' ? 'flakon' : 'paket' }
    if (INCREASES_STOCK.has(m.movement_type)) t.back += m.quantity
    else t.out += m.quantity
    totals.set(key, t)
  }

  return (
    <div className="grid gap-4">
      {totals.size > 0 && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4">
            {[...totals.values()]
              .sort((a, b) => b.out - a.out)
              .map((t) => (
                <Badge key={t.name + t.unit} variant="secondary" className="gap-1.5 py-1">
                  <span className="font-semibold">{t.name}</span>
                  {t.out > 0 && <span className="text-destructive">↑ {t.out} {t.unit} gitti</span>}
                  {t.back > 0 && <span className="text-success">↓ {t.back} {t.unit} geldi</span>}
                </Badge>
              ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Sebep / Not</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Bu kişiye bağlı stok hareketi yok. Stok Kartı'nda "Giriş / Çıkış Ekle" penceresinden doktor seçerek
                    bağlayabilirsiniz; satış, iade, numune ve kargolar otomatik bağlanır.
                  </TableCell>
                </TableRow>
              )}
              {movements.map((m) => {
                const isIn = INCREASES_STOCK.has(m.movement_type)
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(m.created_at), 'd MMM yyyy HH:mm', { locale: trLocale })}
                    </TableCell>
                    <TableCell className="font-medium">{m.products?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={isIn ? 'success' : 'outline'}>{tr.movementType[m.movement_type] ?? m.movement_type}</Badge>
                    </TableCell>
                    <TableCell className={cn('whitespace-nowrap font-medium tabular-nums', isIn ? 'text-success' : 'text-destructive')}>
                      <span className="inline-flex items-center gap-1">
                        {isIn ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                        {m.quantity} {m.unit_kind === 'flakon' ? 'Flakon' : 'Paket'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground min-w-48 whitespace-normal break-words">
                      {m.reason ?? m.note ?? '—'}
                      {m.reason && m.note && m.note !== m.reason && <div className="text-xs opacity-80">{m.note}</div>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
