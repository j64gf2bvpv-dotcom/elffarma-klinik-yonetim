import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Loader2, X, ChevronsUpDown, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/utils'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { useProducts } from '@/features/stock/hooks'
import { recordStockMovement } from '@/features/stock/api'
import { useSalesReps } from '@/features/salesReps/hooks'
import { createParticipantProduct, type ParticipantWithProducts } from './api'
import type { Product } from '@/types/database'

const NO_REP = '__none__'

interface Row {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
}

function ProductChecklistPopover({
  selectedIds,
  onToggle,
}: {
  selectedIds: Set<string>
  onToggle: (product: Product, wasSelected: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const { data: products = [] } = useProducts(search)

  const label = selectedIds.size === 0 ? 'Ürün seçin (birden fazla seçebilirsiniz)' : `${selectedIds.size} ürün seçili`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="flex items-center gap-2 truncate">
            <Package className="size-4 text-muted-foreground" />
            {label}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ürün ara..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Ürün bulunamadı</CommandEmpty>
            <CommandGroup>
              {products.map((product) => {
                const selected = selectedIds.has(product.id)
                return (
                  <CommandItem key={product.id} value={product.id} onSelect={() => onToggle(product, selected)}>
                    <Checkbox checked={selected} onCheckedChange={() => onToggle(product, selected)} />
                    <div className="flex-1">
                      <p>{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stok: {product.current_quantity} Paket
                      </p>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ParticipantProductDialog({
  participantId,
  congressId,
  congressName,
  doctorName,
}: {
  participantId: string
  congressId: string
  congressName?: string
  doctorName?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<Row[]>([])
  const [salesRepId, setSalesRepId] = React.useState(NO_REP)
  const [submitting, setSubmitting] = React.useState(false)
  const { data: salesReps = [] } = useSalesReps()
  const queryClient = useQueryClient()

  const selectedIds = React.useMemo(() => new Set(rows.map((r) => r.product_id)), [rows])

  function addProduct(product: Product) {
    setRows((prev) => [
      ...prev,
      { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.unit_price ?? 0 },
    ])
  }

  function removeProduct(productId: string) {
    setRows((prev) => prev.filter((r) => r.product_id !== productId))
  }

  function updateRow(productId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.product_id === productId ? { ...r, ...patch } : r)))
  }

  function resetForm() {
    setRows([])
    setSalesRepId(NO_REP)
  }

  async function handleSubmit() {
    if (rows.length === 0) return
    setSubmitting(true)
    try {
      const repId = salesRepId !== NO_REP ? salesRepId : null
      // Sıralı gönderiliyor (Promise.all değil) — offline kuyruk mutasyonları
      // sıraya bağımlı işlendiği için (bkz. useOfflineSync), art arda aynı
      // ürüne ait hareketlerin sırası bozulmasın diye.
      for (const row of rows) {
        const created = await createParticipantProduct({
          participant_id: participantId,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          sales_rep_id: repId,
        })
        await recordStockMovement({
          product_id: row.product_id,
          movement_type: 'out',
          quantity: row.quantity,
          reason: 'Kongre satışı',
          note: `${congressName ?? 'Kongre'}${doctorName ? ' - Doktor: ' + doctorName : ''}`,
        })
        queryClient.setQueryData<ParticipantWithProducts[]>(['congress_participants', congressId], (old) =>
          old?.map((p) =>
            p.id === participantId
              ? {
                  ...p,
                  congress_participant_products: [
                    ...p.congress_participant_products,
                    { ...created, sales_reps: null },
                  ],
                }
              : p,
          ),
        )
      }
      queryClient.invalidateQueries({ queryKey: ['congress_participants', congressId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      toast.success(rows.length === 1 ? 'Ürün eklendi' : `${rows.length} ürün eklendi`)
      resetForm()
      setOpen(false)
    } catch (error) {
      toast.error('Eklenemedi', { description: getErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> Ürün Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ürün Ekle</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Ürün (Stoktan Seç)</Label>
            <ProductChecklistPopover
              selectedIds={selectedIds}
              onToggle={(product, wasSelected) => (wasSelected ? removeProduct(product.id) : addProduct(product))}
            />
          </div>

          {rows.length > 0 && (
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_5rem_8rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>Ürün</span>
                <span>Adet</span>
                <span>Birim Fiyat</span>
                <span />
              </div>
              {rows.map((row) => (
                <div
                  key={row.product_id}
                  className="grid grid-cols-[1fr_5rem_8rem_2rem] items-center gap-2 rounded-md border p-2"
                >
                  <p className="truncate text-sm font-medium">{row.product_name}</p>
                  <Input
                    type="number"
                    min="1"
                    className="h-9"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.product_id, { quantity: Number(e.target.value) })}
                  />
                  <CurrencyInput
                    value={row.unit_price}
                    onChange={(v) => updateRow(row.product_id, { unit_price: v ?? 0 })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() => removeProduct(row.product_id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Satışı Yapan Temsilci (opsiyonel)</Label>
            <Select value={salesRepId} onValueChange={setSalesRepId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
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
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" disabled={rows.length === 0 || submitting} onClick={handleSubmit}>
            {submitting && <Loader2 className="animate-spin" />}
            Kaydet{rows.length > 1 ? ` (${rows.length} ürün)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
