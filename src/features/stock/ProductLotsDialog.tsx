import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Layers } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getExpiryStatus } from '@/lib/expiry'
import { useProductLots } from './hooks'
import type { Product } from '@/types/database'

export function ProductLotsDialog({ product }: { product: Product }) {
  const [open, setOpen] = React.useState(false)
  const { data: lots = [], isLoading } = useProductLots(open ? product.id : undefined)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Layers className="size-4" /> Lotlar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lotlar — {product.name}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot No</TableHead>
              <TableHead>SKT</TableHead>
              <TableHead>Depo / Raf</TableHead>
              <TableHead>Tedarikçi</TableHead>
              <TableHead className="text-right">Miktar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lots.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Bu ürün için lot kaydı yok
                </TableCell>
              </TableRow>
            )}
            {lots.map((lot) => {
              const status = getExpiryStatus(lot.expiry_date, 90)
              return (
                <TableRow key={lot.id}>
                  <TableCell className="font-medium">{lot.lot_no ?? '—'}</TableCell>
                  <TableCell>
                    {lot.expiry_date ? (
                      <Badge variant={status === 'expired' ? 'destructive' : status === 'soon' ? 'warning' : 'outline'}>
                        {format(new Date(lot.expiry_date), 'd MMM yyyy', { locale: trLocale })}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[lot.warehouse, lot.shelf].filter(Boolean).join(' / ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lot.supplier ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{lot.quantity}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
