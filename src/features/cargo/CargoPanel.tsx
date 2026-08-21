import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Trash2, PackageCheck, Clock } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProducts } from '@/features/stock/hooks'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { CargoForm } from './CargoForm'
import { useCargoShipments, useUpdateCargoStatus, useDeleteCargoShipment } from './hooks'
import type { CargoShipment, CargoStatus } from '@/types/database'

const statusLabel: Record<CargoStatus, string> = {
  bekletiliyor: 'Bekletiliyor',
  gonderilecek: 'Gönderilecek',
  gonderildi: 'Gönderildi',
}

const statusBadgeVariant: Record<CargoStatus, 'secondary' | 'warning' | 'success'> = {
  bekletiliyor: 'secondary',
  gonderilecek: 'warning',
  gonderildi: 'success',
}

/**
 * Stok Yönetimi > Kargo — hoca/müşteri, ürün ve gönderim tarihi bilgisiyle
 * kargo takibi. "Stok Durumu" o an products.current_quantity'ye bakılarak
 * CANLI hesaplanır (kaydedilmiş bir alan değil) — bkz. useProducts('') join'i.
 * "Gönderildi" işaretlemek gerçek bir stok çıkışı tetikler (bkz. hooks.ts).
 */
export function CargoPanel() {
  const { data: shipments = [], isLoading } = useCargoShipments()
  const { data: products = [] } = useProducts('')
  const updateStatus = useUpdateCargoStatus()
  const deleteMutation = useDeleteCargoShipment()
  const productById = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const { confirm, dialog } = useConfirmDialog()

  async function handleDelete(shipment: CargoShipment) {
    if (!(await confirm(`${shipment.recipient_name} için kargo kaydı silinsin mi?`))) return
    deleteMutation.mutate(shipment)
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <CargoForm />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alıcı</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Stok Durumu</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Gönderim Tarihi</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && shipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Henüz kargo kaydı yok
                  </TableCell>
                </TableRow>
              )}
              {shipments.map((shipment) => {
                const product = shipment.product_id ? productById.get(shipment.product_id) : undefined
                const inStock = product ? product.current_quantity >= shipment.quantity : null
                return (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-medium">
                      {shipment.recipient_name}
                      {(shipment.phone || shipment.address) && (
                        <p className="text-muted-foreground max-w-56 truncate text-xs">
                          {[shipment.phone, shipment.address].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shipment.product_name} × {shipment.quantity}
                    </TableCell>
                    <TableCell>
                      {inStock === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : inStock ? (
                        <Badge variant="success">Stokta Var</Badge>
                      ) : (
                        <Badge variant="destructive">Stokta Yok</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusBadgeVariant[shipment.status]}>{statusLabel[shipment.status]}</Badge>
                        {shipment.status === 'bekletiliyor' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gönderilecek olarak işaretle"
                            onClick={() => updateStatus.mutate({ shipment, status: 'gonderilecek' })}
                          >
                            <Clock className="size-4" />
                          </Button>
                        )}
                        {shipment.status !== 'gonderildi' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gönderildi olarak işaretle (stoktan düşer)"
                            onClick={() => updateStatus.mutate({ shipment, status: 'gonderildi' })}
                          >
                            <PackageCheck className="size-4 text-success" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shipment.ship_date ? format(new Date(shipment.ship_date), 'd MMM yyyy', { locale: trLocale }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(shipment)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {dialog}
    </div>
  )
}
