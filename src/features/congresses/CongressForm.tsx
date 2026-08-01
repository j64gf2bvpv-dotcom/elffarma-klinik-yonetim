import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Pencil, ImagePlus, Presentation } from 'lucide-react'
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
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateCongress, useUpdateCongress } from './hooks'
import { uploadCongressImage } from './api'
import type { Congress } from '@/types/database'

const schema = z.object({
  name: z.string().min(2, 'Kongre adı gerekli'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
  will_attend: z.boolean(),
  single_person_price: z.coerce.number().min(0).optional(),
  two_person_price: z.coerce.number().min(0).optional(),
  image_url: z.string().optional(),
  city: z.string().optional(),
  venue: z.string().optional(),
  hotel: z.string().optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  sponsorship_info: z.string().optional(),
  speakers: z.string().optional(),
  trainers: z.string().optional(),
  meal_plan: z.string().optional(),
  transfer_info: z.string().optional(),
  stand_info: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  campaign_info: z.string().optional(),
  video_urls: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function defaults(congress: Congress | undefined): FormInput {
  return {
    name: congress?.name ?? '',
    start_date: congress?.start_date ?? '',
    end_date: congress?.end_date ?? '',
    notes: congress?.notes ?? '',
    will_attend: congress?.will_attend ?? false,
    single_person_price: congress?.single_person_price ?? undefined,
    two_person_price: congress?.two_person_price ?? undefined,
    image_url: congress?.image_url ?? '',
    city: congress?.city ?? '',
    venue: congress?.venue ?? '',
    hotel: congress?.hotel ?? '',
    capacity: congress?.capacity ?? undefined,
    sponsorship_info: congress?.sponsorship_info ?? '',
    speakers: congress?.speakers ?? '',
    trainers: congress?.trainers ?? '',
    meal_plan: congress?.meal_plan ?? '',
    transfer_info: congress?.transfer_info ?? '',
    stand_info: congress?.stand_info ?? '',
    budget: congress?.budget ?? undefined,
    campaign_info: congress?.campaign_info ?? '',
    video_urls: congress?.video_urls?.join('\n') ?? '',
  }
}

export function CongressForm({ congress }: { congress?: Congress }) {
  const [open, setOpen] = React.useState(false)
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const createMutation = useCreateCongress()
  const updateMutation = useUpdateCongress()

  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(congress) })

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingImage(true)
    try {
      const url = await uploadCongressImage(file)
      form.setValue('image_url', url, { shouldDirty: true })
    } catch (err) {
      toast.error('Görsel yüklenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setUploadingImage(false)
    }
  }

  React.useEffect(() => {
    if (open) form.reset(defaults(congress))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = {
      name: values.name,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      notes: values.notes || null,
      will_attend: values.will_attend,
      single_person_price: values.single_person_price ?? null,
      two_person_price: values.two_person_price ?? null,
      image_url: values.image_url || null,
      city: values.city || null,
      venue: values.venue || null,
      hotel: values.hotel || null,
      capacity: values.capacity ?? null,
      sponsorship_info: values.sponsorship_info || null,
      speakers: values.speakers || null,
      trainers: values.trainers || null,
      meal_plan: values.meal_plan || null,
      transfer_info: values.transfer_info || null,
      stand_info: values.stand_info || null,
      budget: values.budget ?? null,
      campaign_info: values.campaign_info || null,
      video_urls: values.video_urls
        ? values.video_urls.split('\n').map((v) => v.trim()).filter(Boolean)
        : [],
    }
    if (congress) {
      await updateMutation.mutateAsync({ id: congress.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {congress ? (
          <Button variant="ghost" size="icon">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> Yeni Kongre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{congress ? 'Kongreyi Düzenle' : 'Yeni Kongre / Workshop'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kongre / Workshop Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Ekam Kongresi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Başlangıç Tarihi</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bitiş Tarihi (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Şehir (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="venue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salon (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hotel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Otel (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kontenjan (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bütçe (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="speakers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konuşmacılar (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trainers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Eğitmenler (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="sponsorship_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsorluk (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meal_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yemek Planı (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transfer_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stand_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stand Bilgisi (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="campaign_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kampanya (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="will_attend"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="!mt-0">Katılım sağlanacak</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="single_person_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tek Kişi Katılım Fiyatı (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="two_person_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2 Kişi Katılım Fiyatı (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Görsel (opsiyonel)</FormLabel>
                  <div className="flex items-center gap-3">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelected}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      title="Bilgisayardan görsel yükle"
                      className="hover:border-primary/50 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted transition-colors"
                    >
                      {uploadingImage ? (
                        <Loader2 className="text-muted-foreground size-5 animate-spin" />
                      ) : field.value ? (
                        <img src={field.value} alt="Kongre görseli" className="size-full object-contain" />
                      ) : (
                        <Presentation className="text-muted-foreground size-6" />
                      )}
                      <span className="bg-background/90 absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-0.5 text-[10px] font-medium">
                        <ImagePlus className="size-3" /> Yükle
                      </span>
                    </button>
                    <FormControl>
                      <Input placeholder="https://... (veya soldan yükleyin)" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="video_urls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video Linkleri (opsiyonel, her satıra bir link)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="https://youtube.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notlar</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
