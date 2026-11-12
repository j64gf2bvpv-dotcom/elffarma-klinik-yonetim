import * as React from 'react'
import { Plus, Loader2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { IMAGE_ACCEPT, ensureReadableImage } from '@/lib/ensureReadableImage'
import { getDocumentUrl } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import type { Personnel } from '@/types/database'
import { updatePersonnel, uploadPersonnelPhoto, type PersonnelInput } from './api'
import { useSavePersonnel } from './hooks'
import { isValidTcNo } from './status'

type Form = Record<keyof PersonnelInput, string>

const EMPTY: Form = {
  full_name: '',
  tc_no: '',
  birth_date: '',
  birth_place: '',
  gender: '',
  marital_status: '',
  blood_type: '',
  phone: '',
  email: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  position: '',
  department: '',
  start_date: '',
  end_date: '',
  sgk_no: '',
  iban: '',
  education: '',
  military_status: '',
  license_class: '',
  photo_path: '',
  notes: '',
}

/** Öneri listeleri (serbest yazı da girilebilir) */
const OPTIONS: Partial<Record<keyof PersonnelInput, string[]>> = {
  gender: ['Kadın', 'Erkek'],
  marital_status: ['Bekâr', 'Evli', 'Boşanmış', 'Dul'],
  blood_type: ['0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-'],
  education: ['İlkokul', 'Ortaokul', 'Lise', 'Ön Lisans', 'Lisans', 'Yüksek Lisans', 'Doktora'],
  military_status: ['Yapıldı', 'Muaf', 'Tecilli', 'Yapılmadı'],
  license_class: ['B', 'A2', 'A', 'B1', 'BE', 'C', 'D', 'Yok'],
}

const SECTIONS: { title: string; fields: { key: keyof PersonnelInput; label: string; type?: string; wide?: boolean; area?: boolean }[] }[] = [
  {
    title: 'Kimlik Bilgileri',
    fields: [
      { key: 'full_name', label: 'Adı Soyadı *', wide: true },
      { key: 'tc_no', label: 'T.C. Kimlik No' },
      { key: 'birth_date', label: 'Doğum Tarihi', type: 'date' },
      { key: 'birth_place', label: 'Doğum Yeri' },
      { key: 'gender', label: 'Cinsiyeti' },
      { key: 'marital_status', label: 'Medeni Hâli' },
      { key: 'blood_type', label: 'Kan Grubu' },
    ],
  },
  {
    title: 'İletişim',
    fields: [
      { key: 'phone', label: 'Telefon', type: 'tel' },
      { key: 'email', label: 'E-posta', type: 'email' },
      { key: 'address', label: 'Adres', wide: true, area: true },
      { key: 'emergency_contact_name', label: 'Acil Durumda Aranacak Kişi' },
      { key: 'emergency_contact_phone', label: 'Acil Durum Telefonu', type: 'tel' },
    ],
  },
  {
    title: 'İş Bilgileri',
    fields: [
      { key: 'position', label: 'Görevi / Ünvanı' },
      { key: 'department', label: 'Birimi / Departmanı' },
      { key: 'start_date', label: 'İşe Giriş Tarihi', type: 'date' },
      { key: 'end_date', label: 'İşten Çıkış Tarihi', type: 'date' },
      { key: 'sgk_no', label: 'SGK Sicil No' },
      { key: 'iban', label: 'IBAN' },
    ],
  },
  {
    title: 'Diğer',
    fields: [
      { key: 'education', label: 'Eğitim Durumu' },
      { key: 'military_status', label: 'Askerlik Durumu' },
      { key: 'license_class', label: 'Ehliyet Sınıfı' },
      { key: 'notes', label: 'Notlar', wide: true, area: true },
    ],
  },
]

export function PersonnelFormDialog({ person, trigger }: { person?: Personnel; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<Form>(EMPTY)
  const [photo, setPhoto] = React.useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const save = useSavePersonnel()
  const qc = useQueryClient()
  const photoRef = React.useRef<HTMLInputElement>(null)

  function handleOpenChange(next: boolean) {
    if (next) {
      const f = { ...EMPTY }
      if (person) for (const k of Object.keys(EMPTY) as (keyof PersonnelInput)[]) f[k] = (person[k] as string | null) ?? ''
      setForm(f)
      setPhoto(null)
      setPhotoUrl(null)
      if (person?.photo_path) getDocumentUrl(person.photo_path).then(setPhotoUrl).catch(() => {})
    }
    setOpen(next)
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    try {
      const readable = await ensureReadableImage(file)
      setPhoto(readable)
      setPhotoUrl(URL.createObjectURL(readable))
    } catch (err) {
      toast.error('Fotoğraf açılamadı', { description: getErrorMessage(err) })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      toast.error('Adı soyadı girilmeli')
      return
    }
    const tc = form.tc_no.replace(/\s/g, '')
    if (tc && !isValidTcNo(tc)) toast.warning('T.C. kimlik no geçerli görünmüyor', { description: 'Kaydedildi; lütfen numarayı kontrol edin.' })
    setSaving(true)
    try {
      const input = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])) as unknown as PersonnelInput
      input.full_name = form.full_name.trim()
      input.tc_no = tc || null
      input.iban = form.iban.replace(/\s/g, '').toUpperCase() || null
      const saved = await save.mutateAsync({ id: person?.id, input })
      if (photo) {
        const path = await uploadPersonnelPhoto(saved.id, photo)
        await updatePersonnel(saved.id, { photo_path: path })
        void qc.invalidateQueries({ queryKey: ['personnel'] })
      }
      setOpen(false)
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Personel Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{person ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 hover:bg-accent"
              title="Vesikalık fotoğraf ekle"
            >
              {photoUrl ? <img src={photoUrl} alt="Fotoğraf" className="size-full object-cover" /> : <UserRound className="size-10 text-muted-foreground" />}
            </button>
            <input ref={photoRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
            <p className="text-sm text-muted-foreground">Vesikalık fotoğraf eklemek için kutuya tıklayın (iPhone fotoğrafları dahil).</p>
          </div>

          {SECTIONS.map((sec) => (
            <fieldset key={sec.title} className="grid gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{sec.title}</legend>
              <div className="grid grid-cols-2 gap-3">
                {sec.fields.map((f) => (
                  <div key={f.key} className={`grid gap-1.5 ${f.wide ? 'col-span-2' : ''}`}>
                    <Label htmlFor={`p-${f.key}`}>{f.label}</Label>
                    {f.area ? (
                      <Textarea id={`p-${f.key}`} rows={2} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
                    ) : (
                      <Input
                        id={`p-${f.key}`}
                        type={f.type ?? 'text'}
                        list={OPTIONS[f.key] ? `p-${f.key}-list` : undefined}
                        value={form[f.key]}
                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      />
                    )}
                    {OPTIONS[f.key] && (
                      <datalist id={`p-${f.key}-list`}>
                        {OPTIONS[f.key]!.map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
