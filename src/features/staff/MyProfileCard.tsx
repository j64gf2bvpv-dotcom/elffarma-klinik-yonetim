import * as React from 'react'
import { UserCircle2, Upload, Loader2 } from 'lucide-react'

import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth'
import { useStaffList, useUpdateMyProfile, useUploadStaffAvatar } from './hooks'
import { StaffBusinessCard } from './StaffBusinessCard'
import { AvatarCropDialog } from './AvatarCropDialog'

interface ProfileForm {
  phone: string
  job_title: string
  email: string
  address: string
  whatsapp_phone: string
  social_media: string
}

const emptyForm: ProfileForm = { phone: '', job_title: '', email: '', address: '', whatsapp_phone: '', social_media: '' }

/**
 * Ayarlar > Profilim — tüm personel (sadece admin değil) kendi fotoğrafını
 * ve kartvizit bilgilerini düzenler. `full_name` bilerek burada
 * DÜZENLENEMEZ: `protect_staff_privileged_columns` trigger'ı admin olmayan
 * bir güncellemede bunu sessizce eski değerine geri çeviriyor (bkz.
 * schema.sql böl. 48) — admin kendi adını zaten aşağıdaki "Personel"
 * tablosundan değiştirebiliyor, burada tekrar bir düzenleme yolu açıp
 * kafa karıştırmıyoruz.
 */
export function MyProfileCard() {
  const { staff: authStaff } = useAuth()
  const { data: staffList = [] } = useStaffList()
  const me = staffList.find((s) => s.id === authStaff?.id) ?? authStaff
  const updateProfile = useUpdateMyProfile()
  const uploadAvatar = useUploadStaffAvatar()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = React.useState<File | null>(null)
  const [cropOpen, setCropOpen] = React.useState(false)
  const [form, setForm] = React.useState<ProfileForm>(emptyForm)
  const [synced, setSynced] = React.useState(false)

  React.useEffect(() => {
    if (synced || !me) return
    setForm({
      phone: me.phone ?? '',
      job_title: me.job_title ?? '',
      email: me.email ?? '',
      address: me.address ?? '',
      whatsapp_phone: me.whatsapp_phone ?? '',
      social_media: me.social_media ?? '',
    })
    setSynced(true)
  }, [me, synced])

  if (!me) return null

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Doğrudan yüklemek yerine önce daire içinde sürükle/yakınlaştır
    // diyaloğunu açıyoruz — kullanıcı fotoğrafı kendi istediği kadranla
    // dairenin içine yerleştirsin diye (bkz. AvatarCropDialog).
    setPendingAvatarFile(file)
    setCropOpen(true)
  }

  async function handleCropConfirm(blob: Blob) {
    if (!me) return
    setAvatarUploading(true)
    try {
      const croppedFile = new File([blob], 'avatar.png', { type: 'image/png' })
      const url = await uploadAvatar.mutateAsync({ staffId: me.id, file: croppedFile })
      await updateProfile.mutateAsync({ id: me.id, input: { avatar_url: url } })
    } finally {
      setAvatarUploading(false)
      setPendingAvatarFile(null)
    }
  }

  function handleSave() {
    if (!me) return
    updateProfile.mutate({ id: me.id, input: form })
  }

  return (
    <>
    <CollapsibleCard
      icon={
        <span className="bg-muted text-muted-foreground ring-1 ring-black/5 flex size-10 shrink-0 items-center justify-center rounded-xl">
          <UserCircle2 className="size-5" />
        </span>
      }
      title="Profilim"
      description="Fotoğrafınızı ve iletişim bilgilerinizi düzenleyin — kartvizitiniz sağda anlık güncellenir."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-full transition-opacity hover:opacity-80"
              title="Fotoğraf değiştir"
            >
              {me.avatar_url ? (
                <img src={me.avatar_url} alt="" className="size-16 rounded-full object-cover" />
              ) : (
                <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
                  <UserCircle2 className="size-8" />
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}>
              {avatarUploading ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
              Fotoğraf Yükle
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Ad Soyad</Label>
            <Input value={me.full_name} disabled />
            <p className="text-muted-foreground text-xs">
              {me.role === 'admin'
                ? 'Adınızı aşağıdaki "Personel" tablosunda isminizin üzerine tıklayıp değiştirebilirsiniz.'
                : "Adınızı değiştirmek için admin'e başvurun (Ayarlar > Personel)."}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Görev</Label>
            <Input
              placeholder="ör. Genel Müdür, Satış Temsilcisi"
              value={form.job_title}
              onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">WhatsApp (farklıysa)</Label>
              <Input
                placeholder="Boşsa telefon kullanılır"
                value={form.whatsapp_phone}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">E-posta</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Adres</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Sosyal Medya (her satıra bir link)</Label>
            <Textarea
              rows={3}
              placeholder={'instagram.com/kullaniciadi\nlinkedin.com/in/kullaniciadi'}
              value={form.social_media}
              onChange={(e) => setForm((f) => ({ ...f, social_media: e.target.value }))}
            />
          </div>

          <Button onClick={handleSave} disabled={updateProfile.isPending} className="w-fit">
            {updateProfile.isPending && <Loader2 className="animate-spin" />}
            Kaydet
          </Button>
        </div>

        <div className="flex items-start justify-center lg:justify-start">
          <StaffBusinessCard staff={{ ...me, ...form }} />
        </div>
      </div>
    </CollapsibleCard>

      <AvatarCropDialog
        open={cropOpen}
        onOpenChange={(v) => {
          setCropOpen(v)
          if (!v) setPendingAvatarFile(null)
        }}
        file={pendingAvatarFile}
        onConfirm={handleCropConfirm}
      />
    </>
  )
}
