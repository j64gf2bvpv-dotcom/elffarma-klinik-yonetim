import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Pencil, Trash2, CheckCircle2, XCircle, Fuel, FileImage } from 'lucide-react'
import { toast } from 'sonner'
import { getRegistrationImageUrl } from '@/features/vehicles/registration'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { VehicleDialog } from '@/features/vehicles/VehicleDialog'
import { FuelLogDialog } from '@/features/vehicles/FuelLogDialog'
import { useVehicles, useDeleteVehicle, useAllVehicleFuelLogs, useDeleteVehicleFuelLog } from '@/features/vehicles/hooks'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { vehicleUserName } from '@/features/vehicles/api'

function currency(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function VehiclesPage() {
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null)
  const [selectedLogId, setSelectedLogId] = React.useState<string | null>(null)
  const { data: vehicles = [], isLoading } = useVehicles()
  const deleteMutation = useDeleteVehicle()
  const { data: fuelLogs = [] } = useAllVehicleFuelLogs()
  const deleteFuelMutation = useDeleteVehicleFuelLog()

  const vehicleById = React.useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const recentFuelLogs = fuelLogs.slice(0, 15)
  const { confirm, dialog } = useConfirmDialog()

  async function handleDeleteVehicle(v: (typeof vehicles)[number]) {
    if (!(await confirm(`${v.brand_model}${v.plate_number ? ` (${v.plate_number})` : ''} silinsin mi? Bu araca ait yakıt kayıtları da silinecek.`)))
      return
    deleteMutation.mutate(v.id)
  }

  async function handleDeleteFuelLog(logId: string) {
    if (!(await confirm('Bu yakıt kaydı silinsin mi?'))) return
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
                { header: 'Kullanıcı', value: (v) => vehicleUserName(v) ?? '' },
                { header: 'Firma', value: (v) => v.vendor_company ?? '' },
                { header: 'Aylık Kira', value: (v) => v.monthly_rental_price ?? '' },
                { header: 'Bakım Tarihi', value: (v) => v.maintenance_date ?? '' },
                { header: 'UTTS', value: (v) => (v.has_utts ? 'Var' : 'Yok') },
                { header: 'Muayene Geçerlilik', value: (v) => v.inspection_valid_until ?? '' },
                { header: 'Ruhsat Sahibi', value: (v) => v.owner_name ?? '' },
                { header: 'Şase No', value: (v) => v.chassis_number ?? '' },
                { header: 'Motor No', value: (v) => v.engine_number ?? '' },
                { header: 'İlk Tescil', value: (v) => v.first_registration_date ?? '' },
                { header: 'Renk', value: (v) => v.color ?? '' },
                { header: 'Yakıt', value: (v) => v.fuel_type ?? '' },
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
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Aylık Kira</TableHead>
                <TableHead>Bakım Tarihi</TableHead>
                <TableHead>UTTS</TableHead>
                <TableHead>Muayene</TableHead>
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
                  <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                    Henüz araç kaydı yok
                  </TableCell>
                </TableRow>
              )}
              {vehicles.map((v) => (
                <TableRow key={v.id} onClick={() => setSelectedVehicleId(v.id)} selected={v.id === selectedVehicleId}>
                  <TableCell className="font-medium">
                    {v.brand_model}
                    {v.year ? ` (${v.year})` : ''}
                  </TableCell>
                  <TableCell>{v.plate_number ?? '—'}</TableCell>
                  <TableCell>{vehicleUserName(v) ?? '—'}</TableCell>
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
                  <TableCell>
                    <InspectionBadge date={v.inspection_valid_until} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {v.registration_image_path && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ruhsat fotoğrafını aç"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              window.open(await getRegistrationImageUrl(v.registration_image_path!), '_blank')
                            } catch {
                              toast.error('Ruhsat fotoğrafı açılamadı')
                            }
                          }}
                        >
                          <FileImage className="size-3.5" />
                        </Button>
                      )}
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
                <TableHead>Kullanıcı</TableHead>
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
                  <TableRow key={log.id} onClick={() => setSelectedLogId(log.id)} selected={log.id === selectedLogId}>
                    <TableCell>
                      {format(new Date(log.fill_date + 'T00:00:00'), 'd MMMM yyyy', { locale: trLocale })}
                    </TableCell>
                    <TableCell>{vehicle?.brand_model ?? '—'}</TableCell>
                    <TableCell>{vehicle?.plate_number ?? '—'}</TableCell>
                    <TableCell>{vehicleUserName(vehicle) ?? '—'}</TableCell>
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
      {dialog}
    </div>
  )
}

/** Muayene geçerlilik tarihi — geçmişse kırmızı, 30 gün içindeyse turuncu. */
function InspectionBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000)
  const label = format(new Date(`${date}T00:00:00`), 'd MMM yyyy', { locale: trLocale })
  if (days < 0) return <Badge variant="destructive" title="Muayene süresi geçmiş">{label}</Badge>
  if (days <= 30) return <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground" title={`${days} gün kaldı`}>{label}</Badge>
  return <span>{label}</span>
}
