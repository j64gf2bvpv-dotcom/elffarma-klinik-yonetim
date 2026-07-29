import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ArrowLeftRight, Loader2, Plus } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { tr } from '@/i18n/tr'
import { useCreateProductLot, useProductLots, useRecordStockMovement } from './hooks'
import type { Product } from '@/types/database'

const NO_LOT = '__none__'
const NEW_LOT = '__new__'

const schema = z.object({
  movement_type: z.enum(['in', 'out', 'adjustment', 'return', 'disposal']),
  quantity: z.coerce.number().int().positive('Miktar 0’dan büyük olmalı'),
  reason: z.string().optional(),
  note: z.string().optional(),
  lot_id: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function StockMovementDialog({ product }: { product: Product }) {
  const [open, setOpen] = React.useState(false)
  const [newLot, setNewLot] = React.useState({ lot_no: '', expiry_date: '', warehouse: '', shelf: '' })
  const mutation = useRecordStockMovement()
  const createLotMutation = useCreateProductLot()
  const { data: lots = [] } = useProductLots(open ? product.id : undefined)

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { movement_type: 'in', quantity: 1, reason: '', note: '', lot_id: NO_LOT },
  })

  const selectedLotId = form.watch('lot_id')

  async function onSubmit(values: FormOutput) {
    let lotId: string | null = values.lot_id && values.lot_id !== NO_LOT ? values.lot_id : null
    if (values.lot_id === NEW_LOT) {
      const created = await createLotMutation.mutateAsync({
        product_id: product.id,
        lot_no: newLot.lot_no || null,
        expiry_date: newLot.expiry_date || null,
        warehouse: newLot.warehouse || null,
        shelf: newLot.shelf || null,
      })
      lotId = created.id
    }
    await mutation.mutateAsync({
      product_id: product.id,
      movement_type: values.movement_type,
      quantity: values.quantity,
      reason: values.reason || null,
      note: values.note || null,
      lot_id: lotId,
    })
    form.reset({ movement_type: 'in', quantity: 1, reason: '', note: '', lot_id: NO_LOT })
    setNewLot({ lot_no: '', expiry_date: '', warehouse: '', shelf: '' })
    setOpen(false)
  }

  const submitting = mutation.isPending || createLotMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowLeftRight /> Stok Hareketi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stok Hareketi Ekle — {product.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Mevcut stok: <span className="font-medium text-foreground">{product.current_quantity} {product.unit}</span>
        </p>
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
                      {(['in', 'out', 'adjustment', 'return', 'disposal'] as const).map((value) => (
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
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
