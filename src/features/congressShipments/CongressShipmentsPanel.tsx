import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { toast } from 'sonner'
import { Plus, Trash2, Boxes, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import {
  useCongressShipments,
  useCreateCongressShipment,
  useDeleteCongressShipment,
  useUpdateCongressShipment,
  useUpdateCongressShipmentReturns,
} from './hooks'
import type { CongressShipmentWithCongress } from './api'
import type { Product } from '@/types/database'

/** Kongre/workshopa götürülen toplam ürün miktarını ekleyen diyalog — kaydedilince gerçek stoktan (out) düşülür. */
function AddShipmentDialog() {
  const [open, setOpen] = React.useState(false)
  const [congressId, setCongressId] = React.useState('')
  const [product, setProduct] = React.useState<Product | null>(null)
  const [quantity, setQuantity] = React.useState('1')
  const [sealedQty, setSealedQty] = React.useState('0')
  const [openQty, setOpenQty] = React.useState('0')
  const [note, setNote] = React.useState('')

  const { data: congresses = [] } = useCongresses()
  const createMutation = useCreateCongressShipment()
  const recordMovement = useRecordStockMovement()

  const sortedCongresses = React.useMemo(
    () => [...congresses].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '')),
    [congresses],
  )

  const takenNum = Number(quantity) || 0
  const sealedNum = Number(sealedQty) || 0
  const openNum = Number(openQty) || 0
  const usedPreview = Math.max(0, takenNum - sealedNum - openNum)

  function reset() {
    setCongressId('')
    setProduct(null)
    setQuantity('1')
    setSealedQty('0')
    setOpenQty('0')
    setNote('')
  }

  async function handleSubmit() {
    const qty = Number(quantity)
    if (!congressId || !product || !Number.isFinite(qty) || qty <= 0) {
      toast.error('Kongre, ürün ve geçerli bir miktar seçin')
      return
    }
    if (!Number.isFinite(sealedNum) || !Number.isFinite(openNum) || sealedNum < 0 || openNum < 0) {
      toast.error('Kapalı/açık dönen için geçerli bir miktar girin')
      return
    }
    if (sealedNum + openNum > qty) {
      toast.error('Kapalı + açık dönen, götürülen miktarı geçemez')
      return
    }
    const congressName = congresses.find((c) => c.id === congressId)?.name ?? 'Kongre/Workshop'
    await createMutation.mutateAsync({
      congress_id: congressId,
      product_id: product.id,
      product_name: product.name,
      quantity_taken: qty,
      quantity_returned_sealed: sealedNum,
      quantity_returned_open: openNum,
      note: note.trim() || null,
    })
    // Tüm götürülen miktar önce stoktan çıkar, sonra o an için zaten dönmüş
    // (kapalı+açık) kısım geri iade edilir — net etki (kullanılan) kadar
    // stoğun dışarıda kalması, tek tek girildikten sonraki hâliyle aynı.
    await recordMovement.mutateAsync({
      product_id: product.id,
      movement_type: 'out',
      quantity: qty,
      reason: 'Kongre/Workshop sevkiyatı',
      note: congressName,
    })
    if (sealedNum + openNum > 0) {
      await recordMovement.mutateAsync({
        product_id: product.id,
        movement_type: 'return',
        quantity: sealedNum + openNum,
        reason: 'Kongre/Workshop — sevkiyatla birlikte girilen dönüş',
        note: congressName,
      })
    }
    reset()
    setOpen(false)
  }

  const submitting = createMutation.isPending || recordMovement.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : (reset(), setOpen(false)))}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-3.5" /> Sevkiyat Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kongreye/Workshopa Ürün Sevkiyatı</DialogTitle>
          <DialogDescription>Götürülen miktar kaydedilince gerçek stoktan düşülür.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Kongre / Workshop</Label>
            <Select value={congressId} onValueChange={setCongressId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kongre/workshop seçin" />
              </SelectTrigger>
              <SelectContent>
                {sortedCongresses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.start_date ? ` — ${format(new Date(c.start_date), 'd MMM yyyy', { locale: trLocale })}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Ürün (Stoktan Seç)</Label>
            <ProductCombobox value={product?.id} onChange={setProduct} />
          </div>
          <div className="grid gap-1.5">
            <Label>Götürülen Miktar</Label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Kapalı Dönen (opsiyonel)</Label>
              <Input type="number" min="0" value={sealedQty} onChange={(e) => setSealedQty(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Açık Dönen (opsiyonel)</Label>
              <Input type="number" min="0" value={openQty} onChange={(e) => setOpenQty(e.target.value)} />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">Kullanılan (otomatik hesaplanır): {usedPreview}</p>
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. stand vitrini için" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Yanlış girilen kongre/ürün/miktarı düzeltmek için (kullanıcı isteğiyle,
 * 2026-08-22) — AddShipmentDialog ile aynı form, farkla açılıyor ve kaydedince
 * stok farkını (eski ürün/miktar → yeni ürün/miktar) düzeltiyor. İade zaten
 * girildiyse (quantity_returned_sealed/open > 0) ürün değiştirme engelleniyor
 * — o iadeler hangi ürüne ait olduğunu artık belirsizleştirir, bu durumda
 * önce kaydı silip yeniden girmek gerekir.
 */
function EditShipmentDialog({ shipment, onClose }: { shipment: CongressShipmentWithCongress; onClose: () => void }) {
  const [congressId, setCongressId] = React.useState(shipment.congress_id)
  const [productId, setProductId] = React.useState(shipment.product_id)
  const [productName, setProductName] = React.useState(shipment.product_name)
  const [quantity, setQuantity] = React.useState(String(shipment.quantity_taken))
  const [note, setNote] = React.useState(shipment.note ?? '')

  const { data: congresses = [] } = useCongresses()
  const updateMutation = useUpdateCongressShipment()
  const recordMovement = useRecordStockMovement()

  const hasReturns = shipment.quantity_returned_sealed > 0 || shipment.quantity_returned_open > 0

  const sortedCongresses = React.useMemo(
    () => [...congresses].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '')),
    [congresses],
  )

  async function handleSubmit() {
    const qty = Number(quantity)
    if (!congressId || !productId || !Number.isFinite(qty) || qty <= 0) {
      toast.error('Kongre, ürün ve geçerli bir miktar seçin')
      return
    }
    const productChanged = productId !== shipment.product_id
    if (productChanged && hasReturns) {
      toast.error('Bu sevkiyatta iade girildiği için ürün değiştirilemez', {
        description: 'Önce kaydı silip yeniden girin.',
      })
      return
    }
    const congressName = congresses.find((c) => c.id === congressId)?.name ?? 'Kongre/Workshop'

    if (productChanged) {
      await recordMovement.mutateAsync({
        product_id: shipment.product_id,
        movement_type: 'return',
        quantity: shipment.quantity_taken,
        reason: 'Kongre/Workshop sevkiyatı düzenlendi — eski ürün iptal edildi',
        note: congressName,
      })
      await recordMovement.mutateAsync({
        product_id: productId,
        movement_type: 'out',
        quantity: qty,
        reason: 'Kongre/Workshop sevkiyatı düzenlendi — yeni ürün',
        note: congressName,
      })
    } else if (qty !== shipment.quantity_taken) {
      const delta = qty - shipment.quantity_taken
      await recordMovement.mutateAsync({
        product_id: productId,
        movement_type: delta > 0 ? 'out' : 'return',
        quantity: Math.abs(delta),
        reason: 'Kongre/Workshop sevkiyatı düzenlendi — miktar farkı',
        note: congressName,
      })
    }

    await updateMutation.mutateAsync({
      id: shipment.id,
      input: {
        congress_id: congressId,
        product_id: productId,
        product_name: productName,
        quantity_taken: qty,
        note: note.trim() || null,
      },
    })
    onClose()
  }

  const submitting = updateMutation.isPending || recordMovement.isPending

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sevkiyatı Düzenle</DialogTitle>
          <DialogDescription>
            {hasReturns
              ? 'Bu sevkiyatta iade zaten girildiği için ürün değiştirilemez — kongre, miktar ve not düzenlenebilir.'
              : 'Yanlış girilen kongre, ürün veya miktarı düzeltin.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Kongre / Workshop</Label>
            <Select value={congressId} onValueChange={setCongressId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kongre/workshop seçin" />
              </SelectTrigger>
              <SelectContent>
                {sortedCongresses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.start_date ? ` — ${format(new Date(c.start_date), 'd MMM yyyy', { locale: trLocale })}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Ürün (Stoktan Seç)</Label>
            <ProductCombobox
              value={productId}
              onChange={(p: Product) => {
                setProductId(p.id)
                setProductName(p.name)
              }}
            />
            {hasReturns && (
              <p className="text-muted-foreground text-xs">İade girildiği için ürün değişikliği kaydedilmeyecek.</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Götürülen Miktar</Label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. stand vitrini için" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Götürülen miktar için tıkla-düzenle hücre — önceki değere göre DELTA kadar stok hareketi (out/return) tetikler. */
function TakenQtyCell({ shipment }: { shipment: CongressShipmentWithCongress }) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(String(shipment.quantity_taken))
  const updateMutation = useUpdateCongressShipment()
  const recordMovement = useRecordStockMovement()

  React.useEffect(() => {
    if (!editing) setText(String(shipment.quantity_taken))
  }, [shipment.quantity_taken, editing])

  async function commit() {
    setEditing(false)
    const next = Number(text)
    const previous = shipment.quantity_taken
    if (!Number.isFinite(next) || next <= 0 || Math.round(next) !== next) {
      setText(String(previous))
      return
    }
    if (next === previous) return
    const returned = shipment.quantity_returned_sealed + shipment.quantity_returned_open
    if (next < returned) {
      toast.error('Götürülen miktar, kapalı + açık dönen toplamından az olamaz')
      setText(String(previous))
      return
    }
    const delta = next - previous
    const congressName = shipment.congresses?.name ?? 'Kongre/Workshop'
    await recordMovement.mutateAsync({
      product_id: shipment.product_id,
      movement_type: delta > 0 ? 'out' : 'return',
      quantity: Math.abs(delta),
      reason: 'Kongre/Workshop — götürülen miktar düzeltmesi',
      note: congressName,
    })
    await updateMutation.mutateAsync({
      id: shipment.id,
      input: {
        congress_id: shipment.congress_id,
        product_id: shipment.product_id,
        product_name: shipment.product_name,
        quantity_taken: next,
        note: shipment.note,
      },
    })
  }

  if (editing) {
    return (
      <Input
        type="number"
        min="1"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setText(String(shipment.quantity_taken))
            setEditing(false)
          }
        }}
        className="h-8 w-20"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="-mx-1 rounded px-1 py-0.5 text-left tabular-nums hover:bg-accent"
      title="Düzenlemek için tıklayın"
    >
      {shipment.quantity_taken}
    </button>
  )
}

/** Kapalı/açık dönen miktar için tıkla-düzenle hücre — komite değeri önceki değere göre DELTA kadar stok hareketi (return/out) tetikler. */
function ReturnQtyCell({
  shipment,
  field,
  otherValue,
}: {
  shipment: CongressShipmentWithCongress
  field: 'quantity_returned_sealed' | 'quantity_returned_open'
  otherValue: number
}) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(String(shipment[field]))
  const updateMutation = useUpdateCongressShipmentReturns()
  const recordMovement = useRecordStockMovement()

  React.useEffect(() => {
    if (!editing) setText(String(shipment[field]))
  }, [shipment, field, editing])

  async function commit() {
    setEditing(false)
    const next = Number(text)
    const previous = shipment[field]
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setText(String(previous))
      return
    }
    if (next === previous) return
    if (next + otherValue > shipment.quantity_taken) {
      toast.error('Kapalı + açık dönen, götürülen miktarı geçemez')
      setText(String(previous))
      return
    }
    const delta = next - previous
    const congressName = shipment.congresses?.name ?? 'Kongre/Workshop'
    await recordMovement.mutateAsync({
      product_id: shipment.product_id,
      movement_type: delta > 0 ? 'return' : 'out',
      quantity: Math.abs(delta),
      reason:
        delta > 0
          ? 'Kongre/Workshop — stoğa iade edildi'
          : 'Kongre/Workshop — iade düzeltmesi (fazla girilen dönüş geri alındı)',
      note: congressName,
    })
    await updateMutation.mutateAsync({
      id: shipment.id,
      returns: {
        quantity_returned_sealed: field === 'quantity_returned_sealed' ? next : shipment.quantity_returned_sealed,
        quantity_returned_open: field === 'quantity_returned_open' ? next : shipment.quantity_returned_open,
      },
    })
  }

  if (editing) {
    return (
      <Input
        type="number"
        min="0"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setText(String(shipment[field]))
            setEditing(false)
          }
        }}
        className="h-8 w-20"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="-mx-1 rounded px-1 py-0.5 text-left hover:bg-accent"
      title="Düzenlemek için tıklayın"
    >
      {shipment[field] > 0 ? shipment[field] : <span className="text-muted-foreground">—</span>}
    </button>
  )
}

