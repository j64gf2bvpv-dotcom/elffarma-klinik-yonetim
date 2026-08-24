import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Trash2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/features/stock/hooks'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { CargoForm, EditCargoDialog } from './CargoForm'
import { useCargoShipments, useUpdateCargoStatus, useDeleteCargoShipment } from './hooks'
import type { CargoShipment, CargoStatus } from '@/types/database'

const statusLabel: Record<CargoStatus, string> = {
  bekletiliyor: 'Bekletiliyor',
  gonderilecek: 'Gönderilecek',
  gonderildi: 'Gönderildi',
}

const statusOptions: CargoStatus[] = ['bekletiliyor', 'gonderilecek', 'gonderildi']

const statusTriggerClass: Record<CargoStatus, string> = {
  bekletiliyor: 'border-secondary/40 bg-secondary/40 text-secondary-foreground',
  gonderilecek: 'border-warning/40 bg-warning/10 text-warning-foreground',
  gonderildi: 'border-success/40 bg-success/10 text-success-foreground',
}

/**
 * Stok Yönetimi > Kargo — hoca/müşteri, ürün ve gönderim tarihi bilgisiyle
 * kargo takibi. "Stok Durumu" o an products.current_quantity'ye bakılarak
 * CANLI hesaplanır (kaydedilmiş bir alan değil) — bkz. useProducts('') join'i.
 * "Durum" bir Select ile HER yöne serbestçe değiştirilebilir (kullanıcı
 * isteği, 2026-08-24 — önceden sadece ileri yönde, ok/onay ikonlarıyla
 * değiştirilebiliyordu, "Gönderildi"ye geldikten sonra geri dönüş hiç yoktu).
 * "Gönderildi"ye geçmek gerçek bir stok çıkışı, geri dönmek ise bir iade
 * hareketi tetikler (bkz. hooks.ts/api.ts).
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
                      <Select
                        value={shipment.status}
                        onValueChange={(value) => updateStatus.mutate({ shipment, status: value as CargoStatus })}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className={`h-8 w-40 font-medium ${statusTriggerClass[shipment.status]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabel[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shipment.ship_date ? format(new Date(shipment.ship_date), 'd MMM yyyy', { locale: trLocale }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <EditCargoDialog shipment={shipment} />
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(shipment)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
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
