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
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { useCreatePayment } from '@/features/payments/hooks'
import { tr } from '@/i18n/tr'
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
  product_id: z.string().min(1, 'Ürün seçin'),
  product_name: z.string().min(1),
  quantity: z.coerce.number().int().positive('Adet 0’dan büyük olmalı'),
  unit_price: z.coerce.number().min(0),
  sale_date: z.string().min(1),
  note: z.string().optional(),
  collect_payment: z.boolean(),
  payment_amount: z.coerce.number().min(0).optional(),
  payment_method: z.enum(['nakit', 'kredi_karti', 'havale']).optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function SaleForm({ defaultSalesRepId }: { defaultSalesRepId?: string }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateSale()
  const recordMovement = useRecordStockMovement()
  const createPayment = useCreatePayment()
  const { data: doctors = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()

  const defaultValues: FormInput = {
    type: 'sale',
    customer_id: '',
    sales_rep_id: defaultSalesRepId ?? NO_REP,
    product_id: '',
    product_name: '',
    quantity: 1,
    unit_price: 0,
    sale_date: todayDate(),
    note: '',
    collect_payment: false,
    payment_amount: undefined,
    payment_method: 'nakit',
  }

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const saleType = form.watch('type')
  const collectPayment = form.watch('collect_payment')
  const quantity = form.watch('quantity')
  const unitPrice = form.watch('unit_price')

  React.useEffect(() => {
    if (collectPayment) {
      form.setValue('payment_amount', Number(quantity || 0) * Number(unitPrice || 0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectPayment, quantity, unitPrice])

  function handleSelectProduct(product: Product) {
    form.setValue('product_id', product.id, { shouldValidate: true })
    form.setValue('product_name', product.name, { shouldValidate: true })
    form.setValue('unit_price', product.unit_price ?? 0)
  }

  async function onSubmit(values: FormOutput) {
    const repId = values.sales_rep_id && values.sales_rep_id !== NO_REP ? values.sales_rep_id : null
    await createMutation.mutateAsync({
      type: values.type,
      customer_id: values.customer_id,
      sales_rep_id: repId,
      product_id: values.product_id,
      product_name: values.product_name,
      quantity: values.quantity,
      unit_price: values.unit_price,
      sale_date: values.sale_date,
      note: values.note || null,
    })

    const doctorName = doctors.find((d) => d.id === values.customer_id)?.full_name ?? 'Doktor'
    const repName = repId ? salesReps.find((r) => r.id === repId)?.name : null

    await recordMovement.mutateAsync({
      product_id: values.product_id,
      movement_type: values.type === 'sale' ? 'out' : 'in',
      quantity: values.quantity,
      reason: values.type === 'sale' ? 'Satış' : 'İade',
      customer_id: values.customer_id,
      note:
        values.type === 'sale'
          ? `${doctorName} için satış${repName ? ` — ${repName} tarafından elden teslim edildi` : ''}`
          : `${doctorName} tarafından iade edildi${repName ? ` — ${repName} tarafından alındı` : ''}`,
    })

    if (values.type === 'sale' && values.collect_payment && values.payment_amount && values.payment_amount > 0) {
      await createPayment.mutateAsync({
        customer_id: values.customer_id,
        amount: values.payment_amount,
        payment_method: values.payment_method ?? 'nakit',
        description: `Satış tahsilatı: ${values.product_name}`,
        paid_at: new Date().toISOString(),
        sales_rep_id: repId,
      })
    }

    form.reset(defaultValues)
    setOpen(false)
  }

  const submitting = createMutation.isPending || recordMovement.isPending || createPayment.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Yeni Satış / İade
        </Button>
      </DialogTrigger>
      <DialogContent>
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
            <FormField
              control={form.control}
              name="product_id"
              render={() => (
                <FormItem>
                  <FormLabel>Ürün</FormLabel>
                  <FormControl>
                    <ProductCombobox value={form.watch('product_id')} onChange={handleSelectProduct} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adet</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim Fiyat</FormLabel>
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
            {saleType === 'sale' && (
              <>
                <FormField
                  control={form.control}
                  name="collect_payment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                      </FormControl>
                      <FormLabel className="!mt-0">Bu satış için hemen tahsilat al</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {collectPayment && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="payment_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tahsilat Tutarı</FormLabel>
                          <FormControl>
                            <CurrencyInput value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ödeme Yöntemi</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                )}
              </>
            )}
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
