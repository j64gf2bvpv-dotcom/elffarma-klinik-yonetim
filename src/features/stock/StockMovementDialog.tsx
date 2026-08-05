import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ArrowLeftRight, Loader2, Pencil, Plus } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { tr } from '@/i18n/tr'
import { ProductCombobox } from './ProductCombobox'
import { useCreateProductLot, useProductLots, useRecordStockMovement, useUpdateStockMovement } from './hooks'
import type { MovementType, Product } from '@/types/database'

const NO_LOT = '__none__'
const NEW_LOT = '__new__'

const MANUAL_MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'return', 'disposal'] as const

const schema = z.object({
  movement_type: z.enum(['in', 'out', 'adjustment', 'return', 'disposal', 'sample']),
  quantity: z.coerce.number().int().positive('Miktar 0’dan büyük olmalı'),
  unit_price: z.coerce.number().min(0).optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
  lot_id: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export interface EditableStockMovement {
  id: string
  movement_type: MovementType
  quantity: number
  unit_price: number | null
  reason: string | null
  note: string | null
  lot_id: string | null
}

/**
 * `product` sabit verilirse (StockPage'deki ürün satırı gibi) doğrudan o
 * ürün için hareket girilir, ürün seçici gösterilmez. Verilmezse (Stok Kartı
 * > Tüm Ürünler raporundaki gibi, tek bir ürüne kilitli olmayan yerlerde)
 * diyalog içinde bir ürün arama kutusu açılır, hareket seçilen ürüne yazılır.
 * `movement` verilirse diyalog DÜZENLEME moduna geçer: alanlar o kayıttan
 * doldurulur, kaydet yeni satır eklemek yerine `update_stock_movement`
 * RPC'siyle var olan satırı günceller (bkz. StockCardPanel'deki İşlemler
 * kolonu — `product` bu modda her zaman birlikte verilir, ürün sabittir).
 */
export function StockMovementDialog({
  product,
  trigger,
  movement,
}: {
  product?: Product
  trigger?: React.ReactNode
  movement?: EditableStockMovement
}) {
  const [open, setOpen] = React.useState(false)
  const [pickedProduct, setPickedProduct] = React.useState<Product | null>(null)
  const [newLot, setNewLot] = React.useState({ lot_no: '', expiry_date: '', warehouse: '', shelf: '' })
  const recordMutation = useRecordStockMovement()
  const updateMutation = useUpdateStockMovement()
  const createLotMutation = useCreateProductLot()
  const activeProduct = product ?? pickedProduct
  const { data: lots = [] } = useProductLots(open && activeProduct ? activeProduct.id : undefined)

  const defaultFormValues: FormInput = movement
    ? {
        movement_type: movement.movement_type,
        quantity: movement.quantity,
        unit_price: movement.unit_price ?? undefined,
        reason: movement.reason ?? '',
        note: movement.note ?? '',
        lot_id: movement.lot_id ?? NO_LOT,
      }
    : {
        movement_type: 'in',
        quantity: 1,
        unit_price: product?.unit_price ?? undefined,
        reason: '',
        note: '',
        lot_id: NO_LOT,
      }

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaultFormValues,
  })

  const selectedLotId = form.watch('lot_id')

  React.useEffect(() => {
    if (activeProduct && !movement) form.setValue('unit_price', activeProduct.unit_price ?? undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProduct?.id])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next && !product) setPickedProduct(null)
  }

  async function onSubmit(values: FormOutput) {
    if (!activeProduct) return
    let lotId: string | null = values.lot_id && values.lot_id !== NO_LOT ? values.lot_id : null
    if (values.lot_id === NEW_LOT) {
      const created = await createLotMutation.mutateAsync({
        product_id: activeProduct.id,
        lot_no: newLot.lot_no || null,
        expiry_date: newLot.expiry_date || null,
        warehouse: newLot.warehouse || null,
        shelf: newLot.shelf || null,
      })
      lotId = created.id
    }
    const payload = {
      product_id: activeProduct.id,
      movement_type: values.movement_type,
      quantity: values.quantity,
      reason: values.reason || null,
      note: values.note || null,
      lot_id: lotId,
      unit_price: values.unit_price ?? null,
    }
    if (movement) {
      await updateMutation.mutateAsync({ id: movement.id, ...payload })
    } else {
      await recordMutation.mutateAsync(payload)
      form.reset({ movement_type: 'in', quantity: 1, unit_price: activeProduct.unit_price ?? undefined, reason: '', note: '', lot_id: NO_LOT })
    }
    setNewLot({ lot_no: '', expiry_date: '', warehouse: '', shelf: '' })
    handleOpenChange(false)
  }

  const submitting = recordMutation.isPending || updateMutation.isPending || createLotMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ??
          (movement ? (
            <Button variant="ghost" size="icon" title="Hareketi düzenle">
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <ArrowLeftRight /> Stok Hareketi
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {movement ? 'Stok Hareketini Düzenle' : 'Stok Hareketi Ekle'}
            {activeProduct ? ` — ${activeProduct.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        {!product && (
          <div className="grid gap-1.5">
            <Label>Ürün</Label>
            <ProductCombobox
              value={pickedProduct?.id}
              onChange={setPickedProduct}
              placeholder="Hareket eklenecek ürünü seçin"
            />
          </div>
        )}
        {activeProduct && (
          <p className="text-sm text-muted-foreground -mt-2">
            Mevcut stok:{' '}
            <span className="font-medium text-foreground">
              {activeProduct.current_quantity} {activeProduct.unit}
            </span>
          </p>
        )}
        {movement && (
          <p className="text-muted-foreground -mt-2 text-xs">
            Bu, sadece stok hareket kaydını günceller/siler. Hareket bir satış ya da numune talebinden geldiyse, o
            kayıttaki tutar/adet buradan otomatik değişmez — gerekiyorsa Satışlar/Numune ekranından ayrıca güncelleyin.
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="movement_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hareket Türü</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(movement?.movement_type === 'sample'
                        ? [...MANUAL_MOVEMENT_TYPES, 'sample' as const]
                        : MANUAL_MOVEMENT_TYPES
                      ).map((value) => (
                        <SelectItem key={value} value={value}>
                          {tr.movementType[value]}
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
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Miktar</FormLabel>
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
                  <FormLabel>Birim Fiyat (opsiyonel)</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lot_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lot (opsiyonel)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_LOT}>Lot takibi yok</SelectItem>
                      {lots.map((lot) => (
                        <SelectItem key={`lot-${lot.id}`} value={lot.id}>
                          {lot.lot_no ?? 'Lot'} {lot.expiry_date ? `— SKT: ${format(new Date(lot.expiry_date), 'd MMM yyyy', { locale: trLocale })}` : ''} ({lot.quantity} adet)
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_LOT}>
                        <span className="flex items-center gap-1"><Plus className="size-3" /> Yeni Lot</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedLotId === NEW_LOT && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Lot No</Label>
                  <Input
                    value={newLot.lot_no}
                    onChange={(e) => setNewLot((v) => ({ ...v, lot_no: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">SKT</Label>
                  <Input
                    type="date"
                    value={newLot.expiry_date}
                    onChange={(e) => setNewLot((v) => ({ ...v, expiry_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Depo</Label>
                  <Input
                    value={newLot.warehouse}
                    onChange={(e) => setNewLot((v) => ({ ...v, warehouse: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Raf</Label>
                  <Input value={newLot.shelf} onChange={(e) => setNewLot((v) => ({ ...v, shelf: e.target.value }))} />
                </div>
              </div>
            )}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sebep (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Satın alma, kullanım, sayım düzeltmesi..." {...field} />
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
                {movement ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
