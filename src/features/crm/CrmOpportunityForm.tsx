import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Pencil } from 'lucide-react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateCrmOpportunity, useUpdateCrmOpportunity } from './hooks'
import { tr } from '@/i18n/tr'
import type { CrmOpportunityWithRelations } from './api'

const NO_REP = '__none__'

const schema = z.object({
  customer_id: z.string().min(1, 'Doktor seçin'),
  title: z.string().min(2, 'Başlık gerekli'),
  stage: z.enum(['yeni', 'teklif', 'muzakere', 'kazanildi', 'kaybedildi']),
  amount: z.coerce.number().min(0).optional(),
  expected_close_date: z.string().optional(),
  sales_rep_id: z.string().optional(),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface CrmOpportunityFormProps {
  defaultCustomerId?: string
  opportunity?: CrmOpportunityWithRelations
  trigger?: React.ReactNode
}

export function CrmOpportunityForm({ defaultCustomerId, opportunity, trigger }: CrmOpportunityFormProps) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCrmOpportunity()
  const updateMutation = useUpdateCrmOpportunity()
  const { data: salesReps = [] } = useSalesReps()

  function defaults(): FormInput {
    return {
      customer_id: opportunity?.customer_id ?? defaultCustomerId ?? '',
      title: opportunity?.title ?? '',
      stage: opportunity?.stage ?? 'yeni',
      amount: opportunity?.amount ?? undefined,
      expected_close_date: opportunity?.expected_close_date ?? '',
      sales_rep_id: opportunity?.sales_rep_id ?? NO_REP,
      notes: opportunity?.notes ?? '',
    }
  }

  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() })

  React.useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = {
      customer_id: values.customer_id,
      title: values.title,
      stage: values.stage,
      amount: values.amount ?? null,
      expected_close_date: values.expected_close_date || null,
      sales_rep_id: values.sales_rep_id && values.sales_rep_id !== NO_REP ? values.sales_rep_id : null,
      notes: values.notes || null,
    }
    if (opportunity) {
      await updateMutation.mutateAsync({ id: opportunity.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (opportunity ? (
            <Button variant="ghost" size="icon">
              <Pencil className="size-3.5" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Plus className="size-3.5" /> Fırsat Ekle
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{opportunity ? 'Fırsatı Düzenle' : 'Yeni Fırsat'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {!defaultCustomerId && (
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doktor</FormLabel>
                    <FormControl>
                      <CustomerCombobox value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Dermakor paket teklifi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aşama</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(tr.crmOpportunityStage).map(([value, label]) => (
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
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tutar (opsiyonel)</FormLabel>
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
                name="expected_close_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beklenen Kapanış (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value={NO_REP}>Belirtilmedi</SelectItem>
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
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notlar (opsiyonel)</FormLabel>
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
