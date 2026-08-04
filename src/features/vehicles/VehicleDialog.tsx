import * as React from 'react'
import { Plus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateVehicle, useUpdateVehicle } from './hooks'
import type { VehicleWithRelations } from './api'

export function VehicleDialog({ vehicle, trigger }: { vehicle?: VehicleWithRelations; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const { data: salesReps = [] } = useSalesReps()
  const createMutation = useCreateVehicle()
  const updateMutation = useUpdateVehicle()

  const [brandModel, setBrandModel] = React.useState('')
  const [year, setYear] = React.useState('')
  const [plateNumber, setPlateNumber] = React.useState('')
  const [registrationInfo, setRegistrationInfo] = React.useState('')
  const [vendorCompany, setVendorCompany] = React.useState('')
  const [salesRepId, setSalesRepId] = React.useState<string>('none')
  const [monthlyRental, setMonthlyRental] = React.useState<number | undefined>(undefined)
  const [maintenanceDate, setMaintenanceDate] = React.useState('')
  const [hasUtts, setHasUtts] = React.useState(false)
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setBrandModel(vehicle?.brand_model ?? '')
    setYear(vehicle?.year != null ? String(vehicle.year) : '')
    setPlateNumber(vehicle?.plate_number ?? '')
    setRegistrationInfo(vehicle?.registration_info ?? '')
    setVendorCompany(vehicle?.vendor_company ?? '')
    setSalesRepId(vehicle?.sales_rep_id ?? 'none')
    setMonthlyRental(vehicle?.monthly_rental_price ?? undefined)
    setMaintenanceDate(vehicle?.maintenance_date ?? '')
    setHasUtts(vehicle?.has_utts ?? false)
    setNotes(vehicle?.notes ?? '')
  }, [open, vehicle])

  const submitting = createMutation.isPending || updateMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!brandModel.trim()) return
    const input = {
      brand_model: brandModel.trim(),
      year: year ? Number(year) : null,
      plate_number: plateNumber.trim() || null,
      registration_info: registrationInfo.trim() || null,
      vendor_company: vendorCompany.trim() || null,
      sales_rep_id: salesRepId === 'none' ? null : salesRepId,
      monthly_rental_price: monthlyRental ?? null,
      maintenance_date: maintenanceDate || null,
      has_utts: hasUtts,
      notes: notes.trim() || null,
    }
    if (vehicle) {
      await updateMutation.mutateAsync({ id: vehicle.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Araç Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'Aracı Düzenle' : 'Yeni Araç'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="vehicle-brand-model">Araç Modeli</Label>
              <Input
                id="vehicle-brand-model"
                placeholder="Renault Clio"
                value={brandModel}
                onChange={(e) => setBrandModel(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-year">Model Yılı</Label>
              <Input
                id="vehicle-year"
                type="number"
                placeholder="2024"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-plate">Plaka</Label>
              <Input
                id="vehicle-plate"
                placeholder="34 ABC 123"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vehicle-registration">Ruhsat Bilgileri</Label>
            <Textarea
              id="vehicle-registration"
              placeholder="Ruhsat no, şasi no vb."
              value={registrationInfo}
              onChange={(e) => setRegistrationInfo(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-vendor">Hangi Firmadan Alındı</Label>
              <Input
                id="vehicle-vendor"
                placeholder="Firma adı"
                value={vendorCompany}
                onChange={(e) => setVendorCompany(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kullanan Satış Personeli</Label>
              <Select value={salesRepId} onValueChange={setSalesRepId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Atanmadı —</SelectItem>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-rental">Aylık Kiralama Fiyatı</Label>
              <CurrencyInput id="vehicle-rental" value={monthlyRental} onChange={setMonthlyRental} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-maintenance">Bakım Tarihi</Label>
              <Input
                id="vehicle-maintenance"
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hasUtts} onCheckedChange={(v) => setHasUtts(v === true)} />
            UTTS var
          </label>

          <div className="grid gap-1.5">
            <Label htmlFor="vehicle-notes">Notlar</Label>
            <Textarea
              id="vehicle-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={submitting || !brandModel.trim()}>
              {submitting && <Loader2 className="animate-spin" />}
              {vehicle ? 'Kaydet' : 'Ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