/**
 * Kullanılan miktar için tıkla-düzenle hücre — depolanmıyor, taken - sealed - open
 * olarak hesaplanır; düzenlenince açık dönen miktar buna göre yeniden hesaplanıp
 * DELTA kadar stok hareketi (out/return) tetiklenir.
 */
function UsedQtyCell({ shipment }: { shipment: CongressShipmentWithCongress }) {
  const used = shipment.quantity_taken - shipment.quantity_returned_sealed - shipment.quantity_returned_open
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(String(used))
  const updateMutation = useUpdateCongressShipmentReturns()
  const recordMovement = useRecordStockMovement()

  React.useEffect(() => {
    if (!editing) setText(String(used))
  }, [used, editing])

  async function commit() {
    setEditing(false)
    const next = Number(text)
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setText(String(used))
      return
    }
    if (next === used) return
    const maxUsed = shipment.quantity_taken - shipment.quantity_returned_sealed
    if (next > maxUsed) {
      toast.error('Kullanılan, götürülen - kapalı dönen miktarını geçemez')
      setText(String(used))
      return
    }
    const newOpen = maxUsed - next
    const delta = next - used
    const congressName = shipment.congresses?.name ?? 'Kongre/Workshop'
    await recordMovement.mutateAsync({
      product_id: shipment.product_id,
      movement_type: delta > 0 ? 'out' : 'return',
      quantity: Math.abs(delta),
      reason:
        delta > 0
          ? 'Kongre/Workshop — kullanılan miktar arttırıldı'
          : 'Kongre/Workshop — kullanılan miktar azaltıldı (stoğa iade)',
      note: congressName,
    })
    await updateMutation.mutateAsync({
      id: shipment.id,
      returns: { quantity_returned_sealed: shipment.quantity_returned_sealed, quantity_returned_open: newOpen },
    })
  }

  if (editing) {
    return (
      <Input
        type="number"
        min="0"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setText(String(used))
            setEditing(false)
          }
        }}
        className="h-8 w-20"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="-mx-1 rounded px-1 py-0.5 text-left font-medium tabular-nums hover:bg-accent"
      title="Düzenlemek için tıklayın"
    >
      {used > 0 ? used : <span className="text-muted-foreground font-normal">—</span>}
    </button>
  )
}

