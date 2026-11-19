import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Pencil, Trash2, CheckCircle2, XCircle, IdCard, Car } from 'lucide-react'
import { toast } from 'sonner'
import { openRegistrationImage } from '@/features/vehicles/registration'
import { VehicleLicenseCell } from '@/features/vehicles/VehicleLicenseCell'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, PREMIUM_TABLE } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { VehicleDialog } from '@/features/vehicles/VehicleDialog'
import { RuhsatScanDialog } from '@/features/vehicles/RuhsatScanDialog'
import { FuelLogDialog } from '@/features/vehicles/FuelLogDialog'
import { useVehicles, useDeleteVehicle } from '@/features/vehicles/hooks'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { vehicleUserName } from '@/features/vehicles/api'

/** "2026-06-12" → "12.06.2026" (dışa aktarım için) */
function trDate(d: string | null): string {
  return d ? format(new Date(`${d}T00:00:00`), 'dd.MM.yyyy') : ''
}

function currency(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function VehiclesPage() {
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null)
  const { data: vehicles = [], isLoading } = useVehicles()
  const deleteMutation = useDeleteVehicle()
  const { confirm, dialog } = useConfirmDialog()
  // "Ruhsat Tara" ile açılan form — okunan plaka kayıtlı bir araçla eşleşirse o araç güncellenebilir
  const [scan, setScan] = React.useState<{ files: File[]; vehicle?: (typeof vehicles)[number] } | null>(null)

  const plateKey = (p: string | null | undefined) => (p ?? '').replace(/\s+/g, '').toLocaleUpperCase('tr-TR')

  async function handleDeleteVehicle(v: (typeof vehicles)[number]) {
    if (!(await confirm(`${v.brand_model}${v.plate_number ? ` (${v.plate_number})` : ''} silinsin mi? Bu araca ait yakıt kayıtları da silinecek.`)))
      return
    deleteMutation.mutate(v.id)
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
                { header: 'Bakım Tarihi', value: (v) => trDate(v.maintenance_date) },
                { header: 'UTTS', value: (v) => (v.has_utts ? 'Var' : 'Yok') },
                // Ruhsat sahibi, şase/motor no, ilk tescil ve yakıt dışa aktarımdan çıkarıldı (kullanıcı isteği, 2026-10-26)
                { header: 'Muayene Tarihi', value: (v) => trDate(v.inspection_valid_until) },
                { header: 'Renk', value: (v) => v.color ?? '' },
              ]}
            />
            <RuhsatScanDialog onScan={(files) => setScan({ files })} />
            <VehicleDialog />
          </div>
        }
      />

      {scan && (
        <VehicleDialog
          key={scan.vehicle?.id ?? 'new'}
          open
          onOpenChange={(o) => !o && setScan(null)}
          vehicle={scan.vehicle}
          initialFiles={scan.files}
          findExisting={(plate) => vehicles.find((v) => v.plate_number && plateKey(v.plate_number) === plateKey(plate))}
          onUseExisting={(v) => setScan({ files: scan.files, vehicle: v })}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <Table className={PREMIUM_TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>Araç</TableHead>
                {/* Düzenle / Sil araç adının hemen yanında (kullanıcı isteği, 2026-10-23) */}
                <TableHead className="w-0" aria-label="Düzenle / Sil" />
                <TableHead>Plaka</TableHead>
                <TableHead className="hidden xl:table-cell">Ehliyet</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead className="hidden xl:table-cell">Firma</TableHead>
                <TableHead className="hidden lg:table-cell">Aylık Kira</TableHead>
                <TableHead className="hidden 2xl:table-cell">Bakım Tarihi</TableHead>
                <TableHead className="hidden 2xl:table-cell">UTTS</TableHead>
                <TableHead>Muayene</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-8 text-center">
                    Henüz araç kaydı yok
                  </TableCell>
                </TableRow>
              )}
              {vehicles.map((v) => (
                <TableRow key={v.id} onClick={() => setSelectedVehicleId(v.id)} selected={v.id === selectedVehicleId}>
                  <TableCell className="font-medium whitespace-normal">
                    <span className="flex items-center gap-3">
                      <CarThumb />
                      <span className="min-w-0">
                        {v.brand_model}
                        {v.year ? <span className="block text-xs font-normal text-muted-foreground">{v.year} model</span> : null}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="px-1">
                    <div className="flex gap-0.5">
                      <VehicleDialog
                        vehicle={v}
                        trigger={
                          <Button variant="ghost" size="icon" title="Düzenle">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Sil"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteVehicle(v)
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">{v.plate_number ?? '—'}</TableCell>
                  {/* Dar pencerede önemi düşük sütunlar gizlenir, tablo yana taşmaz (2026-11-19); bilgiler düzenle penceresinde */}
                  <TableCell className="hidden xl:table-cell">
                    <VehicleLicenseCell vehicle={v} />
                  </TableCell>
                  <TableCell className="whitespace-normal">{vehicleUserName(v) ?? '—'}</TableCell>
                  <TableCell className="hidden whitespace-normal xl:table-cell">{v.vendor_company ?? '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{currency(v.monthly_rental_price)}</TableCell>
                  <TableCell className="hidden 2xl:table-cell">
                    {v.maintenance_date ? format(new Date(v.maintenance_date), 'd MMM yyyy', { locale: trLocale }) : '—'}
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell">
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
                          title="Ruhsatı aç (resim programında)"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await openRegistrationImage(v.registration_image_path!, `Ruhsat ${v.plate_number ?? v.brand_model}`)
                            } catch {
                              toast.error('Ruhsat fotoğrafı açılamadı')
                            }
                          }}
                        >
                          <IdCard className="size-4" />
                        </Button>
                      )}
                      <FuelLogDialog vehicleId={v.id} vehicleName={v.brand_model} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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

/** Küçük araba simgesi (kullanıcı isteği, 2026-11-19: "araba simgesi koy, resim koyma, küçük") */
function CarThumb() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
      <Car className="size-4" />
    </span>
  )
}
