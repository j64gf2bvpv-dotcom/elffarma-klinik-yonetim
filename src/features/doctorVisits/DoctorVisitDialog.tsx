import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react'

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
import { useCustomers } from '@/features/customers/hooks'
import { useCreateVisit, useDeleteVisit, useUpdateVisit } from './hooks'
import type { DoctorVisit } from '@/types/database'

const schema = z.object({
  doctor_name: z.string().min(2, 'Doktor adı gerekli'),
  customer_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Geçerli bir e-posta girin')]).optional(),
  social_media: z.string().optional(),
  notes: z.string().optional(),
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
  const createMutation = useCreateVisit()
  const updateMutation = useUpdateVisit()
  const deleteMutation = useDeleteVisit()
  const { data: customers = [] } = useCustomers('')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      doctor_name: visit?.doctor_name ?? '',
      customer_id: visit?.customer_id ?? undefined,
      phone: visit?.phone ?? '',
      email: visit?.email ?? '',
      social_media: visit?.social_media ?? '',
      notes: visit?.notes ?? '',
    },
  })

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
    }
    if (visit) {
      await updateMutation.mutateAsync({ id: visit.id, input })
    } else {
      await createMutation.mutateAsync(input)
      form.reset({ doctor_name: '', customer_id: undefined, phone: '', email: '', social_media: '', notes: '' })
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{visit ? 'Doktor Bilgilerini Düzenle' : 'Yeni Doktor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cari Karttan Doktor Seç (opsiyonel)</FormLabel>
                  <FormControl>
                    <CustomerCombobox
                      value={field.value}
                      onChange={(customerId) => {
                        field.onChange(customerId)
                        const customer = customers.find((c) => c.id === customerId)
                        if (customer) form.setValue('doctor_name', customer.full_name)
                      }}
                      placeholder="Kayıtlıysa cari karttan seçin"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
