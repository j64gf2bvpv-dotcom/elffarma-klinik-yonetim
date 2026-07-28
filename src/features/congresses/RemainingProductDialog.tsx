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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useCreateRemainingProduct } from './hooks'
import type { Product } from '@/types/database'

const schema = z.object({
  product_id: z.string().min(1, 'Ürün seçin'),
  product_name: z.string().min(1),
  quantity: z.coerce.number().int().positive('Adet 0’dan büyük olmalı'),
  unit_price: z.coerce.number().min(0),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function RemainingProductDialog({ congressId }: { congressId: string }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateRemainingProduct()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { product_id: '', product_name: '', quantity: 1, unit_price: 0 },
  })

  function handleSelectProduct(product: Product) {
    form.setValue('product_id', product.id, { shouldValidate: true })
    form.setValue('product_name', product.name, { shouldValidate: true })
    form.setValue('unit_price', product.unit_price ?? 0)
  }

  async function onSubmit(values: FormOutput) {
    await createMutation.mutateAsync({
      congress_id: congressId,
      product_name: values.product_name,
      quantity: values.quantity,
      unit_price: values.unit_price,
    })
    form.reset({ product_id: '', product_name: '', quantity: 1, unit_price: 0 })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> Kalan Ürün Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kullanılmayan / Kalan Ürün Ekle</DialogTitle>
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
