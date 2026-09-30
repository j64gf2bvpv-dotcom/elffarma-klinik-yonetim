import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { toast } from 'sonner'
import { Plus, Trash2, Boxes, Pencil, ClipboardList } from 'lucide-react'

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
import { useProducts, useRecordStockMovement } from '@/features/stock/hooks'
import { ZoomableThumbnail } from '@/components/ZoomableThumbnail'
import { CongressMaterialsSection, type MaterialGroup } from './CongressMaterialsSection'
import { useCongresses, useCreateCongress } from '@/features/congresses/hooks'
import {
  useCongressShipments,
  useCreateCongressShipment,
  useDeleteCongressShipment,
  useUpdateCongressShipment,
  useUpdateCongressShipmentReturns,
} from './hooks'
import type { CongressShipmentWithCongress } from './api'
import type { Product } from '@/types/database'
import { cn } from '@/lib/utils'

/**
 * Sevkiyat penceresinden çıkmadan yeni kongre / workshop / masterclass /
 * eğitim tanımlamak için (kullanıcı isteği, 2026-09-29: "stok kongre
 * workshop kısmına yeni masterclass workshop ya da eğitim ekleyebilmeliyim").
 * Kongreler modülündeki congresses tablosuna yazar — ayrıntılar (fiyat,
 * otel, konuşmacılar vb.) sonradan Kongreler sayfasından doldurulabilir.
 * Oluşturulan kayıt onCreated ile çağırana döner ki listede hemen seçilsin.
 */
function QuickCongressDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [city, setCity] = React.useState('')
  const createMutation = useCreateCongress()

  function reset() {
    setName('')
    setStartDate('')
    setEndDate('')
    setCity('')
  }

  async function handleSubmit() {
    if (name.trim().length < 2) {
      toast.error('Kongre / masterclass / eğitim adını girin')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error('Bitiş tarihi başlangıçtan önce olamaz')
      return
    }
    const created = await createMutation.mutateAsync({
      name: name.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      city: city.trim() || null,
    })
    onCreated(created.id)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : (reset(), setOpen(false)))}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7">
          <Plus className="size-3.5" /> Yeni Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Kongre / Workshop / Masterclass / Eğitim</DialogTitle>
          <DialogDescription>
            Kaydedilince listeye eklenir ve seçilir. Diğer ayrıntılar Kongreler sayfasından doldurulabilir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Adı</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Adana Injection Masterclass"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Başlangıç Tarihi</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Bitiş Tarihi (opsiyonel)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Şehir (opsiyonel)</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Örn. Adana" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={createMutation.isPending}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ShipmentRow {
  key: number
  product: Product | null
  quantity: string
  sealedQty: string
  openQty: string
}

function emptyRow(key: number): ShipmentRow {
  return { key, product: null, quantity: '1', sealedQty: '0', openQty: '0' }
}

/**
 * Alt alta çok ürünlü sevkiyat satırlarının ortak durumu + kaydetme mantığı —
 * hem Sevkiyat Ekle hem de kalem (Düzenle) penceresi kullanıyor (kullanıcı
 * isteği, 2026-09-29: "kalem işaretine tıkladığımda başka ürünler de
 * ekleyebilmeliyim, birden fazla"). minRows=1 → en az bir satır kalır
 * (Sevkiyat Ekle); minRows=0 → hiç satır olmayabilir (Düzenle).
 */
