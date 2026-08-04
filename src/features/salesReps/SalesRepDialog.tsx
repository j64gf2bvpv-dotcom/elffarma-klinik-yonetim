import * as React from 'react'
import { Plus, Loader2, UserRound, ImagePlus } from 'lucide-react'
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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useCreateSalesRep, useUpdateSalesRep } from './hooks'
import { uploadSalesRepPhoto } from './api'
import { placeholderColor } from '@/lib/placeholderColor'
import type { SalesRep } from '@/types/database'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SalesRepDialog({ rep, trigger }: { rep?: SalesRep; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(rep?.name ?? '')
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(rep?.photo_url ?? null)
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false)
  const photoInputRef = React.useRef<HTMLInputElement>(null)
  const createMutation = useCreateSalesRep()
  const updateMutation = useUpdateSalesRep()

  React.useEffect(() => {
    if (open) {
      setName(rep?.name ?? '')
      setPhotoUrl(rep?.photo_url ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingPhoto(true)
    try {
      const url = await uploadSalesRepPhoto(file)
      setPhotoUrl(url)
    } catch (err) {
      toast.error('Fotoğraf yüklenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (rep) {
      await updateMutation.mutateAsync({ id: rep.id, input: { name: name.trim(), photo_url: photoUrl } })
    } else {
      const created = await createMutation.mutateAsync(name.trim())
      if (photoUrl) {
        await updateMutation.mutateAsync({ id: created.id, input: { photo_url: photoUrl } })
      }
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Plus /> Temsilci Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rep ? 'Temsilciyi Düzenle' : 'Yeni Satış Temsilcisi'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex justify-center">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelected}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Fotoğraf yükle"
              className="group relative"
            >
              <Avatar className="size-20">
                {photoUrl && <AvatarImage src={photoUrl} alt={name || 'Temsilci'} />}
                <AvatarFallback
                  className="text-lg text-white"
                  style={name ? { backgroundColor: placeholderColor(name) } : undefined}
                >
                  {name ? getInitials(name) : <UserRound className="size-8" />}
                </AvatarFallback>
              </Avatar>
              <span className="bg-background/90 absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-full py-0.5 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingPhoto ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
              </span>
            </button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-name">Adı Soyadı</Label>
            <Input
              id="rep-name"
              placeholder="Ahmet Yılmaz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="animate-spin" />}
              {rep ? 'Kaydet' : 'Ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
