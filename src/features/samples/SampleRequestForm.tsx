import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Trash2, Package } from 'lucide-react'

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
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateSampleRequest } from './hooks'
import type { Product } from '@/types/database'

const NO_SALES_REP = '__none__'

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const schema = z.object({
  customer_id: z.string().min(1, 'Doktor seçin'),
  sales_rep_id: z.string().optional(),
  request_date: z.string().min(1),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Ürün seçin'),
        lot_no: z.string().optional(),
        expiry_date: z.string().optional(),
        quantity: z.coerce.number().int().positive('Adet 0’dan büyük olmalı'),
        unit_price: z.coerce.number().min(0),
      }),
    )
    .min(1, 'En az bir ürün ekleyin'),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface SampleRequestFormProps {
  defaultCustomerId?: string
  trigger?: React.ReactNode
}

export function SampleRequestForm({ defaultCustomerId, trigger }: SampleRequestFormProps) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateSampleRequest()
  const { data: salesReps = [] } = useSalesReps()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: defaultCustomerId ?? '',
      sales_rep_id: NO_SALES_REP,
      request_date: todayDate(),
      note: '',
      items: [{ product_id: '', lot_no: '', expiry_date: '', quantity: 1, unit_price: 0 }],
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        customer_id: defaultCustomerId ?? '',
        sales_rep_id: NO_SALES_REP,
        request_date: todayDate(),
        note: '',
        items: [{ product_id: '', lot_no: '', expiry_date: '', quantity: 1, unit_price: 0 }],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCustomerId])

  const itemFields = useFieldArray({ control: form.control, name: 'items' })

  function handleSelectProduct(index: number, product: Product) {
    form.setValue(`items.${index}.product_id`, product.id, { shouldValidate: true })
    form.setValue(`items.${index}.unit_price`, product.unit_price ?? 0)
  }

  async function onSubmit(values: FormValues) {
    await createMutation.mutateAsync({
      customer_id: values.customer_id,
      sales_rep_id: values.sales_rep_id && values.sales_rep_id !== NO_SALES_REP ? values.sales_rep_id : null,
      request_date: values.request_date,
      note: values.note || null,
      items: values.items.map((i) => ({
        product_id: i.product_id,
        lot_no: i.lot_no || null,
        expiry_date: i.expiry_date || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Yeni Numune Talebi
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Numune Talebi</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value={NO_SALES_REP}>Belirtilmedi</SelectItem>
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
                name="request_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Talep Tarihi</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Package className="size-4" /> Ürünler
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemFields.append({ product_id: '', lot_no: '', expiry_date: '', quantity: 1, unit_price: 0 })
                  }
                >
                  <Plus className="size-3.5" /> Ürün Ekle
                </Button>
              </div>
              {itemFields.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-md border p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <ProductCombobox
                        value={form.watch(`items.${index}.product_id`)}
                        onChange={(product) => handleSelectProduct(index, product)}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => itemFields.remove(index)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.lot_no`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Lot No (opsiyonel)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.expiry_date`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">SKT (opsiyonel)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Adet</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} value={field.value as number | string} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Birim Fiyat</FormLabel>
                          <FormControl>
                            <CurrencyInput value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Not (opsiyonel)</FormLabel>
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