function useShipmentRows(minRows: 0 | 1) {
  const nextKey = React.useRef(1)
  const initial = React.useCallback(
    () => (minRows === 1 ? [emptyRow(0)] : []),
    [minRows],
  )
  const [rows, setRows] = React.useState<ShipmentRow[]>(initial)
  const createMutation = useCreateCongressShipment()
  const recordMovement = useRecordStockMovement()

  function reset() {
    setRows(minRows === 1 ? [emptyRow(nextKey.current++)] : [])
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow(nextKey.current++)])
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length > minRows ? prev.filter((r) => r.key !== key) : prev))
  }
  function updateRow(key: number, patch: Partial<ShipmentRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  /** Hata varsa toast gösterip false döner. */
  function validate(): boolean {
    for (const [i, r] of rows.entries()) {
      const qty = Number(r.quantity)
      const sealed = Number(r.sealedQty) || 0
      const opened = Number(r.openQty) || 0
      const label = rows.length > 1 ? `${i + 1}. ürün satırı: ` : ''
      if (!r.product || !Number.isFinite(qty) || qty <= 0) {
        toast.error(`${label}Ürün ve geçerli bir miktar seçin`)
        return false
      }
      if (sealed < 0 || opened < 0) {
        toast.error(`${label}Kapalı/açık dönen için geçerli bir miktar girin`)
        return false
      }
      if (sealed + opened > qty) {
        toast.error(`${label}Kapalı + açık dönen, götürülen miktarı geçemez`)
        return false
      }
    }
    // Stok yetmeyen ürün varsa HİÇBİR satır kaydedilmeden, hangi ürün olduğu
    // açıkça söylenir (düzeltme, 2026-09-30) — eskiden stoğu olan satırlar
    // kaydedilip listeden çıkıyor, stoğu 0 olanlar sessizce eklenmiyor,
    // kullanıcıya "eklemiyor, siliyor" gibi görünüyordu. Aynı ürün birden
    // fazla satırdaysa toplam miktara bakılır.
    const wanted = new Map<string, { name: string; qty: number; stock: number }>()
    for (const r of rows) {
      const product = r.product as Product
      const entry = wanted.get(product.id) ?? { name: product.name, qty: 0, stock: product.current_quantity }
      entry.qty += Number(r.quantity)
      wanted.set(product.id, entry)
    }
    const short = Array.from(wanted.values()).filter((w) => w.qty > w.stock)
    if (short.length > 0) {
      toast.error('Stok yetersiz — hiçbir ürün kaydedilmedi', {
        description:
          short.map((w) => `${w.name}: stokta ${w.stock} paket, istenen ${w.qty}`).join(' · ') +
          '. Önce bu ürünlerin stoğunu (Günlük Sayım veya Stok Kartı > Giriş) düzeltin.',
        duration: 12000,
      })
      return false
    }
    return true
  }

  /**
   * Her satırı ayrı sevkiyat kaydı olarak ekler ve stoktan düşer. Kaydedilen
   * satır listeden çıkarılıyor ki arada biri hata verirse tekrar Kaydet'e
   * basınca öncekiler iki kez girilmesin.
   */
  async function saveAll(congressId: string, congressName: string, note: string | null) {
    for (const r of rows) {
      const product = r.product as Product
      const qty = Number(r.quantity)
      const sealed = Number(r.sealedQty) || 0
      const opened = Number(r.openQty) || 0
      // ÖNCE stoktan düş, SONRA sevkiyat kaydını ekle (düzeltme, 2026-09-29):
      // stok yetmezse hareket reddediliyor ve stoktan düşülmemiş bir sevkiyat
      // kaydı listede kalmıyor. Tüm götürülen miktar önce stoktan çıkar, sonra
      // o an için zaten dönmüş (kapalı+açık) kısım geri iade edilir — net
      // etki (kullanılan) kadar stoğun dışarıda kalması.
      await recordMovement.mutateAsync({
        product_id: product.id,
        movement_type: 'out',
        quantity: qty,
        reason: 'Kongre/Workshop sevkiyatı',
        note: congressName,
      })
      if (sealed + opened > 0) {
        await recordMovement.mutateAsync({
          product_id: product.id,
          movement_type: 'return',
          quantity: sealed + opened,
          reason: 'Kongre/Workshop — sevkiyatla birlikte girilen dönüş',
          note: congressName,
        })
      }
      try {
        await createMutation.mutateAsync({
          congress_id: congressId,
          product_id: product.id,
          product_name: product.name,
          quantity_taken: qty,
          quantity_returned_sealed: sealed,
          quantity_returned_open: opened,
          note,
        })
      } catch (error) {
        const net = qty - sealed - opened
        if (net > 0) {
          await recordMovement
            .mutateAsync({
              product_id: product.id,
              movement_type: 'return',
              quantity: net,
              reason: 'Kongre/Workshop sevkiyatı kaydedilemedi — stok geri alındı',
              note: congressName,
            })
            .catch(() => {})
        }
        throw error
      }
      setRows((prev) => prev.filter((x) => x.key !== r.key))
    }
  }

  return {
    rows,
    reset,
    addRow,
    removeRow,
    updateRow,
    validate,
    saveAll,
    minRows,
    submitting: createMutation.isPending || recordMovement.isPending,
  }
}

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_4rem_2.25rem] items-start gap-2'

