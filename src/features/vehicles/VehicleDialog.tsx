import * as React from 'react'
import { Plus, Loader2, FileImage, ScanText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

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
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateVehicle, useUpdateVehicle } from './hooks'
import type { VehicleWithRelations } from './api'
import { useAIService } from '@/features/ai/useAIService'
import { getErrorMessage } from '@/lib/utils'
import {
  REGISTRATION_LABELS,
  extractRegistrationInfo,
  fileToDataUrl,
  getRegistrationImageUrl,
  uploadRegistrationImage,
  type RegistrationFields,
} from './registration'

/** Formda ayrı input olarak gösterilen ruhsat alanları (plaka / model / yıl yukarıda zaten var). */
const REG_FIELD_KEYS = [
  'owner_name',
  'owner_tax_id',
  'chassis_number',
  'engine_number',
  'first_registration_date',
  'registration_date',
  'inspection_valid_until',
  'vehicle_class',
  'vehicle_type',
  'color',
  'fuel_type',
  'engine_capacity',
  'engine_power',
  'seat_count',
  'usage_purpose',
  'document_serial',
  'owner_address',
] as const
type RegKey = (typeof REG_FIELD_KEYS)[number]
const DATE_KEYS = new Set<RegKey>(['first_registration_date', 'registration_date', 'inspection_valid_until'])

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
  // "Kullanıcı" — serbest metin; kayıtlı satış temsilcileri öneri olarak çıkar,
  // listede olmayan herhangi bir isim de yazılabilir (kullanıcı isteği, 2026-10-14).
  const [userName, setUserName] = React.useState('')
  const [monthlyRental, setMonthlyRental] = React.useState<number | undefined>(undefined)
  const [maintenanceDate, setMaintenanceDate] = React.useState('')
  const [hasUtts, setHasUtts] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  // Ruhsat (2026-10-21)
  const [reg, setReg] = React.useState<Record<RegKey, string>>(() => emptyReg())
  const [regImagePath, setRegImagePath] = React.useState<string | null>(null)
  const [regPreview, setRegPreview] = React.useState<string | null>(null)
  const [reading, setReading] = React.useState(false)
  // Okuma başarısız olursa (sağlayıcı yoğun vb.) aynı fotoğrafla "Tekrar oku"
  const [lastDataUrls, setLastDataUrls] = React.useState<string[] | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const aiService = useAIService()

  React.useEffect(() => {
    if (!open) return
    setBrandModel(vehicle?.brand_model ?? '')
    setYear(vehicle?.year != null ? String(vehicle.year) : '')
    setPlateNumber(vehicle?.plate_number ?? '')
    setRegistrationInfo(vehicle?.registration_info ?? '')
    setVendorCompany(vehicle?.vendor_company ?? '')
    setUserName(vehicle?.driver_name ?? vehicle?.sales_reps?.name ?? '')
    setMonthlyRental(vehicle?.monthly_rental_price ?? undefined)
    setMaintenanceDate(vehicle?.maintenance_date ?? '')
    setHasUtts(vehicle?.has_utts ?? false)
    setNotes(vehicle?.notes ?? '')
    const r = emptyReg()
    if (vehicle) for (const k of REG_FIELD_KEYS) r[k] = vehicle[k] != null ? String(vehicle[k]) : ''
    setReg(r)
    setRegImagePath(vehicle?.registration_image_path ?? null)
    setRegPreview(null)
    if (vehicle?.registration_image_path) {
      getRegistrationImageUrl(vehicle.registration_image_path).then(setRegPreview).catch(() => setRegPreview(null))
    }
  }, [open, vehicle])

  /** Fotoğraflardan ruhsat bilgilerini oku ve forma doldur. */
  async function runExtraction(dataUrls: string[]) {
    let found: RegistrationFields = {}
    try {
      found = await extractRegistrationInfo(aiService, dataUrls)
    } catch (err) {
      toast.error('Ruhsat okunamadı', {
        description: `${getErrorMessage(err)} — fotoğraf kaydedildi. Biraz sonra "Tekrar oku"ya basın ya da bilgileri elle girin.`,
      })
      return
    }
    if (found.plate_number) setPlateNumber(found.plate_number)
    if (found.brand_model) setBrandModel(found.brand_model)
    if (found.year) setYear(String(found.year))
    setReg((prev) => {
      const next = { ...prev }
      for (const k of REG_FIELD_KEYS) {
        const v = found[k]
        if (v != null && v !== '') next[k] = String(v)
      }
      return next
    })
    const count = Object.keys(found).length
    if (count > 0) toast.success(`Ruhsattan ${count} bilgi okundu`, { description: 'Lütfen kontrol edip kaydedin.' })
    else toast.warning('Ruhsatta okunabilir bilgi bulunamadı', { description: 'Daha net bir fotoğraf deneyin ya da elle girin.' })
    setLastDataUrls(null)
  }

  async function retryExtraction() {
    if (!lastDataUrls) return
    setReading(true)
    try {
      await runExtraction(lastDataUrls)
    } finally {
      setReading(false)
    }
  }

  /** Ruhsat fotoğrafı seçilince: yükle + yapay zekâ ile oku + forma doldur. */
  async function handleRegistrationFiles(files: FileList | null) {
    const list = files ? Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 2) : []
    if (list.length === 0) return
    setReading(true)
    try {
      setRegPreview(URL.createObjectURL(list[0]))
      const [path, dataUrls] = await Promise.all([uploadRegistrationImage(list[0]), Promise.all(list.map((f) => fileToDataUrl(f)))])
      setRegImagePath(path)
      setLastDataUrls(dataUrls)
      await runExtraction(dataUrls)
    } catch (err) {
      toast.error('Fotoğraf yüklenemedi', { description: getErrorMessage(err) })
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
      // Yazılan isim bir satış temsilcisiyle birebir eşleşirse o temsilciye de bağlanır
      // (temsilci raporları için); eşleşmezse sadece isim olarak saklanır.
      sales_rep_id: salesReps.find((r) => r.name.trim().toLocaleLowerCase('tr-TR') === userName.trim().toLocaleLowerCase('tr-TR'))?.id ?? null,
      driver_name: userName.trim() || null,
      monthly_rental_price: monthlyRental ?? null,
      maintenance_date: maintenanceDate || null,
      has_utts: hasUtts,
      notes: notes.trim() || null,
      registration_image_path: regImagePath,
      ...Object.fromEntries(
        REG_FIELD_KEYS.map((k) => {
          const v = reg[k].trim()
          return [k, !v ? null : k === 'seat_count' ? Number(v) || null : v]
        }),
      ),
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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

          {/* Ruhsat — fotoğraf ekle, bilgiler otomatik okunsun (kullanıcı isteği, 2026-10-21) */}
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Ruhsat Bilgileri</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleRegistrationFiles(e.target.files)}
              />
              <span className="flex flex-wrap gap-2">
              {lastDataUrls && !reading && (
                <Button type="button" size="sm" onClick={() => void retryExtraction()}>
                  <ScanText /> Tekrar oku
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                {reading ? <Loader2 className="animate-spin" /> : <ScanText />}
                {reading ? 'Ruhsat okunuyor…' : regImagePath ? 'Ruhsat fotoğrafını değiştir' : 'Ruhsat fotoğrafı ekle'}
              </Button>
              </span>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Ruhsatın fotoğrafını ekleyin (ön ve arka yüz için 2 fotoğraf seçebilirsiniz) — plaka, şase, motor no, sahibi, tescil ve
              muayene tarihleri otomatik doldurulur; kontrol edip kaydedin.
            </p>
            {regPreview && (
              <a href={regPreview} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-md border" title="Büyük görmek için tıklayın">
                <img src={regPreview} alt="Ruhsat" className="max-h-44 w-full object-contain bg-background" />
                <span className="absolute right-1 bottom-1 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="size-3" /> Büyüt
                </span>
              </a>
            )}
            {!regPreview && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed py-4 text-sm text-muted-foreground hover:bg-accent"
              >
                <FileImage className="size-4" /> Ruhsat fotoğrafı yok — eklemek için tıklayın
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {REG_FIELD_KEYS.map((k) => (
                <div key={k} className={k === 'owner_address' ? 'col-span-2 grid gap-1' : 'grid gap-1'}>
                  <Label htmlFor={`vehicle-${k}`} className="text-xs">
                    {REGISTRATION_LABELS[k]}
                  </Label>
                  <Input
                    id={`vehicle-${k}`}
                    type={DATE_KEYS.has(k) ? 'date' : k === 'seat_count' ? 'number' : 'text'}
                    value={reg[k]}
                    onChange={(e) => setReg((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="h-8"
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="vehicle-registration" className="text-xs">
                Diğer ruhsat notları
              </Label>
              <Textarea
                id="vehicle-registration"
                value={registrationInfo}
                onChange={(e) => setRegistrationInfo(e.target.value)}
                rows={2}
              />
            </div>
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
              <Label htmlFor="vehicle-user">Kullanıcı</Label>
              <Input
                id="vehicle-user"
                list="vehicle-user-suggestions"
                placeholder="Aracı kullanan kişinin adı"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
              <datalist id="vehicle-user-suggestions">
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.name} />
                ))}
              </datalist>
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

function emptyReg(): Record<RegKey, string> {
  return Object.fromEntries(REG_FIELD_KEYS.map((k) => [k, ''])) as Record<RegKey, string>
}
