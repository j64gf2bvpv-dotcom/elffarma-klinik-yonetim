import * as React from 'react'
import { History } from 'lucide-react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { tr } from '@/i18n/tr'
import { useStockMovements } from './hooks'
import type { Product } from '@/types/database'

export function StockHistoryDialog({ product }: { product: Product }) {
  const [open, setOpen] = React.useState(false)
  const { data: movements = [], isLoading } = useStockMovements(open ? product.id : undefined)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History className="size-4" /> Geçmiş
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hareket Geçmişi — {product.name}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead>Miktar</TableHead>
              <TableHead>Sebep / Not</TableHead>
              <TableHead>Doktor</TableHead>
              <TableHead>Personel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Hareket bulunamadı
                </TableCell>
              </TableRow>
            )}
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(m.created_at), 'd MMM yyyy HH:mm', { locale: trLocale })}
                </TableCell>
                <TableCell>
                  <Badge variant={m.movement_type === 'in' ? 'success' : m.movement_type === 'out' ? 'destructive' : 'secondary'}>
                    {tr.movementType[m.movement_type]}
                  </Badge>
                </TableCell>
                <TableCell>{m.quantity}</TableCell>
                <TableCell className="text-muted-foreground max-w-56">
                  <p>{m.reason ?? '—'}</p>
                  {m.note && <p className="text-xs">{m.note}</p>}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.customers?.full_name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{m.staff?.full_name ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
