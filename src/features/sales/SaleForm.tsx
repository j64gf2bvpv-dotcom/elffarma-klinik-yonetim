import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react'

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
import { useCreateSale, useDeleteSale } from './hooks'
import type { SaleWithRelations } from './api'
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
  congress_name: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

const emptyProductRow = { product_id: '', product_name: '', quantity: 1, unit_price: 0 }

function defaultValues(defaultSalesRepId: string | undefined, sale?: SaleWithRelations): FormInput {
  if (sale) {
    return {
      type: sale.type,
      customer_id: sale.customer_id,
      sales_rep_id: sale.sales_rep_id ?? NO_REP,
      products: [
        {
          product_id: sale.product_id ?? '',
          product_name: sale.product_name,
          quantity: sale.quantity,
          unit_price: Number(sale.unit_price),
        },
      ],
      sale_date: sale.sale_date,
      note: sale.note ?? '',
      congress_name: sale.congress_name ?? '',
    }
  }
  return {
    type: 'sale',
    customer_id: '',
    sales_rep_id: defaultSalesRepId ?? NO_REP,
    products: [{ ...emptyProductRow }],
    sale_date: todayDate(),
    note: '',
    congress_name: '',
  }
}

/**
 * Aynı doktora/tarihe birden fazla ürün eklenebiliyor (kullanıcı isteği,
 * 2026-08-26: "ürün ekleme kısmında birden fazla ürün ekleyebilmeliyim") —
 * CustomerForm'daki "Aldığı Ürünler" ve Kargo formundaki çoklu satır
 * deseniyle aynı: tek Kaydet, her ürün satırı için ayrı bir `sales` kaydı
 * (ve dolayısıyla ayrı bir stok hareketi) oluşturuyor.
 *
 * `sale` verilirse (SalesPage'deki satır düzenle ikonu) mevcut bir kaydı
 * düzenleme moduna geçer — kullanıcı isteği, 2026-08-26: "girdiğim doktoru
 * daha sonra düzenleme yapabilmeliyim manuel". Düzenlemede de ürün satırı
 * eklenip/çıkarılabiliyor (kullanıcı isteği, 2026-08-26: "manuel düzenlemede
 * birden fazla ürün ekleme yok o da olmalı") — kaydedince eski kayıt stok
 * etkisiyle birlikte tamamen silinip, formdaki HER ürün satırı için yeni bir
 * kayıt oluşturuluyor (tek satırsa aynı kalır, birden fazlaysa tek kayıt
 * birden fazla kayda dönüşür).
 */
export function SaleForm({ defaultSalesRepId, sale }: { defaultSalesRepId?: string; sale?: SaleWithRelations }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateSale()
  const deleteMutation = useDeleteSale()
  const { data: doctors = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()
  const isEdit = !!sale

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(defaultSalesRepId, sale),
  })
  const productFields = useFieldArray({ control: form.control, name: 'products' })

  React.useEffect(() => {
    if (open) form.reset(defaultValues(defaultSalesRepId, sale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const saleType = form.watch('type')

  // `form.setValue` bir satır dizisi (field array) öğesinin değerini değiştirir
  // ama dizinin KENDİ iç takibini (useFieldArray'in `fields` anlık görüntüsü)
  // güncellemez — bu ikisi senkronsuz kalınca, `append()` (Ürün Ekle) daha
  // sonra çağrıldığında RHF önceki satırı KENDİ eski anlık görüntüsüyle
  // yeniden kuruyor, seçilen ürün sıfırlanıyordu (kullanıcı isteği,
  // 2026-08-26: "ürün eklediğimde diğerini siliyor silmesin"). Doğru yöntem,
  // field array'in kendi `update()` metodunu kullanmak — bu, hem form
  // değerini hem de dizinin iç anlık görüntüsünü birlikte günceller.
  function handleSelectProduct(index: number, product: Product) {
    productFields.update(index, {
      ...form.getValues(`products.${index}`),
      product_id: product.id,
      product_name: product.name,
      unit_price: product.unit_price ?? 0,
    })
  }

  async function onSubmit(values: FormOutput) {
    const repId = values.sales_rep_id && values.sales_rep_id !== NO_REP ? values.sales_rep_id : null
    const doctorName = doctors.find((d) => d.id === values.customer_id)?.full_name ?? 'Doktor'
    const repName = repId ? salesReps.find((r) => r.id === repId)?.name : null
    const movementNote =
      values.type === 'sale'
        ? `${doctorName} için satış${repName ? ` — ${repName} tarafından elden teslim edildi` : ''}`
        : `${doctorName} tarafından iade edildi${repName ? ` — ${repName} tarafından alındı` : ''}`

    if (isEdit && sale) {
      // Düzenlemede de birden fazla ürün eklenebilsin diye (kullanıcı
      // isteği, 2026-08-26) eski kayıt tamamen silinip (stok etkisi
      // tersine çevrilir) formdaki HER ürün satırı için yeni bir kayıt
      // oluşturuluyor — tek satırla girilmiş bir kayıt aynı kalır, birden
      // fazla satır eklenmişse tek kayıt birden fazla kayda dönüşür.
      await deleteMutation.mutateAsync(sale.id)
    }

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
        congress_name: values.congress_name || null,
        movement_note: movementNote,
      })
    }

    form.reset(defaultValues(defaultSalesRepId, sale))
    setOpen(false)
  }

  const submitting = createMutation.isPending || deleteMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> Yeni Satış / İade
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Satış/İade Düzenle' : 'Yeni Satış / İade'}</DialogTitle>
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
              name="congress_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kongre / Workshop (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="ör. İstanbul Work Shop" {...field} />
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
