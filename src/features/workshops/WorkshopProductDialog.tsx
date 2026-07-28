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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateSale } from '@/features/sales/hooks'
import { useCreateWorkshopProduct } from './hooks'
import type { Product } from '@/types/database'

const NO_REP = '__none__'

const schema = z.object({
  product_id: z.string().min(1, 'Ürün seçin'),
  product_name: z.string().min(1),
  quantity: z.coerce.number().int().positive('Adet 0’dan büyük olmalı'),
  unit_price: z.coerce.number().min(0),
  sales_rep_id: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/**
 * Workshopta bir doktora ürün verildiğinde üç şeyi birden yapar (kongre ürün dağıtımıyla
 * aynı iki adımlı desen + satış raporlarına yansıması için bir adım daha):
 * 1) workshop_products satırı, 2) stoktan düşüm (record_stock_movement RPC),
 * 3) sales tablosuna satır — böylece Satışlar/Cari Hesap/Satış Raporları bu ürünü otomatik görür.
 */
export function WorkshopProductDialog({
  participantId,
  workshopId,
  workshopName,
  doctorName,
  customerId,
}: {
  participantId: string
  workshopId: string
  workshopName?: string
  doctorName?: string
  customerId: string
}) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateWorkshopProduct()
  const recordMovementMutation = useRecordStockMovement()
  const createSaleMutation = useCreateSale()
  const { data: salesReps = [] } = useSalesReps()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { product_id: '', product_name: '', quantity: 1, unit_price: 0, sales_rep_id: NO_REP },
  })

  function handleSelectProduct(product: Product) {
    form.setValue('product_id', product.id, { shouldValidate: true })
    form.setValue('product_name', product.name, { shouldValidate: true })
    form.setValue('unit_price', product.unit_price ?? 0)
  }

  async function onSubmit(values: FormOutput) {
    const repId = values.sales_rep_id && values.sales_rep_id !== NO_REP ? values.sales_rep_id : null
    await createMutation.mutateAsync({
      workshopId,
      workshop_id: workshopId,
      participant_id: participantId,
      product_id: values.product_id,
      quantity: values.quantity,
      unit_price: values.unit_price,
      sales_rep_id: repId,
    })
    await recordMovementMutation.mutateAsync({
      product_id: values.product_id,
      movement_type: 'out',
      quantity: values.quantity,
      reason: 'Workshop',
      customer_id: customerId,
      note: `${workshopName ?? 'Workshop'}${doctorName ? ' - Doktor: ' + doctorName : ''}`,
    })
    await createSaleMutation.mutateAsync({
      type: 'sale',
      customer_id: customerId,
      sales_rep_id: repId,
      product_id: values.product_id,
      product_name: values.product_name,
      quantity: values.quantity,
      unit_price: values.unit_price,
      sale_date: todayDate(),
      note: `Workshop: ${workshopName ?? ''}`.trim(),
    })
    form.reset({ product_id: '', product_name: '', quantity: 1, unit_price: 0, sales_rep_id: NO_REP })
    setOpen(false)
  }

  const submitting = createMutation.isPending || recordMovementMutation.isPending || createSaleMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> Ürün Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ürün Ekle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ürün (Stoktan Seç)</FormLabel>
                  <FormControl>
                    <ProductCombobox value={field.value} onChange={handleSelectProduct} />
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
                  <FormLabel>Satışı Yapan Temsilci (opsiyonel)</FormLabel>
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