function ShipmentRowsEditor({
  state,
  addLabel,
}: {
  state: ReturnType<typeof useShipmentRows>
  addLabel: string
}) {
  const { rows, updateRow, removeRow, addRow, minRows } = state
  return (
    <div className="grid gap-2">
      {rows.length > 0 && (
        <div className={cn(ROW_GRID, 'text-muted-foreground items-end text-xs font-medium')}>
          <span>Ürün (Stoktan Seç)</span>
          <span>Götürülen</span>
          <span>Kapalı Dönen</span>
          <span>Açık Dönen</span>
          <span>Kullanılan</span>
          <span />
        </div>
      )}
      {rows.map((r) => {
        const used = Math.max(0, (Number(r.quantity) || 0) - (Number(r.sealedQty) || 0) - (Number(r.openQty) || 0))
        return (
          <div key={r.key} className={ROW_GRID}>
            <div className="grid min-w-0 gap-0.5">
              <ProductCombobox value={r.product?.id} onChange={(p: Product) => updateRow(r.key, { product: p })} />
              {r.product && (
                <span
                  className={cn(
                    'px-1 text-xs',
                    (Number(r.quantity) || 0) > r.product.current_quantity
                      ? 'font-medium text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  Stokta: {r.product.current_quantity} paket
                  {(Number(r.quantity) || 0) > r.product.current_quantity && ' — yetersiz'}
                </span>
              )}
            </div>
            <Input type="number" min="1" value={r.quantity} onChange={(e) => updateRow(r.key, { quantity: e.target.value })} />
            <Input type="number" min="0" value={r.sealedQty} onChange={(e) => updateRow(r.key, { sealedQty: e.target.value })} />
            <Input type="number" min="0" value={r.openQty} onChange={(e) => updateRow(r.key, { openQty: e.target.value })} />
            <span className="py-2 text-center text-sm tabular-nums">{used}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(r.key)}
              disabled={rows.length <= minRows}
              title="Satırı kaldır"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        )
      })}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={addRow}>
        <Plus className="size-3.5" /> {addLabel}
      </Button>
    </div>
  )
}

function CongressSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: congresses = [] } = useCongresses()
  const sorted = React.useMemo(
    () => [...congresses].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '')),
    [congresses],
  )
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Kongre / Workshop</Label>
        <QuickCongressDialog onCreated={onChange} />
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Kongre/workshop seçin" />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
              {c.start_date ? ` — ${format(new Date(c.start_date), 'd MMM yyyy', { locale: trLocale })}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Kongre/workshopa götürülen ürünleri ekleyen diyalog — kaydedilince her
 * satır ayrı bir sevkiyat kaydı olur ve gerçek stoktan (out) düşülür.
 * Aynı kongreye birden fazla ürün alt alta tek seferde girilebiliyor.
 */
function AddShipmentDialog({ presetCongressId }: { presetCongressId?: string } = {}) {
  const [open, setOpen] = React.useState(false)
  const [congressId, setCongressId] = React.useState(presetCongressId ?? '')
  const [note, setNote] = React.useState('')
  const { data: congresses = [] } = useCongresses()
  const rowsState = useShipmentRows(1)

  function reset() {
    setCongressId(presetCongressId ?? '')
    rowsState.reset()
    setNote('')
  }

  async function handleSubmit() {
    if (!congressId) {
      toast.error('Kongre / workshop seçin')
      return
    }
    if (!rowsState.validate()) return
    const congressName = congresses.find((c) => c.id === congressId)?.name ?? 'Kongre/Workshop'
    await rowsState.saveAll(congressId, congressName, note.trim() || null)
    reset()
    setOpen(false)
  }

  const count = rowsState.rows.length

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : (reset(), setOpen(false)))}>
      <DialogTrigger asChild>
        {presetCongressId ? (
          <Button type="button" variant="outline" size="sm" className="h-7">
            <Plus className="size-3.5" /> Ürün Ekle
          </Button>
        ) : (
          <Button>
            <Plus className="size-3.5" /> Sevkiyat Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kongreye/Workshopa Ürün Sevkiyatı</DialogTitle>
          <DialogDescription>
            Birden fazla ürünü alt alta ekleyebilirsiniz. Götürülen miktar kaydedilince gerçek stoktan düşülür.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CongressSelect value={congressId} onChange={setCongressId} />
          <ShipmentRowsEditor state={rowsState} addLabel="Ürün Ekle" />
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel, tüm satırlara yazılır)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. stand vitrini için" />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset()
              setOpen(false)
            }}
          >
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={rowsState.submitting}>
            {count > 1 ? `${count} Ürünü Kaydet` : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Yanlış girilen kongre/ürün/miktarı düzeltmek için (kullanıcı isteğiyle,
 * 2026-08-22) — kaydedince stok farkını (eski ürün/miktar → yeni ürün/miktar)
 * düzeltiyor. İade zaten girildiyse (quantity_returned_sealed/open > 0) ürün
 * değiştirme engelleniyor — o iadeler hangi ürüne ait olduğunu artık
 * belirsizleştirir, bu durumda önce kaydı silip yeniden girmek gerekir.
 * Ayrıca "Başka Ürün Ekle" ile aynı kongreye yeni ürün satırları eklenebiliyor
 * (2026-09-29) — bunlar mevcut kaydı değiştirmez, ayrı sevkiyat olarak girilir.
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
  const extraRows = useShipmentRows(0)

  const hasReturns = shipment.quantity_returned_sealed > 0 || shipment.quantity_returned_open > 0

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
    if (!extraRows.validate()) return
    const congressName = congresses.find((c) => c.id === congressId)?.name ?? 'Kongre/Workshop'
    const trimmedNote = note.trim() || null
    const changed =
      productChanged ||
      qty !== shipment.quantity_taken ||
      congressId !== shipment.congress_id ||
      trimmedNote !== (shipment.note ?? null)

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

    if (changed) {
      await updateMutation.mutateAsync({
        id: shipment.id,
        input: {
          congress_id: congressId,
          product_id: productId,
          product_name: productName,
          quantity_taken: qty,
          note: trimmedNote,
        },
      })
    }
    await extraRows.saveAll(congressId, congressName, trimmedNote)
    onClose()
  }

  const submitting = updateMutation.isPending || recordMovement.isPending || extraRows.submitting

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sevkiyatı Düzenle</DialogTitle>
          <DialogDescription>
            {hasReturns
              ? 'Bu sevkiyatta iade zaten girildiği için ürün değiştirilemez — kongre, miktar ve not düzenlenebilir.'
              : 'Bu satırın ürününü/miktarını düzeltebilir veya aşağıdan aynı kongreye başka ürünler ekleyebilirsiniz.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CongressSelect value={congressId} onChange={setCongressId} />
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <div className="grid gap-1.5">
              <Label>Bu satırdaki ürün</Label>
              <ProductCombobox
                value={productId}
                onChange={(p: Product) => {
                  setProductId(p.id)
                  setProductName(p.name)
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Götürülen</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          {hasReturns && (
            <p className="text-muted-foreground -mt-2 text-xs">İade girildiği için ürün değişikliği kaydedilmeyecek.</p>
          )}

          <div className="grid gap-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">Aynı kongreye başka ürün ekle</p>
            <p className="text-muted-foreground -mt-1 text-xs">
              Buraya eklediğiniz ürünler yukarıdaki ürünü değiştirmez, listeye alt alta yeni satır olarak eklenir.
            </p>
            <ShipmentRowsEditor state={extraRows} addLabel="Başka Ürün Ekle" />
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
            {extraRows.rows.length > 0 ? `Kaydet (+${extraRows.rows.length} yeni ürün)` : 'Kaydet'}
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
 * Ürünlerden AYRI malzeme menüleri (kullanıcı istekleri, 2026-09-30) —
 * "Sevkiyat Ekle"nin yanında iki buton: Sarf Malzeme (iğne, eldiven vb. tek
 * tek eklenir) ve Afiş / Katalog / Ekstra (tanıtım malzemeleri + ekstra
 * gerekli malzemeler). Kongre seçilir; her kalemde isim + adet, ✓ / ✗
 * işareti; liste PNG olarak dışa aktarılır. Stoktan düşmez.
 */
function MaterialsDialog({
  defaultCongressId,
  label,
  title,
  description,
  groups,
}: {
  defaultCongressId?: string
  label: string
  title: string
  description: string
  groups: MaterialGroup[]
}) {
  const [open, setOpen] = React.useState(false)
  const [congressId, setCongressId] = React.useState('')
  const { data: congresses = [] } = useCongresses()
  const activeCongressId = congressId || defaultCongressId || ''
  const congress = congresses.find((c) => c.id === activeCongressId)
  const congressLabel = congress
    ? congress.name +
      (congress.start_date ? ` — ${format(new Date(congress.start_date), 'd MMMM yyyy', { locale: trLocale })}` : '')
    : ''

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardList className="size-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CongressSelect value={activeCongressId} onChange={setCongressId} />
          {activeCongressId ? (
            <CongressMaterialsSection
              key={activeCongressId}
              congressId={activeCongressId}
              congressLabel={congressLabel}
              groups={groups}
              exportTitle={title}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Önce bir kongre / workshop seçin.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  // Ürün satırlarında küçük ürün resmi (kullanıcı isteği, 2026-09-30) —
  // sevkiyat kaydında görsel tutulmuyor, ürün kataloğundan eşleştiriliyor.
  const { data: products = [] } = useProducts('')
  const imageByProductId = React.useMemo(() => new Map(products.map((p) => [p.id, p.image_url])), [products])

  // Kongre bazında gruplanmış görünüm (kullanıcı isteği, 2026-09-29: "tek
  // kongrede hepsi olmalı, alt alta eklenmeli") — her kongre bir başlık
  // satırı + altında o kongreye götürülen tüm ürünler. Liste created_at'e
  // göre yeniden eskiye geldiği için en son işlem gören kongre en üstte.
  const groups = React.useMemo(() => {
    const map = new Map<string, { congressId: string; congress: CongressShipmentWithCongress['congresses']; items: CongressShipmentWithCongress[] }>()
    for (const s of shipments) {
      const g = map.get(s.congress_id)
      if (g) g.items.push(s)
      else map.set(s.congress_id, { congressId: s.congress_id, congress: s.congresses, items: [s] })
    }
    return Array.from(map.values())
  }, [shipments])

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
        <div className="flex flex-wrap items-center gap-2">
          <MaterialsDialog
            defaultCongressId={groups[0]?.congressId}
            label="Sarf Malzeme"
            title="Sarf Malzeme Listesi"
            description="Kongreye/workshopa götürülen sarf malzemeler (iğne, kanül, eldiven vb.) — tek tek ekleyin, adet girin, hazır olanı ✓, olmayanı ✗ ile işaretleyin. Stoktan düşmez."
            groups={['sarf']}
          />
          <MaterialsDialog
            defaultCongressId={groups[0]?.congressId}
            label="Afiş / Katalog / Ekstra"
            title="Afiş, Katalog, Broşür ve Ekstra Malzemeler"
            description="Götürülen afiş / katalog / broşür ve ekstra gerekli malzemeler — isim ve adet girin, hazır olanı ✓, olmayanı ✗ ile işaretleyin. Stoktan düşmez."
            groups={['tanitim', 'ekstra']}
          />
          <AddShipmentDialog />
        </div>
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
              {groups.map((g) => (
                <React.Fragment key={g.congressId}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={8}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold">{g.congress?.name ?? '—'}</span>
                          {g.congress?.start_date && (
                            <span className="text-muted-foreground text-xs">
                              {format(new Date(g.congress.start_date), 'd MMM yyyy', { locale: trLocale })}
                            </span>
                          )}
                          <span className="text-muted-foreground text-xs">· {g.items.length} ürün</span>
                        </div>
                        <AddShipmentDialog presetCongressId={g.congressId} />
                      </div>
                    </TableCell>
                  </TableRow>
                  {g.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell />
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ZoomableThumbnail
                            src={imageByProductId.get(s.product_id)}
                            alt={s.product_name}
                            className="size-9 max-w-none shrink-0 rounded-md border-2 border-muted-foreground/30 bg-muted object-cover"
                            fallback={<div className="size-9 shrink-0 rounded-md border-2 border-muted-foreground/30 bg-muted" />}
                          />
                          {s.product_name}
                        </div>
                      </TableCell>
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
                  ))}
                </React.Fragment>
              ))}
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
