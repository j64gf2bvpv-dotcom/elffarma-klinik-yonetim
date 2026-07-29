import * as React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Star, Trash2, Pencil, Loader2, User } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ClinicForm } from '@/features/clinics/ClinicForm'
import { useClinic, useDeleteClinic } from '@/features/clinics/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useRegions } from '@/features/regions/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: clinic, isLoading } = useClinic(id)
  const { data: allDoctors = [] } = useCustomers('')
  const { data: regions = [] } = useRegions()
  const { data: salesReps = [] } = useSalesReps()
  const deleteMutation = useDeleteClinic()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!clinic) return <p>Klinik bulunamadı.</p>

  const doctors = allDoctors.filter((d) => d.clinic_id === clinic.id)
  const region = regions.find((r) => r.id === clinic.region_id)
  const rep = salesReps.find((r) => r.id === clinic.sales_rep_id)

  async function handleDelete() {
    await deleteMutation.mutateAsync(clinic!.id)
    setConfirmOpen(false)
    navigate('/klinikler')
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/klinikler')}>
        <ArrowLeft /> Kliniklere Dön
      </Button>

      <PageHeader
        title={clinic.name}
        actions={
          <div className="flex gap-2">
            <ClinicForm clinic={clinic} trigger={<Button variant="outline"><Pencil /> Düzenle</Button>} />
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 /> Sil
            </Button>
          </div>
        }
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clinic.name} silinsin mi?</DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="animate-spin" />}
              Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {clinic.is_vip && (
          <Badge variant="warning">
            <Star className="size-3" /> VIP
          </Badge>
        )}
        {clinic.category && <Badge variant="outline">{clinic.category}</Badge>}
        {region && (
          <Badge variant="outline">
            <MapPin className="size-3" /> {region.name}
          </Badge>
        )}
        {rep && <Badge variant="outline">{rep.name}</Badge>}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="grid gap-6 md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Klinik Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {clinic.authorized_persons && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">YETKİLİLER</p>
                  <p>{clinic.authorized_persons}</p>
                </div>
              )}
              {clinic.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" /> {clinic.phone}
                </p>
              )}
              {clinic.address && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ADRES</p>
                  <p className="whitespace-pre-wrap">{clinic.address}</p>
                </div>
              )}
              {clinic.maps_url && (
                <a href={clinic.maps_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Google Maps'te Görüntüle
                </a>
              )}
              {(clinic.tax_office || clinic.tax_number) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">VERGİ</p>
                  <p>
                    {clinic.tax_office} {clinic.tax_number}
                  </p>
                </div>
              )}
              {(clinic.employee_count != null || clinic.branch_count != null) && (
                <div className="flex gap-4">
                  {clinic.employee_count != null && (
                    <span>
                      <span className="text-xs text-muted-foreground">Çalışan: </span>
                      {clinic.employee_count}
                    </span>
                  )}
                  {clinic.branch_count != null && (
                    <span>
                      <span className="text-xs text-muted-foreground">Şube: </span>
                      {clinic.branch_count}
                    </span>
                  )}
                </div>
              )}
              {clinic.working_days.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {clinic.working_days.map((day) => (
                    <Badge key={day} variant="secondary">
                      {day}
                    </Badge>
                  ))}
                </div>
              )}
              {clinic.notes && (
                <div className="pt-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">NOTLAR</p>
                  <p className="whitespace-pre-wrap">{clinic.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Ticari Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {clinic.risk_limit != null && (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">RİSK LİMİTİ</p>
                  <p className="font-semibold tabular-nums">{currency(Number(clinic.risk_limit))}</p>
                </div>
              )}
              {clinic.discount_rate != null && (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">İSKONTO ORANI</p>
                  <p className="font-semibold">%{clinic.discount_rate}</p>
                </div>
              )}
              {clinic.payment_method && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ÖDEME ŞEKLİ</p>
                  <p>{clinic.payment_method}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold">Doktorlar ({doctors.length})</h2>
          </div>
          <Card className="mb-6">
            <CardContent className={doctors.length === 0 ? 'p-6' : 'grid gap-1.5 p-4'}>
              {doctors.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu kliniğe bağlı doktor yok.</p>
              ) : (
                doctors.map((doctor) => (
                  <Link
                    key={doctor.id}
                    to={`/musteriler/${doctor.id}`}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <User className="size-3.5 text-muted-foreground" />
                    {doctor.full_name}
                    {doctor.specialty && <span className="text-xs text-muted-foreground">({doctor.specialty})</span>}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <AttachmentsPanel ownerType="clinic" ownerId={clinic.id} />
        </div>
      </div>
    </div>
  )
}
