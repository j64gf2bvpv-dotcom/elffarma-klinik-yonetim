import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Package, Trash2, Boxes } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ExportMenu } from '@/components/ExportMenu'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { cn } from '@/lib/utils'
import type { Product, CongressStockItem, CongressStockItemStatus } from '@/types/database'
import {
  useCongressStockItems,
  useCreateCongressStockItem,
  useDeleteCongressStockItem,
  useUpdateCongressStockItemStatus,
} from './hooks'

// Not: 'sarf_edildi' durumu artık ayrı "Sarf Malzeme" bölümüne taşındı —
// buradaki seçilebilir listede bilerek yok, ama eski kayıtlar için etiket/
// renk hâlâ tanımlı (Record<CongressStockItemStatus,...> tip güvenliği için).
const statusLabels: Record<CongressStockItemStatus, string> = {
  goturuldu: 'Götürüldü (Bekliyor)',
  kullanildi: 'Kullanıldı / Satıldı',
  sarf_edildi: 'Sarf Edildi',
  geri_dondu: 'Geri Döndü',
}

const selectableStatuses: CongressStockItemStatus[] = ['goturuldu', 'kullanildi', 'geri_dondu']

const statusTone: Record<CongressStockItemStatus, string> = {
  goturuldu: 'border-warning/30 bg-warning/10 text-warning-foreground',
  kullanildi: 'border-success/30 bg-success/10 text-success',
  sarf_edildi: 'border-primary/30 bg-primary/10 text-primary',
  geri_dondu: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

const schema = z.object({
  product_id: z.string().min(1, 'Ürün seçin'),
  product_name: z.string().min(1),
  quantity: z.coerce.number().int().positive('Adet 0’dan büyük olmalı'),
  unit_price: z.coerce.number().min(0),
  note: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function AddStockItemDialog({ congressId, congressName }: { congressId: string; congressName?: string }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCongressStockItem()
  const recordMovementMutation = useRecordStockMovement()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { product_id: '', product_name: '', quantity: 1, unit_price: 0, note: '' },
  })

  function handleSelectProduct(product: Product) {
    form.setValue('product_id', product.id, { shouldValidate: true })
    form.setValue('product_name', product.name, { shouldValidate: true })
    form.setValue('unit_price', product.unit_price ?? 0)
  }

  async function onSubmit(values: FormOutput) {
    await createMutation.mutateAsync({
      congress_id: congressId,
      product_id: values.product_id,
      product_name: values.product_name,
      quantity: values.quantity,
      unit_price: values.unit_price,
      note: values.note?.trim() || null,
    })
    await recordMovementMutation.mutateAsync({
      product_id: values.product_id,
      movement_type: 'out',
      quantity: values.quantity,
      reason: 'Kongre/Workshop için götürüldü',
      note: congressName ?? 'Kongre/Workshop',
    })
    form.reset({ product_id: '', product_name: '', quantity: 1, unit_price: 0, note: '' })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> Ürün Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Götürülen Ürün Ekle</DialogTitle>
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
                    <FormLabel>Götürülen Adet</FormLabel>
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
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Not (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Örn. stand vitrini için" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={createMutation.isPending || recordMovementMutation.isPending}>
                {(createMutation.isPending || recordMovementMutation.isPending) && (
                  <Loader2 className="animate-spin" />
                )}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

/**
 * Kongreye/workshopa götürülen ürünlerin tek listesi: götürülürken gerçek
 * stoktan düşülür, durum değiştikçe (özellikle "Geri Döndü") stok telafi
 * hareketi otomatik kaydedilir. "Götürüldü (Bekliyor)" durumunda kalan
 * satırlar henüz kullanılmamış/dönmemiş — bekleyen/eksik olarak sayılır.
 */
export function CongressStockItemsPanel({
  congressId,
  congressName,
}: {
  congressId: string
  congressName?: string
}) {
  const { data: items = [], isLoading } = useCongressStockItems(congressId)
  const updateStatusMutation = useUpdateCongressStockItemStatus()
  const deleteMutation = useDeleteCongressStockItem()
  const recordMovementMutation = useRecordStockMovement()

  async function handleStatusChange(item: CongressStockItem, newStatus: CongressStockItemStatus) {
    if (newStatus === item.status) return
    // Stok sadece "Geri Döndü" durumuna girip çıkarken hareket ediyor —
    // diğer geçişler (götürüldü/kullanıldı/sarf edildi arası) stoğun zaten
    // dışarıda olduğu durumlar, tekrar hareket kaydına gerek yok.
    if (item.product_id) {
      if (newStatus === 'geri_dondu' && item.status !== 'geri_dondu') {
        await recordMovementMutation.mutateAsync({
          product_id: item.product_id,
          movement_type: 'return',
          quantity: item.quantity,
          reason: 'Kongre/Workshop — kullanılmayıp stoğa iade edildi',
          note: congressName ?? 'Kongre/Workshop',
        })
      } else if (item.status === 'geri_dondu' && newStatus !== 'geri_dondu') {
        await recordMovementMutation.mutateAsync({
          product_id: item.product_id,
          movement_type: 'out',
          quantity: item.quantity,
          reason: 'Kongre/Workshop — iade edilen ürün tekrar kullanıldı',
          note: congressName ?? 'Kongre/Workshop',
        })
      }
    }
    await updateStatusMutation.mutateAsync({ id: item.id, status: newStatus, congressId })
  }

  async function handleDelete(item: CongressStockItem) {
    if (!confirm(`${item.product_name} (${item.quantity} adet) silinsin mi?`)) return
    // Stok hâlâ dışarıdaysa (geri dönmemişse) silmeden önce stoğa iade et,
    // aksi halde kayıt silinir ama ürün stokta bir daha görünmez.
    if (item.product_id && item.status !== 'geri_dondu') {
      await recordMovementMutation.mutateAsync({
        product_id: item.product_id,
        movement_type: 'return',
        quantity: item.quantity,
        reason: 'Kongre/Workshop kaydı silindi — stoğa iade',
        note: congressName ?? 'Kongre/Workshop',
      })
    }
    await deleteMutation.mutateAsync({ id: item.id, congressId })
  }

  const pendingQty = items.filter((i) => i.status === 'goturuldu').reduce((sum, i) => sum + i.quantity, 0)
  const pendingProductCount = new Set(items.filter((i) => i.status === 'goturuldu').map((i) => i.product_name)).size

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Boxes className="size-4 text-primary" /> Ürün Takibi (Stoktan)
          {pendingQty > 0 && (
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning-foreground">
              {pendingProductCount} üründe {pendingQty} adet bekliyor
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <ExportMenu<CongressStockItem>
              title="Ürün Takibi"
              filename="kongre-urun-takibi"
              rows={items}
              columns={[
                { header: 'Ürün', value: (i) => i.product_name },
                { header: 'Adet', value: (i) => i.quantity },
                { header: 'Durum', value: (i) => statusLabels[i.status] },
                { header: 'Birim Fiyat', value: (i) => i.unit_price ?? '' },
              ]}
            />
          )}
          <AddStockItemDialog congressId={congressId} congressName={congressName} />
        </div>
      </div>
      <Card>
        <CardContent className="grid gap-1.5 p-4">
          {isLoading && <p className="text-muted-foreground text-sm">Yükleniyor...</p>}
          {!isLoading && items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Henüz kongreye/workshopa götürülen stoktan ürün kaydı yok.
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm',
                item.status === 'goturuldu' && 'border-warning/25 bg-warning/5',
              )}
            >
              <Package className="text-muted-foreground size-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.product_name}</p>
                <p className="text-muted-foreground text-xs">
                  {item.quantity} adet
                  {item.unit_price != null ? ` @ ${currency(Number(item.unit_price))}` : ''}
                  {item.note ? ` — ${item.note}` : ''}
                </p>
              </div>
              <Select
                value={item.status}
                onValueChange={(v) => handleStatusChange(item, v as CongressStockItemStatus)}
              >
                <SelectTrigger className={cn('h-8 w-[190px] text-xs', statusTone[item.status])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="Sil">
                <Trash2 className="text-destructive size-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