/**
 * Stok sekmesinde (Kargo'dan önce) kongre/workshopa götürülen ürünleri kongre
 * bazında toplu takip eder — congress_stock_items'tan (Kongreler modülü, satır
 * başına tek durum) bilerek ayrı: burada aynı satırda parçalı geri dönüş
 * (kapalı + açık, ikisi de aynı anda) tutuluyor. "Kullanılan" ayrıca
 * saklanmıyor, götürülen - kapalı dönen - açık dönen olarak hesaplanıyor.
 */
export function CongressShipmentsPanel() {
  const { data: shipments = [], isLoading } = useCongressShipments()
  const deleteMutation = useDeleteCongressShipment()
  const recordMovement = useRecordStockMovement()
  // Native confirm() yerine (kullanıcı isteğiyle, 2026-08-22 — tarayıcının
  // stilsiz onay penceresi rahatsız ediciydi) uygulamanın kendi Dialog'uyla
  // "İptal Et" / "Sil" onayı.
  const [pendingDelete, setPendingDelete] = React.useState<CongressShipmentWithCongress | null>(null)
  const [editingShipment, setEditingShipment] = React.useState<CongressShipmentWithCongress | null>(null)

  async function confirmDelete() {
    const shipment = pendingDelete
    if (!shipment) return
    setPendingDelete(null)
    const remaining =
      shipment.quantity_taken - shipment.quantity_returned_sealed - shipment.quantity_returned_open
    // Henüz dönmemiş (kullanılan sayılan) kısım hâlâ stoktan dışarıda görünüyor —
    // kaydı silmeden önce bu kısmı stoğa iade et, aksi halde kayıt silinir ama
    // ürün bir daha stokta görünmez (kalıcı kaybolur).
    if (remaining > 0) {
      await recordMovement.mutateAsync({
        product_id: shipment.product_id,
        movement_type: 'return',
        quantity: remaining,
        reason: 'Kongre/Workshop sevkiyat kaydı silindi — stoğa iade',
        note: shipment.congresses?.name ?? 'Kongre/Workshop',
      })
    }
    deleteMutation.mutate(shipment.id)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Boxes className="size-4 text-primary" /> Kongre / Workshop Ürün Sevkiyatı
        </h3>
        <AddShipmentDialog />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kongre / Workshop</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Götürülen</TableHead>
                <TableHead>Kapalı Dönen</TableHead>
                <TableHead>Açık Dönen</TableHead>
                <TableHead>Kullanılan</TableHead>
                <TableHead>Not</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && shipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                    Henüz kongre/workshop sevkiyatı yok
                  </TableCell>
                </TableRow>
              )}
              {shipments.map((s) => {
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.congresses?.name ?? '—'}</TableCell>
                    <TableCell>{s.product_name}</TableCell>
                    <TableCell>
                      <TakenQtyCell shipment={s} />
                    </TableCell>
                    <TableCell>
                      <ReturnQtyCell shipment={s} field="quantity_returned_sealed" otherValue={s.quantity_returned_open} />
                    </TableCell>
                    <TableCell>
                      <ReturnQtyCell shipment={s} field="quantity_returned_open" otherValue={s.quantity_returned_sealed} />
                    </TableCell>
                    <TableCell>
                      <UsedQtyCell shipment={s} />
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate" title={s.note ?? undefined}>
                      {s.note ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setEditingShipment(s)} title="Düzenle">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete(s)} title="Sil">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sevkiyat Kaydı Silinsin mi?</DialogTitle>
            <DialogDescription>
              {pendingDelete && `${pendingDelete.product_name} (${pendingDelete.quantity_taken} adet) sevkiyat kaydı silinecek.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              İptal Et
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingShipment && <EditShipmentDialog shipment={editingShipment} onClose={() => setEditingShipment(null)} />}
    </div>
  )
}
