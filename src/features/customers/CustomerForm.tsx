import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import { useCreateCustomer, useHospitalNames, useUpdateCustomer } from './hooks'
import { turkeyProvinces } from '@/lib/turkeyProvinces'
import { tr } from '@/i18n/tr'
import type { Customer } from '@/types/database'

const NO_PAYMENT_METHOD = '__none__'

const schema = z.object({
  full_name: z.string().min(2, 'Ad soyad gerekli'),
  phone: z
    .string()
    .min(1, 'Telefon gerekli')
    .refine((v) => normalizeTrPhone(v) !== null, 'Geçerli bir telefon numarası girin (10 hane)'),
  email: z.string().email('Geçerli bir e-posta girin').optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
  is_invoiced: z.boolean(),
  doctor_type: z.enum(['sahis', 'hastane']),
  province: z.string().optional(),
  hospital_name: z.string().optional(),
  next_payment_due: z.string().optional(),
  total_debt: z.coerce.number().min(0).optional(),
  tc_no: z.string().optional(),
  address: z.string().optional(),
  tax_number: z.string().optional(),
  vat_rate: z.coerce.number().min(0).max(100).optional(),
  preferred_payment_method: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface CustomerFormProps {
  customer?: Customer
  trigger?: React.ReactNode
}

export function CustomerForm({ customer, trigger }: CustomerFormProps) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const { data: hospitalNames = [] } = useHospitalNames()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: customer?.full_name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      notes: customer?.notes ?? '',
      tags: customer?.tags?.join(', ') ?? '',
      is_invoiced: customer?.is_invoiced ?? false,
      doctor_type: customer?.doctor_type ?? 'sahis',
      province: customer?.province ?? '',
      hospital_name: customer?.hospital_name ?? '',
      next_payment_due: customer?.next_payment_due ?? '',
      total_debt: customer?.total_debt ?? undefined,
      tc_no: customer?.tc_no ?? '',
      address: customer?.address ?? '',
      tax_number: customer?.tax_number ?? '',
      vat_rate: customer?.vat_rate ?? undefined,
      preferred_payment_method: customer?.preferred_payment_method ?? NO_PAYMENT_METHOD,
    },
  })

  const doctorType = form.watch('doctor_type')

  React.useEffect(() => {
    if (open) {
      form.reset({
        full_name: customer?.full_name ?? '',
        phone: customer?.phone ?? '',
        email: customer?.email ?? '',
        notes: customer?.notes ?? '',
        tags: customer?.tags?.join(', ') ?? '',
        is_invoiced: customer?.is_invoiced ?? false,
        doctor_type: customer?.doctor_type ?? 'sahis',
        province: customer?.province ?? '',
        hospital_name: customer?.hospital_name ?? '',
        next_payment_due: customer?.next_payment_due ?? '',
        total_debt: customer?.total_debt ?? undefined,
        tc_no: customer?.tc_no ?? '',
        address: customer?.address ?? '',
        tax_number: customer?.tax_number ?? '',
        vat_rate: customer?.vat_rate ?? undefined,
        preferred_payment_method: customer?.preferred_payment_method ?? NO_PAYMENT_METHOD,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = {
      full_name: values.full_name,
      phone: values.phone,
      email: values.email || null,
      notes: values.notes || null,
      tags: values.tags
        ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      is_invoiced: values.is_invoiced,
      doctor_type: values.doctor_type,
      province: values.province || null,
      hospital_name: values.doctor_type === 'hastane' ? values.hospital_name || null : null,
      next_payment_due: values.next_payment_due || null,
      total_debt: values.total_debt ?? null,
      tc_no: values.tc_no || null,
      address: values.address || null,
      tax_number: values.tax_number || null,
      vat_rate: values.vat_rate ?? null,
      preferred_payment_method:
        values.preferred_payment_method && values.preferred_payment_method !== NO_PAYMENT_METHOD
          ? (values.preferred_payment_method as 'nakit' | 'kredi_karti' | 'havale')
          : null,
    }
    if (customer) {
      await updateMutation.mutateAsync({ id: customer.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Yeni Doktor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? 'Doktoru Düzenle' : 'Yeni Doktor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Soyad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ayşe Yılmaz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormLabel>E-posta (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="ornek@klinik.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="doctor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doktor Tipi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sahis">Şahıs</SelectItem>
                      <SelectItem value="hastane">Hastane</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İl (opsiyonel)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="İl seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {turkeyProvinces.map((il) => (
                        <SelectItem key={il} value={il}>
                          {il}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {doctorType === 'hastane' && (
              <FormField
                control={form.control}
                name="hospital_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hastane Adı</FormLabel>
                    <FormControl>
                      <>
                        <Input placeholder="Örn. Acıbadem Hastanesi" list="hospital-names" {...field} />
                        <datalist id="hospital-names">
                          {hospitalNames.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres (opsiyonel)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tc_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TC Kimlik No (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vergi Numarası (opsiyonel)</FormLabel>
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
                name="vat_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KDV Oranı (%, opsiyonel)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        placeholder="20"
                        {...field}
                        value={field.value as number | string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferred_payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tercih Edilen Ödeme Şekli (opsiyonel)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PAYMENT_METHOD}>Belirtilmedi</SelectItem>
                        {Object.entries(tr.paymentMethod).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_debt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticari Alacaklar (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="next_payment_due"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ödeme Vadesi (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_invoiced"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="!mt-0">Faturalı doktor</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etiketler (virgülle ayırın)</FormLabel>
                  <FormControl>
                    <Input placeholder="botoks, vip" {...field} />
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
                    <Textarea rows={3} {...field} />
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
