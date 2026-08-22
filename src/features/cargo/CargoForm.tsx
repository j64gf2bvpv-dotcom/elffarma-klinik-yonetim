import * as React from 'react'
import { Plus, Loader2 } from 'lucide-react'

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
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useCustomer } from '@/features/customers/hooks'
import { useCreateCargoShipment } from './hooks'
import type { Product } from '@/types/database'

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
