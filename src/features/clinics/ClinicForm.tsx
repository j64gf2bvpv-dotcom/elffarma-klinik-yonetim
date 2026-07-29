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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { RegionPicker } from '@/features/regions/RegionPicker'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateClinic, useUpdateClinic } from './hooks'
import type { Clinic } from '@/types/database'

const NONE = '__none__'
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const schema = z.object({
  name: z.string().min(2, 'Klinik adı gerekli'),
  authorized_persons: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  tax_office: z.string().optional(),
  tax_number: z.string().optional(),
  employee_count: z.coerce.number().int().min(0).optional(),
  branch_count: z.coerce.number().int().min(0).optional(),
  sales_rep_id: z.string().optional(),
  region_id: z.string().nullable().optional(),
  category: z.string().optional(),
  is_vip: z.boolean(),
  risk_limit: z.coerce.number().min(0).optional(),
  discount_rate: z.coerce.number().min(0).max(100).optional(),
  payment_method: z.string().optional(),
  working_days: z.array(z.string()),
  maps_url: z.string().optional(),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface ClinicFormProps {
  clinic?: Clinic
  trigger?: React.ReactNode
}

export function ClinicForm({ clinic, trigger }: ClinicFormProps) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateClinic()
  const updateMutation = useUpdateClinic()
  const { data: salesReps = [] } = useSalesReps()

  function defaults(): FormInput {
    return {
      name: clinic?.name ?? '',
      authorized_persons: clinic?.authorized_persons ?? '',
      address: clinic?.address ?? '',
      phone: clinic?.phone ?? '',
      tax_office: clinic?.tax_office ?? '',
      tax_number: clinic?.tax_number ?? '',
      employee_count: clinic?.employee_count ?? undefined,
      branch_count: clinic?.branch_count ?? undefined,
      sales_rep_id: clinic?.sales_rep_id ?? NONE,
      region_id: clinic?.region_id ?? null,
      category: clinic?.category ?? '',
      is_vip: clinic?.is_vip ?? false,
      risk_limit: clinic?.risk_limit ?? undefined,
      discount_rate: clinic?.discount_rate ?? undefined,
      payment_method: clinic?.payment_method ?? '',
      working_days: clinic?.working_days ?? [],
      maps_url: clinic?.maps_url ?? '',
      notes: clinic?.notes ?? '',
    }
  }

  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() })

  React.useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const workingDays = form.watch('working_days')

  function toggleDay(day: string) {
    const current = form.getValues('working_days')
    form.setValue('working_days', current.includes(day) ? current.filter((d) => d !== day) : [...current, day])
  }

  async function onSubmit(values: FormValues) {
    const input = {
      name: values.name,
      authorized_persons: values.authorized_persons || null,
      address: values.address || null,
      phone: values.phone || null,
      tax_office: values.tax_office || null,
      tax_number: values.tax_number || null,
      employee_count: values.employee_count ?? null,
      branch_count: values.branch_count ?? null,
      sales_rep_id: values.sales_rep_id && values.sales_rep_id !== NONE ? values.sales_rep_id : null,
      region_id: values.region_id ?? null,
      category: values.category || null,
      is_vip: values.is_vip,
      risk_limit: values.risk_limit ?? null,
      discount_rate: values.discount_rate ?? null,
      payment_method: values.payment_method || null,
      working_days: values.working_days,
      maps_url: values.maps_url || null,
      notes: values.notes || null,
    }
    if (clinic) {
      await updateMutation.mutateAsync({ id: clinic.id, input })
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
            <Plus /> Yeni Klinik
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clinic ? 'Kliniği Düzenle' : 'Yeni Klinik'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Klinik Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Elit Estetik Klinik" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authorized_persons"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Yetkililer (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Dr. Ayşe Yılmaz, Sekreter Elif" {...field} />
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
                    <FormLabel>Telefon (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn. A Segment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                name="tax_office"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vergi Dairesi (opsiyonel)</FormLabel>
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
                    <FormLabel>Vergi No (opsiyonel)</FormLabel>
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
                name="employee_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Çalışan Sayısı (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branch_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Şube Sayısı (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="sales_rep_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temsilci (opsiyonel)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Belirtilmedi</SelectItem>
                      {salesReps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bölge (opsiyonel)</FormLabel>
                  <FormControl>
                    <RegionPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="risk_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Limiti (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İskonto Oranı (%, opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="0" max="100" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ödeme Şekli (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Havale, 30 gün vade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <FormLabel>Çalışma Günleri (opsiyonel)</FormLabel>
              <div className="mt-2 flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={workingDays.includes(day)} onCheckedChange={() => toggleDay(day)} />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <FormField
              control={form.control}
              name="maps_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Maps Konumu (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://maps.google.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_vip"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="!mt-0">VIP klinik</FormLabel>
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
