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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateProduct, useProductCatalogs, useUpdateProduct } from './hooks'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import type { Product } from '@/types/database'

const NO_BRAND = '__none__'

/** StockPage.tsx'teki aynı isimli fonksiyonla birebir — sadece dermakor/swiss
 * için düzgün büyük harfli görünüm, yeni eklenen kataloglar yazıldığı gibi. */
function catalogLabel(name: string) {
  if (name === 'dermakor') return 'Dermakor'
  if (name === 'swiss') return 'Swiss'
  return name
}

const schema = z.object({
  name: z.string().min(2, 'Ürün adı gerekli'),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1, 'Birim gerekli'),
  critical_stock_threshold: z.coerce.number().int().min(0),
  flakon_per_package: z.coerce.number().int().positive('0’dan büyük olmalı').optional(),
  unit_cost: z.coerce.number().min(0).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  campaign: z.string().optional(),
  expiry_date: z.string().optional(),
  barcode: z.string().optional(),
  brand_line: z.string().optional(),
  image_url: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function ProductForm({ product, trigger }: { product?: Product; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const { data: catalogs = [] } = useProductCatalogs()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      category: product?.category ?? '',
      unit: product?.unit ?? 'Paket',
      critical_stock_threshold: product?.critical_stock_threshold ?? 5,
      flakon_per_package: product?.flakon_per_package ?? undefined,
      unit_cost: product?.unit_cost ?? undefined,
      unit_price: product?.unit_price ?? undefined,
      campaign: product?.campaign ?? '',
      expiry_date: product?.expiry_date ?? '',
      barcode: product?.barcode ?? '',
      brand_line: product?.brand_line ?? NO_BRAND,
      image_url: product?.image_url ?? '',
    },
  })

  async function onSubmit(values: FormOutput) {
    const input = {
      name: values.name,
      sku: values.sku || null,
      category: values.category || null,
      unit: values.unit,
      critical_stock_threshold: values.critical_stock_threshold,
      flakon_per_package: values.flakon_per_package ?? null,
      unit_cost: values.unit_cost ?? null,
      unit_price: values.unit_price ?? null,
      campaign: values.campaign || null,
      expiry_date: values.expiry_date || null,
      barcode: values.barcode || null,
      brand_line: values.brand_line && values.brand_line !== NO_BRAND ? values.brand_line : null,
      image_url: values.image_url || null,
    }
    if (product) {
      await updateMutation.mutateAsync({ id: product.id, input })
    } else {
      await createMutation.mutateAsync(input)
      form.reset()
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (product ? (
            <Button variant="ghost" size="icon">
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button>
              <Plus /> Yeni Ürün
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Ürünü Düzenle' : 'Yeni Ürün'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ürün Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Botoks 100u" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stok Kodu / SKU (opsiyonel)</FormLabel>
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
                    <FormLabel>Kategori</FormLabel>
                    <FormControl>
                      <Input placeholder="Dolgu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim</FormLabel>
                    <FormControl>
                      <Input placeholder="Paket, ml, kutu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="critical_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kritik Stok Eşiği</FormLabel>
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
              name="flakon_per_package"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paket İçinde Kaç Flakon Var (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Boş bırakılırsa flakon takibi kullanılmaz"
                      {...field}
                      value={field.value as number | string | undefined}
                    />
                  </FormControl>
                  {product && product.flakon_per_package == null && (
                    <p className="text-muted-foreground text-xs">
                      Kaydedince flakon sayısı mevcut paket adedine göre otomatik hesaplanır (ör. 5 paket × 10
                      flakon = 50 flakon) — bazı kutular zaten açıksa "Stok Hareketi Ekle"den flakon birimiyle
                      düzeltebilirsiniz.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim Maliyet (₺, opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
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
                    <FormLabel>Satış Fiyatı (₺, opsiyonel)</FormLabel>
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
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barkod (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input placeholder="8690..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Son Kullanım Tarihi (opsiyonel)</FormLabel>
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
              name="brand_line"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Katalog / Ürün Hattı (opsiyonel)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_BRAND}>Belirtilmedi</SelectItem>
                      {catalogs.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {catalogLabel(c.name)}
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
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ürün Görseli URL (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="campaign"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kampanya (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="5+1, 10+2 / 20+5 / 30+8" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {product && (
              <div className="border-t pt-4">
                <AttachmentsPanel ownerType="product" ownerId={product.id} />
              </div>
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
