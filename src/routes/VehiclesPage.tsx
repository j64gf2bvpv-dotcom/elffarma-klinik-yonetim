import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Pencil, Trash2, CheckCircle2, XCircle, Fuel } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { VehicleDialog } from '@/features/vehicles/VehicleDialog'
import { FuelLogDialog } from '@/features/vehicles/FuelLogDialog'
import { useVehicles, useDeleteVehicle, useAllVehicleFuelLogs, useDeleteVehicleFuelLog } from '@/features/vehicles/hooks'

function currency(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function VehiclesPage() {
  const { data: vehicles = [], isLoading } = useVehicles()
  const deleteMutation = useDeleteVehicle()
  const { data: fuelLogs = [] } = useAllVehicleFuelLogs()
  const deleteFuelMutation = useDeleteVehicleFuelLog()

  const vehicleById = React.useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const recentFuelLogs = fuelLogs.slice(0, 15)

  function handleDeleteVehicle(v: (typeof vehicles)[number]) {
    if (!confirm(`${v.brand_model}${v.plate_number ? ` (${v.plate_number})` : ''} silinsin mi? Bu araca ait yakıt kayıtları da silinecek.`)) return
    deleteMutation.mutate(v.id)
  }

  function handleDeleteFuelLog(logId: string) {
    if (!confirm('Bu yakıt kaydı silinsin mi?')) return
    deleteFuelMutation.mutate(logId)
  }

  return (
    <div>
      <PageHeader
        title="Araçlar"
        description="Satış temsilcilerine tahsis edilen şirket araçları, kiralama ve yakıt takibi"
        actions={
          <div className="flex gap-2">
            <ExportMenu<(typeof vehicles)[number]>
              title="Araçlar"
              filename="araclar"
              rows={vehicles}
              columns={[
                { header: 'Araç Modeli', value: (v) => v.brand_model },
                { header: 'Yıl', value: (v) => v.year ?? '' },
                { header: 'Plaka', value: (v) => v.plate_number ?? '' },
                { header: 'Kullanan Temsilci', value: (v) => v.sales_reps?.name ?? '' },
                { header: 'Firma', value: (v) => v.vendor_company ?? '' },
                { header: 'Aylık Kira', value: (v) => v.monthly_rental_price ?? '' },
                { header: 'Bakım Tarihi', value: (v) => v.maintenance_date ?? '' },
                { header: 'UTTS', value: (v) => (v.has_utts ? 'Var' : 'Yok') },
              ]}
            />
            <VehicleDialog />
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Araç</TableHead>
                <TableHead>Plaka</TableHead>
                <TableHead>Kullanan Temsilci</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Aylık Kira</TableHead>
                <TableHead>Bakım Tarihi</TableHead>
                <TableHead>UTTS</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    Henüz araç kaydı yok
                  </TableCell>
                </TableRow>
              )}
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.brand_model}
                    {v.year ? ` (${v.year})` : ''}
                  </TableCell>
                  <TableCell>{v.plate_number ?? '—'}</TableCell>
                  <TableCell>{v.sales_reps?.name ?? '—'}</TableCell>
                  <TableCell>{v.vendor_company ?? '—'}</TableCell>
                  <TableCell>{currency(v.monthly_rental_price)}</TableCell>
                  <TableCell>
                    {v.maintenance_date ? format(new Date(v.maintenance_date), 'd MMM yyyy', { locale: trLocale }) : '—'}
                  </TableCell>
                  <TableCell>
                    {v.has_utts ? (
                      <Badge variant="outline" className="border-transparent bg-success/15 text-success">
                        <CheckCircle2 className="size-3" /> Var
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <XCircle className="size-3" /> Yok
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <FuelLogDialog vehicleId={v.id} vehicleName={v.brand_model} />
                      <VehicleDialog
                        vehicle={v}
                        trigger={
                          <Button variant="ghost" size="icon" title="Düzenle">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <Button variant="ghost" size="icon" title="Sil" onClick={() => handleDeleteVehicle(v)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center gap-2 text-base font-semibold">
        <Fuel className="size-4 text-primary" /> Son Yakıt Kayıtları
      </div>
      <Card className="mt-2">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Araç</TableHead>
                <TableHead>Plaka</TableHead>
                <TableHead>Temsilci</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Not</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentFuelLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    Henüz yakıt kaydı yok
                  </TableCell>
                </TableRow>
              )}
              {recentFuelLogs.map((log) => {
                const vehicle = vehicleById.get(log.vehicle_id)
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.fill_date + 'T00:00:00'), 'd MMMM yyyy', { locale: trLocale })}
                    </TableCell>
                    <TableCell>{vehicle?.brand_model ?? '—'}</TableCell>
                    <TableCell>{vehicle?.plate_number ?? '—'}</TableCell>
                    <TableCell>{vehicle?.sales_reps?.name ?? '—'}</TableCell>
                    <TableCell>{currency(log.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{log.note ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Sil" onClick={() => handleDeleteFuelLog(log.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
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
