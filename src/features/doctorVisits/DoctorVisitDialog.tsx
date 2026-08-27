import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Loader2, Pencil, Trash2, LogIn, LogOut, MapPin } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { PaymentForm } from '@/features/payments/PaymentForm'
import { SampleRequestForm } from '@/features/samples/SampleRequestForm'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import { useCreateVisit, useDeleteVisit, useUpdateVisit } from './hooks'
import { SignaturePad } from './SignaturePad'
import type { DoctorVisit } from '@/types/database'

const schema = z.object({
  doctor_name: z.string().min(2, 'Doktor adı gerekli'),
  customer_id: z.string().nullable().optional(),
  phone: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Geçerli bir e-posta girin')]).optional(),
  social_media: z.string().optional(),
  notes: z.string().optional(),
  discussed_products: z.string().optional(),
  competitor_products: z.string().optional(),
  next_visit_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// doctor_name kasıtlı olarak zorunlu DEĞİL (kullanıcı isteği, 2026-08-27:
// "hepsini girmeden kaydet butonu çıkabilmeli") — "Başka Doktor Ekle" ile
// açılan ekstra bir satır doldurulmadan bırakılırsa artık Kaydet'i
// tıklamayı engellemiyor; boş satırlar onSubmitBulk'ta sessizce atlanır.
const bulkSchema = z.object({
  visits: z
    .array(
      z.object({
        doctor_name: z.string().optional(),
        customer_id: z.string().nullable().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
})

type BulkFormValues = z.infer<typeof bulkSchema>

const emptyBulkRow = { doctor_name: '', customer_id: null as string | null, phone: '', notes: '' }

/**
 * Yeni doktor eklerken artık bir listeye birden fazla doktor eklenip TEK
 * "Kaydet" ile hepsi birden kaydedilebiliyor (kullanıcı isteği, 2026-08-25:
 * "listenin tamamını girdikten sonra da kaydet olsun") — önceden her doktor
 * için ayrı ayrı "Doktor Ekle" açıp kaydetmek gerekiyordu. Check-in/check-out,
 * imza, tahsilat/numune formu ve ekler gibi TEK bir ziyarete özgü zengin
 * alanlar bilerek bu toplu ekleme moduna taşınmadı (bunlar anlık/canlı
 * bilgiler, birden fazla kayıt için aynı anda doldurulması anlamsız) —
 * kaydedilen bir doktora sonradan bu detayları eklemek için satırdaki kalem
 * ikonuyla (mevcut tek-kayıt düzenleme formu, değişmedi) açıp doldurulabilir.
 */
export function DoctorVisitDialog({
  visitDate,
  salesRepId,
  visit,
}: {
  visitDate: string
  salesRepId: string
  visit?: DoctorVisit
}) {
  const [open, setOpen] = React.useState(false)
  const [checkInAt, setCheckInAt] = React.useState<string | null>(visit?.check_in_at ?? null)
  const [checkOutAt, setCheckOutAt] = React.useState<string | null>(visit?.check_out_at ?? null)
  const [checkInLat, setCheckInLat] = React.useState<number | null>(visit?.check_in_lat ?? null)
  const [checkInLng, setCheckInLng] = React.useState<number | null>(visit?.check_in_lng ?? null)
  const [signature, setSignature] = React.useState<string | null>(visit?.signature_data ?? null)
  const createMutation = useCreateVisit()
  const updateMutation = useUpdateVisit()
  const deleteMutation = useDeleteVisit()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      doctor_name: visit?.doctor_name ?? '',
      customer_id: visit?.customer_id ?? null,
      phone: visit?.phone ?? '',
      email: visit?.email ?? '',
      social_media: visit?.social_media ?? '',
      notes: visit?.notes ?? '',
      discussed_products: visit?.discussed_products ?? '',
      competitor_products: visit?.competitor_products ?? '',
      next_visit_date: visit?.next_visit_date ?? '',
    },
  })

  const bulkForm = useForm<BulkFormValues>({
    resolver: zodResolver(bulkSchema),
    defaultValues: { visits: [emptyBulkRow] },
  })
  const bulkFields = useFieldArray({ control: bulkForm.control, name: 'visits' })

  const customerId = form.watch('customer_id')

  function handleCheckIn() {
    setCheckInAt(new Date().toISOString())
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCheckInLat(pos.coords.latitude)
          setCheckInLng(pos.coords.longitude)
        },
        () => toast.warning('Konum alınamadı', { description: 'Check-in zamanı yine de kaydedildi.' }),
      )
    }
  }

  function handleCheckOut() {
    setCheckOutAt(new Date().toISOString())
  }

  async function onSubmit(values: FormValues) {
    const input = {
      visit_date: visitDate,
      sales_rep_id: salesRepId,
      doctor_name: values.doctor_name,
      customer_id: values.customer_id || null,
      phone: values.phone || null,
      email: values.email || null,
      social_media: values.social_media || null,
      notes: values.notes || null,
      discussed_products: values.discussed_products || null,
      competitor_products: values.competitor_products || null,
      next_visit_date: values.next_visit_date || null,
      check_in_at: checkInAt,
      check_out_at: checkOutAt,
      check_in_lat: checkInLat,
      check_in_lng: checkInLng,
      signature_data: signature,
    }
    await updateMutation.mutateAsync({ id: visit!.id, input })
    setOpen(false)
  }

  async function onSubmitBulk(values: BulkFormValues) {
    const filled = values.visits
      .map((v) => ({ ...v, doctor_name: v.doctor_name?.trim() ?? '' }))
      .filter((v) => v.doctor_name.length >= 2)
    if (filled.length === 0) {
      toast.error('En az bir doktor adı girin')
      return
    }
    for (const v of filled) {
      await createMutation.mutateAsync({
        visit_date: visitDate,
        sales_rep_id: salesRepId,
        doctor_name: v.doctor_name,
        customer_id: v.customer_id || null,
        phone: v.phone || null,
        email: null,
        social_media: null,
        notes: v.notes || null,
        discussed_products: null,
        competitor_products: null,
        next_visit_date: null,
        check_in_at: null,
        check_out_at: null,
        check_in_lat: null,
        check_in_lng: null,
        signature_data: null,
      })
    }
    bulkForm.reset({ visits: [{ ...emptyBulkRow }] })
    setOpen(false)
  }

  async function handleDelete() {
    if (!visit) return
    await deleteMutation.mutateAsync(visit.id)
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  if (!visit) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) bulkForm.reset({ visits: [{ ...emptyBulkRow }] })
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" /> Doktor Ekle
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Yeni Doktor(lar)</DialogTitle>
          </DialogHeader>
          <Form {...bulkForm}>
            {/* Kaydet butonu her zaman altta sabit görünsün diye (kullanıcı
                isteği, 2026-08-27: "altta kaydet butonu olmalı") — çok sayıda
                doktor eklendiğinde sadece satır listesi kayar, DialogFooter
                (Vazgeç/Kaydet) hep görünür kalır. min-h-0 burada zorunlu:
                olmazsa flex sütunu iç scroll yerine dialog'un kendisini
                büyütmeye devam eder. */}
            <form
              onSubmit={bulkForm.handleSubmit(onSubmitBulk)}
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <div className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto pr-1">
              {bulkFields.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-md border p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2">
                      <FormField
                        control={bulkForm.control}
                        name={`visits.${index}.doctor_name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Adı Soyadı</FormLabel>
                            <FormControl>
                              <Input placeholder="Dr. Ayşe Yılmaz" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={bulkForm.control}
                        name={`visits.${index}.customer_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Cari Karta Bağla (opsiyonel)</FormLabel>
                            <FormControl>
                              <CustomerCombobox value={field.value ?? undefined} onChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={bulkForm.control}
                          name={`visits.${index}.phone`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Telefon (opsiyonel)</FormLabel>
                              <FormControl>
                                <Input placeholder="0532 123 45 67" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={bulkForm.control}
                          name={`visits.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Not (opsiyonel)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    {bulkFields.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => bulkFields.remove(index)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bulkFields.append({ ...emptyBulkRow })}
              >
                <Plus className="size-3.5" /> Başka Doktor Ekle
              </Button>
              </div>
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Doktor Bilgilerini Düzenle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="doctor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adı Soyadı</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Ayşe Yılmaz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cari Karta Bağla (opsiyonel)</FormLabel>
                  <FormControl>
                    <CustomerCombobox value={field.value ?? undefined} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {customerId && (
              <div className="flex flex-wrap gap-2 rounded-lg border p-2">
                <PaymentForm defaultCustomerId={customerId} />
                <SampleRequestForm defaultCustomerId={customerId} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input placeholder="0532 123 45 67" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ayse@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="social_media"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sosyal Medya</FormLabel>
                  <FormControl>
                    <Input placeholder="@instagram_hesabi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
              <div className="grid gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={handleCheckIn}>
                  <LogIn className="size-3.5" /> Check-in
                </Button>
                {checkInAt && (
                  <p className="text-muted-foreground text-xs">
                    {format(new Date(checkInAt), 'd MMM yyyy HH:mm', { locale: trLocale })}
                    {checkInLat != null && checkInLng != null && (
                      <>
                        {' · '}
                        <a
                          href={`https://maps.google.com/?q=${checkInLat},${checkInLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          <MapPin className="size-3" /> Konum
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={handleCheckOut}>
                  <LogOut className="size-3.5" /> Check-out
                </Button>
                {checkOutAt && (
                  <p className="text-muted-foreground text-xs">
                    {format(new Date(checkOutAt), 'd MMM yyyy HH:mm', { locale: trLocale })}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discussed_products"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Görüşülen Ürünler (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="competitor_products"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rakip Ürünler (opsiyonel)</FormLabel>
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
              name="next_visit_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sonraki Ziyaret Tarihi (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                  <FormLabel>Verilen Ürün / Açıklama</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Örn. Fillicia 1 adet numune verildi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SignaturePad value={signature} onChange={setSignature} />

            <AttachmentsPanel ownerType="doctor_visit" ownerId={visit.id} />

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 /> Sil
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  Kaydet
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
