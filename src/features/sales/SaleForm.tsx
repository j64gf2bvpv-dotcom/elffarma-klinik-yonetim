import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Trash2 } from 'lucide-react'

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
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateSale } from './hooks'
import type { Product } from '@/types/database'

const NO_REP = '__none__'

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const schema = z.object({
  type: z.enum(['sale', 'return']),
  customer_id: z.string().min(1, 'Doktor seçin'),
  sales_rep_id: z.string().optional(),
  products: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Ürün seçin'),
        product_name: z.string().min(1),
        quantity: z.coerce.number().int().positive('Adet 0’dan büyük olmalı'),
        unit_price: z.coerce.number().min(0),
      }),
    )
    .min(1),
  sale_date: z.string().min(1),
  note: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

const emptyProductRow = { product_id: '', product_name: '', quantity: 1, unit_price: 0 }

function defaultValues(defaultSalesRepId: string | undefined): FormInput {
  return {
    type: 'sale',
    customer_id: '',
    sales_rep_id: defaultSalesRepId ?? NO_REP,
    products: [{ ...emptyProductRow }],
    sale_date: todayDate(),
    note: '',
  }
}

/**
 * Aynı doktora/tarihe birden fazla ürün eklenebiliyor (kullanıcı isteği,
 * 2026-08-26: "ürün ekleme kısmında birden fazla ürün ekleyebilmeliyim") —
 * CustomerForm'daki "Aldığı Ürünler" ve Kargo formundaki çoklu satır
 * deseniyle aynı: tek Kaydet, her ürün satırı için ayrı bir `sales` kaydı
 * (ve dolayısıyla ayrı bir stok hareketi) oluşturuyor.
 */
export function SaleForm({ defaultSalesRepId }: { defaultSalesRepId?: string }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateSale()
  const { data: doctors = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(defaultSalesRepId),
  })
  const productFields = useFieldArray({ control: form.control, name: 'products' })

  const saleType = form.watch('type')

  function handleSelectProduct(index: number, product: Product) {
    form.setValue(`products.${index}.product_id`, product.id, { shouldValidate: true })
    form.setValue(`products.${index}.product_name`, product.name, { shouldValidate: true })
    form.setValue(`products.${index}.unit_price`, product.unit_price ?? 0)
  }

  async function onSubmit(values: FormOutput) {
    const repId = values.sales_rep_id && values.sales_rep_id !== NO_REP ? values.sales_rep_id : null
    const doctorName = doctors.find((d) => d.id === values.customer_id)?.full_name ?? 'Doktor'
    const repName = repId ? salesReps.find((r) => r.id === repId)?.name : null
    const movementNote =
      values.type === 'sale'
        ? `${doctorName} için satış${repName ? ` — ${repName} tarafından elden teslim edildi` : ''}`
        : `${doctorName} tarafından iade edildi${repName ? ` — ${repName} tarafından alındı` : ''}`

    for (const product of values.products) {
      await createMutation.mutateAsync({
        type: values.type,
        customer_id: values.customer_id,
        sales_rep_id: repId,
        product_id: product.product_id,
        product_name: product.product_name,
        quantity: product.quantity,
        unit_price: product.unit_price,
        sale_date: values.sale_date,
        note: values.note || null,
        movement_note: movementNote,
      })
    }

    form.reset(defaultValues(defaultSalesRepId))
    setOpen(false)
  }

  const submitting = createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Yeni Satış / İade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Satış / İade</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İşlem Türü</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sale">Satış (stoktan çıkar)</SelectItem>
                      <SelectItem value="return">İade (stoğa geri ekler)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{saleType === 'return' ? 'İadeyi Yapan Doktor' : 'Doktor'}</FormLabel>
                  <FormControl>
                    <CustomerCombobox value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Ürünler</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => productFields.append({ ...emptyProductRow })}
                >
                  <Plus className="size-3.5" /> Ürün Ekle
                </Button>
              </div>
              {productFields.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-md border p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <ProductCombobox
                        value={form.watch(`products.${index}.product_id`)}
                        onChange={(product) => handleSelectProduct(index, product)}
                      />
                    </div>
                    {productFields.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => productFields.remove(index)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`products.${index}.quantity`}
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
                      name={`products.${index}.unit_price`}
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
              name="sales_rep_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {saleType === 'return' ? 'İadeyi Alan Satış Temsilcisi (opsiyonel)' : 'Elden Teslim Eden Satış Temsilcisi (opsiyonel)'}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_REP}>Belirtilmedi</SelectItem>
                      {salesReps
                        .filter((r) => r.is_active)
                        .map((rep) => (
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
              name="sale_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarih</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
