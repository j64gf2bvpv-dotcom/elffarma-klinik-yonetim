import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Package, Trash2, Boxes, CheckCircle2, Undo2 } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

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

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
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

/**
 * Hem "Kongreye Götürülen Ürün" hem "Kongrede Kullanılan Ürün" panelinin
 * ekleme diyaloğu — ikisi de aynı stok RPC'sini tetikler (eklenirken
 * stoktan düşer). Sadece başlangıç durumu farklı: götürülen panelinde
 * 'goturuldu', kullanılan panelinde direkt 'kullanildi' (stok tarafında
 * fark yok, ikisi de "dışarıda" — sadece iş akışı adımı farklı).
 */
function AddStockItemDialog({
  congressId,
  congressName,
  targetStatus,
  triggerLabel,
  dialogTitle,
  reasonNote,
}: {
  congressId: string
  congressName?: string
  targetStatus: CongressStockItemStatus
  triggerLabel: string
  dialogTitle: string
  reasonNote: string
}) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCongressStockItem()
  const updateStatusMutation = useUpdateCongressStockItemStatus()
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
    const created = await createMutation.mutateAsync({
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
      reason: reasonNote,
      note: congressName ?? 'Kongre/Workshop',
    })
    if (targetStatus !== 'goturuldu') {
      await updateStatusMutation.mutateAsync({ id: created.id, status: targetStatus, congressId })
    }
    form.reset({ product_id: '', product_name: '', quantity: 1, unit_price: 0, note: '' })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
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
              <Button
                type="submit"
                disabled={createMutation.isPending || recordMovementMutation.isPending || updateStatusMutation.isPending}
              >
                {(createMutation.isPending || recordMovementMutation.isPending || updateStatusMutation.isPending) && (
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

/**
 * İki bağlı panel, tek tabloyu (congress_stock_items) paylaşır: "Kongreye
 * Götürülen Ürün" (goturuldu/geri_dondu durumundakiler) ve altında
 * "Kongrede Kullanılan Ürün" (kullanildi durumundakiler). İkisi de gerçek
 * stokla bağlantılı — eklenirken stoktan düşer; götürülen bir ürün
 * "Kullanıldı" işaretlenince ek stok hareketi gerekmez (zaten dışarıda),
 * "Geri Döndü" işaretlenince stoğa iade edilir.
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
  const { confirm, dialog } = useConfirmDialog()

  async function handleStatusChange(item: CongressStockItem, newStatus: CongressStockItemStatus) {
    if (newStatus === item.status) return
    // Stok sadece "Geri Döndü" durumuna girip çıkarken hareket ediyor —
    // diğer geçişler (götürüldü/kullanıldı arası) stoğun zaten dışarıda
    // olduğu durumlar, tekrar hareket kaydına gerek yok.
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
    if (!(await confirm(`${item.product_name} (${item.quantity} adet) silinsin mi?`))) return
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

  const takenItems = items.filter((i) => i.status === 'goturuldu' || i.status === 'geri_dondu')
  const usedItems = items.filter((i) => i.status === 'kullanildi')

  const pendingQty = items.filter((i) => i.status === 'goturuldu').reduce((sum, i) => sum + i.quantity, 0)
  const pendingProductCount = new Set(items.filter((i) => i.status === 'goturuldu').map((i) => i.product_name)).size
  const usedQty = usedItems.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="grid gap-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Boxes className="size-4 text-primary" /> Kongreye Götürülen Ürün
            {pendingQty > 0 && (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning-foreground">
                {pendingProductCount} üründe {pendingQty} adet bekliyor
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {takenItems.length > 0 && (
              <ExportMenu<CongressStockItem>
                title="Kongreye Götürülen Ürün"
                filename="kongreye-goturulen-urun"
                rows={takenItems}
                columns={[
                  { header: 'Ürün', value: (i) => i.product_name },
                  { header: 'Adet', value: (i) => i.quantity },
                  { header: 'Durum', value: (i) => (i.status === 'geri_dondu' ? 'Geri Döndü' : 'Bekliyor') },
                  { header: 'Birim Fiyat', value: (i) => i.unit_price ?? '' },
                ]}
              />
            )}
            <AddStockItemDialog
              congressId={congressId}
              congressName={congressName}
              targetStatus="goturuldu"
              triggerLabel="Ürün Ekle"
              dialogTitle="Götürülen Ürün Ekle"
              reasonNote="Kongre/Workshop için götürüldü"
            />
          </div>
        </div>
        <Card>
          <CardContent className="grid gap-1.5 p-4">
            {isLoading && <p className="text-muted-foreground text-sm">Yükleniyor...</p>}
            {!isLoading && takenItems.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Henüz kongreye/workshopa götürülen stoktan ürün kaydı yok.
              </p>
            )}
            {takenItems.map((item) => (
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
                {item.status === 'geri_dondu' ? (
                  <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground shrink-0">
                    Geri Döndü
                  </Badge>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => handleStatusChange(item, 'kullanildi')}
                    >
                      <CheckCircle2 className="size-3.5" /> Kullanıldı İşaretle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => handleStatusChange(item, 'geri_dondu')}
                    >
                      <Undo2 className="size-3.5" /> Geri Döndü
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="Sil">
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" /> Kongrede Kullanılan Ürün
            {usedQty > 0 && (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                {usedItems.length} üründe {usedQty} adet kullanıldı
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {usedItems.length > 0 && (
              <ExportMenu<CongressStockItem>
                title="Kongrede Kullanılan Ürün"
                filename="kongrede-kullanilan-urun"
                rows={usedItems}
                columns={[
                  { header: 'Ürün', value: (i) => i.product_name },
                  { header: 'Adet', value: (i) => i.quantity },
                  { header: 'Birim Fiyat', value: (i) => i.unit_price ?? '' },
                ]}
              />
            )}
            <AddStockItemDialog
              congressId={congressId}
              congressName={congressName}
              targetStatus="kullanildi"
              triggerLabel="Kullanılan Ürün Ekle"
              dialogTitle="Kongrede Kullanılan Ürün Ekle"
              reasonNote="Kongre/Workshop'ta kullanıldı"
            />
          </div>
        </div>
        <Card>
          <CardContent className="grid gap-1.5 p-4">
            {!isLoading && usedItems.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Henüz kongrede/workshopta kullanılan ürün kaydı yok. Yukarıdaki götürülen listesinden
                "Kullanıldı İşaretle" ile taşıyabilir, ya da doğrudan buradan ekleyebilirsiniz.
              </p>
            )}
            {usedItems.map((item) => (
              <div key={item.id} className="border-success/20 bg-success/5 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <CheckCircle2 className="text-success size-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.product_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.quantity} adet
                    {item.unit_price != null ? ` @ ${currency(Number(item.unit_price))}` : ''}
                    {item.note ? ` — ${item.note}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => handleStatusChange(item, 'goturuldu')}
                  title="Yanlışlıkla işaretlendiyse geri al"
                >
                  Beklemeye Al
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="Sil">
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {dialog}
    </div>
  )
}
