import * as React from 'react'
import { useForm } from 'react-hook-form'
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
    if (visit) {
      await updateMutation.mutateAsync({ id: visit.id, input })
    } else {
      await createMutation.mutateAsync(input)
      form.reset({
        doctor_name: '',
        customer_id: null,
        phone: '',
        email: '',
        social_media: '',
        notes: '',
        discussed_products: '',
        competitor_products: '',
        next_visit_date: '',
      })
      setCheckInAt(null)
      setCheckOutAt(null)
      setCheckInLat(null)
      setCheckInLng(null)
      setSignature(null)
    }
    setOpen(false)
  }

  async function handleDelete() {
    if (!visit) return
    await deleteMutation.mutateAsync(visit.id)
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {visit ? (
          <Button variant="ghost" size="icon">
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" /> Doktor Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visit ? 'Doktor Bilgilerini Düzenle' : 'Yeni Doktor'}</DialogTitle>
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

            {visit && (
              <AttachmentsPanel ownerType="doctor_visit" ownerId={visit.id} />
            )}

            <DialogFooter className="sm:justify-between">
              {visit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 /> Sil
                </Button>
              ) : (
                <span />
              )}
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
