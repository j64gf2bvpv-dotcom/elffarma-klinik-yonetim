import * as React from 'react'
import { Link } from 'react-router-dom'
import { Search, Phone, MapPin, Star, Trash2, Loader2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ClinicForm } from '@/features/clinics/ClinicForm'
import { useClinics, useDeleteClinic } from '@/features/clinics/hooks'
import { useRegions } from '@/features/regions/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import type { Clinic } from '@/types/database'

export function ClinicsPage() {
  const [search, setSearch] = React.useState('')
  const { data: clinics = [], isLoading } = useClinics(search)
  const { data: regions = [] } = useRegions()
  const { data: salesReps = [] } = useSalesReps()
  const deleteMutation = useDeleteClinic()
  const [clinicToDelete, setClinicToDelete] = React.useState<Clinic | null>(null)

  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name
  const repName = (id: string | null) => salesReps.find((r) => r.id === id)?.name

  async function confirmDelete() {
    if (!clinicToDelete) return
    await deleteMutation.mutateAsync(clinicToDelete.id)
    setClinicToDelete(null)
  }

  return (
    <div>
      <PageHeader
        title="Klinikler"
        description="Doktorların bağlı olduğu klinik/hastane kartları"
        actions={<ClinicForm />}
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Klinik ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klinik Adı</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Bölge</TableHead>
                <TableHead>Temsilci</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && clinics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Klinik bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {clinics.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell className="font-medium">
                    <Link to={`/klinikler/${clinic.id}`} className="hover:underline">
                      {clinic.name}
                    </Link>
                    {clinic.is_vip && (
                      <Badge variant="warning" className="ml-2">
                        <Star className="size-3" /> VIP
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {clinic.phone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        {clinic.phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {clinic.region_id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {regionName(clinic.region_id) ?? '—'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{repName(clinic.sales_rep_id) ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{clinic.category ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setClinicToDelete(clinic)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!clinicToDelete} onOpenChange={(open) => !open && setClinicToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clinicToDelete?.name} silinsin mi?</DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClinicToDelete(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="animate-spin" />}
              Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
