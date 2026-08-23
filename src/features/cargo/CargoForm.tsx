import * as React from 'react'
import { Plus, Loader2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useCustomer } from '@/features/customers/hooks'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { useCreateCargoShipment, useUpdateCargoShipment } from './hooks'
import type { CargoShipment, Product } from '@/types/database'

/**
 * Yeni kargo kaydı — bir doktor/müşteri seçilirse alıcı adı/telefon/adres
 * otomatik dolduruluyor ama hepsi elle de değiştirilebiliyor (ör. farklı bir
 * teslimat adresi). Ürün seçilince stok bağlantısı kurulur — "Gönderildi"
 * işaretlenince bu ürün üzerinden gerçek bir stok çıkışı yapılır (bkz.
 * api.ts markCargoShipped).
 */
export function CargoForm() {
  const [open, setOpen] = React.useState(false)
  const [customerId, setCustomerId] = React.useState<string | undefined>(undefined)
  const [recipientName, setRecipientName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [product, setProduct] = React.useState<Product | undefined>(undefined)
  const [quantity, setQuantity] = React.useState('1')
  const [shipDate, setShipDate] = React.useState('')
  const [note, setNote] = React.useState('')
  const { data: customer } = useCustomer(customerId)
  const createMutation = useCreateCargoShipment()

  React.useEffect(() => {
    if (!customer) return
    setRecipientName(customer.full_name)
    setPhone(customer.phone ?? '')
    setAddress(customer.address ?? '')
  }, [customer])

  function reset() {
    setCustomerId(undefined)
    setRecipientName('')
    setPhone('')
    setAddress('')
    setProduct(undefined)
    setQuantity('1')
    setShipDate('')
    setNote('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientName.trim() || !product) return
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return
    await createMutation.mutateAsync({
      customer_id: customerId ?? null,
      recipient_name: recipientName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      ship_date: shipDate || null,
      note: note.trim() || null,
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Yeni Kargo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Kargo Kaydı</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Doktor / Müşteri (opsiyonel)</Label>
            <CustomerCombobox value={customerId} onChange={setCustomerId} placeholder="Seçilirse bilgiler otomatik dolar" />
          </div>
          <div className="grid gap-1.5">
            <Label>Alıcı Adı</Label>
            <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Gönderim Tarihi</Label>
              <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Adres</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="grid gap-1.5">
              <Label>Ürün</Label>
              <ProductCombobox value={product?.id} onChange={setProduct} />
            </div>
            <div className="grid gap-1.5">
              <Label>Miktar</Label>
              <Input type="number" min="1" className="w-20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          {product && (
            <p className="text-muted-foreground text-xs">
              Stokta: {product.current_quantity} Paket
              {Number(quantity) > product.current_quantity && (
                <span className="text-destructive font-medium"> — yetersiz stok</span>
              )}
            </p>
          )}
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !recipientName.trim() || !product}>
              {createMutation.isPending && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Var olan bir kargo kaydını düzenler — kullanıcı isteğiyle (2026-08-24,
 * "kargo kısmında düzenleme kısmı yok"). Kayıt zaten "Gönderildi" işaretliyse
 * (stok o an zaten düşülmüş) ürün/miktar değişince eski ürün/miktarın stok
 * etkisi geri alınıp yenisi uygulanır — CongressShipmentsPanel'deki
 * EditShipmentDialog ile aynı desen. Henüz gönderilmemiş kayıtlarda stok hiç
 * düşülmediği için sadece alanlar güncellenir, stok hareketi tetiklenmez.
 * Müşteri seçilince alıcı bilgilerini CargoForm'daki gibi otomatik doldurmuyor
 * — düzenlemede zaten elle girilmiş/özelleştirilmiş bilgilerin sessizce
 * ezilmemesi için.
 */
export function EditCargoDialog({ shipment }: { shipment: CargoShipment }) {
  const [open, setOpen] = React.useState(false)
  const [customerId, setCustomerId] = React.useState<string | undefined>(shipment.customer_id ?? undefined)
  const [recipientName, setRecipientName] = React.useState(shipment.recipient_name)
  const [phone, setPhone] = React.useState(shipment.phone ?? '')
  const [address, setAddress] = React.useState(shipment.address ?? '')
  const [productId, setProductId] = React.useState<string | undefined>(shipment.product_id ?? undefined)
  const [productName, setProductName] = React.useState(shipment.product_name)
  const [quantity, setQuantity] = React.useState(String(shipment.quantity))
  const [shipDate, setShipDate] = React.useState(shipment.ship_date ?? '')
  const [note, setNote] = React.useState(shipment.note ?? '')

  const updateMutation = useUpdateCargoShipment()
  const recordMovement = useRecordStockMovement()

  function reset() {
    setCustomerId(shipment.customer_id ?? undefined)
    setRecipientName(shipment.recipient_name)
    setPhone(shipment.phone ?? '')
    setAddress(shipment.address ?? '')
    setProductId(shipment.product_id ?? undefined)
    setProductName(shipment.product_name)
    setQuantity(String(shipment.quantity))
    setShipDate(shipment.ship_date ?? '')
    setNote(shipment.note ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientName.trim() || !productId) return
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return

    const productChanged = productId !== shipment.product_id
    const quantityChanged = qty !== shipment.quantity
    if (shipment.status === 'gonderildi' && shipment.product_id && (productChanged || quantityChanged)) {
      if (productChanged) {
        await recordMovement.mutateAsync({
          product_id: shipment.product_id,
          movement_type: 'return',
          quantity: shipment.quantity,
          reason: 'Kargo kaydı düzenlendi — eski ürün iptal edildi',
          note: recipientName,
        })
        await recordMovement.mutateAsync({
          product_id: productId,
          movement_type: 'out',
          quantity: qty,
          reason: 'Kargo kaydı düzenlendi — yeni ürün',
          note: recipientName,
        })
      } else {
        const delta = qty - shipment.quantity
        await recordMovement.mutateAsync({
          product_id: productId,
          movement_type: delta > 0 ? 'out' : 'return',
          quantity: Math.abs(delta),
          reason: 'Kargo kaydı düzenlendi — miktar farkı',
          note: recipientName,
        })
      }
    }

    await updateMutation.mutateAsync({
      id: shipment.id,
      input: {
        customer_id: customerId ?? null,
        recipient_name: recipientName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        product_id: productId,
        product_name: productName,
        quantity: qty,
        ship_date: shipDate || null,
        note: note.trim() || null,
      },
    })
    setOpen(false)
  }

  const submitting = updateMutation.isPending || recordMovement.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Düzenle">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kargo Kaydını Düzenle</DialogTitle>
          {shipment.status === 'gonderildi' && (
            <DialogDescription>
              Bu kayıt zaten "Gönderildi" işaretli — ürün ya da miktar değiştirirseniz stok farkı otomatik düzeltilir.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Doktor / Müşteri (opsiyonel)</Label>
            <CustomerCombobox value={customerId} onChange={setCustomerId} placeholder="Seçilirse bilgiler otomatik dolar" />
          </div>
          <div className="grid gap-1.5">
            <Label>Alıcı Adı</Label>
            <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Gönderim Tarihi</Label>
              <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Adres</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="grid gap-1.5">
              <Label>Ürün</Label>
              <ProductCombobox
                value={productId}
                onChange={(p) => {
                  setProductId(p.id)
                  setProductName(p.name)
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Miktar</Label>
              <Input type="number" min="1" className="w-20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={submitting || !recipientName.trim() || !productId}>
              {submitting && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
