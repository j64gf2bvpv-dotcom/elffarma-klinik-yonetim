import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IdCard, ImagePlus, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IMAGE_ACCEPT, isImageFile } from '@/lib/ensureReadableImage'
import { resizeImageFile } from '@/lib/resizeImage'
import { supabase } from '@/lib/supabaseClient'
import { cn, getErrorMessage } from '@/lib/utils'
import { updateVehicle } from './api'
import { openRegistrationImage } from './registration'
import type { Vehicle } from '@/types/database'

/**
 * Araç tablosunda Plaka'dan sonraki "Ehliyet" hücresi — aracı kullanan personelin
 * ehliyetinin ön / arka yüzü (kullanıcı istekleri, 2026-10-23: "personellerin ehliyet
 * resimlerini ekleyebilelim, ön arka yüz şeklinde", "ehliyet kısmı plakalardan sonra
 * olsun, o kısma eklensin"). Boş kutu: tıkla / sürükle-bırak → fotoğraf eklenir.
 * Dolu kutu: tıkla → bilgisayarın resim programında açılır; kalem / sürükle-bırak →
 * değiştirilir. Tüm görsel biçimleri (HEIC dahil) kabul edilir; gizli depoda tutulur.
 */
type Side = 'license_front_path' | 'license_back_path'
const LABEL: Record<Side, string> = { license_front_path: 'Ön', license_back_path: 'Arka' }

function Slot({ vehicle, side }: { vehicle: Vehicle; side: Side }) {
  const path = vehicle[side]
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const queryClient = useQueryClient()
  const { data: url } = useQuery({
    queryKey: ['vehicle_license_image', path],
    enabled: !!path,
    staleTime: 8 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path!, 60 * 10)
      if (error) throw error
      return data.signedUrl
    },
  })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const blob = await resizeImageFile(file, 1800, 0.88)
      const newPath = `personnel/ehliyet/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('documents').upload(newPath, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      await updateVehicle(vehicle.id, { [side]: newPath })
      if (path) await supabase.storage.from('documents').remove([path])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success(`Ehliyet ${LABEL[side].toLocaleLowerCase('tr-TR')} yüzü kaydedildi`)
    },
    onError: (err) => toast.error('Ehliyet fotoğrafı yüklenemedi', { description: getErrorMessage(err) }),
  })

  function pick(file: File | null | undefined) {
    if (!file) return
    if (!isImageFile(file)) {
      toast.error('Lütfen bir görsel dosyası seçin')
      return
    }
    upload.mutate(file)
  }

  const who = vehicle.driver_name || vehicle.plate_number || vehicle.brand_model
  return (
    <div
      className={cn(
        'group relative aspect-[1.58] w-full overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60',
        dragOver && 'ring-2 ring-primary',
      )}
      onClick={(e) => e.stopPropagation()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        pick(e.dataTransfer.files?.[0])
      }}
    >
      <button
        type="button"
        className="flex size-full items-center justify-center"
        title={path ? `Ehliyet ${LABEL[side].toLocaleLowerCase('tr-TR')} yüz — resim programında aç` : `Ehliyet ${LABEL[side].toLocaleLowerCase('tr-TR')} yüzü ekle (tıkla ya da sürükle-bırak)`}
        onClick={() => {
          if (path) openRegistrationImage(path, `Ehliyet ${who} ${LABEL[side]}`).catch(() => toast.error('Fotoğraf açılamadı'))
          else inputRef.current?.click()
        }}
      >
        {upload.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : path && url ? (
          <img src={url} alt={`Ehliyet ${LABEL[side]}`} className="size-full object-contain" />
        ) : path ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm font-medium">
            <ImagePlus className="size-6" /> {LABEL[side]} yüz ekle
            <span className="text-xs font-normal">tıklayın ya da sürükleyin</span>
          </span>
        )}
      </button>
      {path && !upload.isPending && (
        <>
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium text-foreground">{LABEL[side]} yüz</span>
          <button
            type="button"
            title="Değiştir"
            className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium text-foreground shadow-sm hover:bg-background"
            onClick={() => inputRef.current?.click()}
          >
            <Pencil className="size-3" /> Değiştir
          </button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Tabloda tek ehliyet kutusu (ön yüz küçük resmi) — tıklayınca ön ve arka yüzün olduğu pencere açılır. */
export function VehicleLicenseCell({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = React.useState(false)
  const count = (vehicle.license_front_path ? 1 : 0) + (vehicle.license_back_path ? 1 : 0)
  const thumbPath = vehicle.license_front_path ?? vehicle.license_back_path
  const { data: thumb } = useQuery({
    queryKey: ['vehicle_license_image', thumbPath],
    enabled: !!thumbPath,
    staleTime: 8 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(thumbPath!, 60 * 10)
      if (error) throw error
      return data.signedUrl
    },
  })
  const who = vehicle.driver_name || vehicle.plate_number || vehicle.brand_model
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={count ? `Ehliyet (${count}/2 yüz) — açmak / eklemek için tıklayın` : 'Ehliyet ekle (ön ve arka yüz)'}
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-14 items-center justify-center overflow-hidden rounded-md border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60"
      >
        {thumb ? (
          <img src={thumb} alt="Ehliyet" className="size-full object-cover" />
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] font-medium">
            <IdCard className="size-3.5" /> Ekle
          </span>
        )}
        {count > 0 && (
          <span className={cn('absolute right-0 bottom-0 rounded-tl px-1 text-[9px] font-semibold', count === 2 ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground')}>
            {count}/2
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ehliyet — {who}</DialogTitle>
            <DialogDescription>Ön ve arka yüz fotoğrafı. Fotoğrafa tıklayınca resim programında açılır.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Slot vehicle={vehicle} side="license_front_path" />
            <Slot vehicle={vehicle} side="license_back_path" />
          </div>
        </DialogContent>
      </Dialog>
    </span>
  )
}
