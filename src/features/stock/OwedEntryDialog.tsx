import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { createCustomer, createPendingProduct, updatePendingProduct } from '@/features/customers/api'
import { nameKey, phoneKey } from '@/features/customers/dedupe'
import { cariName } from '@/features/doctorVisits/linkCustomer'
import { useSalesReps } from '@/features/salesReps/hooks'
import { supabase } from '@/lib/supabaseClient'
import { cn, getErrorMessage } from '@/lib/utils'

interface Line {
  productId: string
  freeText: boolean
  name: string
  /** Sipariş edilen adet */
  ordered: string
  /** Verilen adet */
  delivered: string
  price: string
}

const emptyLine = (): Line => ({ productId: '', freeText: false, name: '', ordered: '1', delivered: '0', price: '' })
const remaining = (l: Line) => Math.max(0, (Number(l.ordered) || 0) - (Number(l.delivered) || 0))

export interface OwedEditTarget {
  pendingId: string
  doctor: string
  productName: string
  /** Eksik kalan */
  qty: number
  unitPrice: number
  note: string | null
  rep: string | null
  event: string | null
  orderDate: string | null
  delivered: number
}

/**
 * Borçlu olduğumuz ürünü elle girme / düzenleme (kullanıcı isteği, 2026-11-24: "borçlu olduğumuz kısımdaki
 * doktorlar ve ürünler manuel girilebilmeli"; aynı gün: "satış yapan kişi, verilen ürün, eksik kalan ürün, hangi
 * kongre/workshop'ta alındığı ve tarihi olmalı, ürünler tek tek ayrı ayrı"). Doktor Cari Kart'tan seçilir ya da yeni
 * yazılır (aynı isim/telefon Cari Kart'ta varsa o kart kullanılır, yoksa yeni kart açılır). Her ürün ayrı kayıt
 * (customer_pending_products) olur; eksik kalan = sipariş − verilen. Stok ancak "Gönderildi" denince düşer.
 */
export function OwedEntryDialog({ open, onOpenChange, edit }: { open: boolean; onOpenChange: (o: boolean) => void; edit?: OwedEditTarget | null }) {
  const queryClient = useQueryClient()
  const { data: reps = [] } = useSalesReps()
  const [customerId, setCustomerId] = React.useState<string>('')
  const [newDoctor, setNewDoctor] = React.useState(false)
  const [doctorName, setDoctorName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [rep, setRep] = React.useState('')
  const [event, setEvent] = React.useState('')
  const [orderDate, setOrderDate] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>([emptyLine()])
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCustomerId('')
    setNewDoctor(false)
    setDoctorName('')
    setPhone('')
    setRep(edit?.rep ?? '')
    setEvent(edit?.event ?? '')
    setOrderDate(edit?.orderDate ?? new Date().toISOString().slice(0, 10))
    setNote(edit?.note ?? '')
    setLines(
      edit
        ? [{ productId: '', freeText: true, name: edit.productName, ordered: String(edit.qty + edit.delivered), delivered: String(edit.delivered), price: edit.unitPrice ? String(edit.unitPrice) : '' }]
        : [emptyLine()],
    )
  }, [open, edit])

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const lineOk = (l: Line) => l.name.trim() && Number(l.ordered) > 0 && (Number(l.delivered) || 0) <= Number(l.ordered)
  const doctorOk = edit ? true : newDoctor ? doctorName.trim().length > 1 : !!customerId
  const valid = doctorOk && lines.length > 0 && lines.every(lineOk)

  async function resolveCustomer(): Promise<string> {
    if (!newDoctor) return customerId
    const { data, error } = await supabase.from('customers').select('id, full_name, phone, mobile_phone, whatsapp_phone')
    if (error) throw error
    const key = nameKey(cariName(doctorName))
    const pk = phoneKey(phone)
    const list = (data ?? []) as { id: string; full_name: string; phone: string | null; mobile_phone: string | null; whatsapp_phone: string | null }[]
    const match =
      list.find((c) => nameKey(c.full_name) === key) ??
      (pk ? list.find((c) => [c.phone, c.mobile_phone, c.whatsapp_phone].map(phoneKey).includes(pk) && nameKey(c.full_name).split(' ').pop() === key.split(' ').pop()) : undefined)
    if (match) return match.id
    const created = await createCustomer({
      full_name: cariName(doctorName),
      phone: phone.trim(),
      tags: [],
      is_invoiced: false,
      doctor_type: 'sahis',
      sales_rep_id: null,
      notes: `Borçlu olduğumuz ürünler listesinden elle eklendi, ${new Date().toLocaleDateString('tr-TR')}`,
    })
    void queryClient.invalidateQueries({ queryKey: ['customers'] })
    return created.id
  }

  async function save() {
    setBusy(true)
    const common = { sales_rep_name: rep.trim() || null, event_name: event.trim() || null, order_date: orderDate || null, note: note.trim() || null }
    try {
      if (edit) {
        const l = lines[0]
        await updatePendingProduct(edit.pendingId, {
          ...common,
          product_name: l.name.trim(),
          quantity: remaining(l),
          ordered_quantity: Number(l.ordered),
          delivered_quantity: Number(l.delivered) || 0,
          unit_price: Number(l.price) || 0,
        })
        toast.success('Kayıt güncellendi')
      } else {
        const cid = await resolveCustomer()
        for (const l of lines) {
          await createPendingProduct({
            ...common,
            customer_id: cid,
            product_name: l.name.trim(),
            quantity: remaining(l),
            ordered_quantity: Number(l.ordered),
            delivered_quantity: Number(l.delivered) || 0,
            unit_price: Number(l.price) || 0,
          })
        }
        toast.success(`${lines.length} ürün borç listesine eklendi`)
      }
      void queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
      onOpenChange(false)
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{edit ? `Borçlu ürünü düzenle — ${edit.doctor}` : 'Borçlu olduğumuz ürün ekle'}</DialogTitle>
          <DialogDescription>Her ürün ayrı satırdır. Eksik kalan = sipariş − verilen. Stok, ürün gönderildi olarak işaretlenince düşülür.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!edit && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Doktor</Label>
                <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                  {(
                    [
                      [false, 'Cari Kart’tan seç', Users],
                      [true, 'Yeni doktor', UserPlus],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button key={label} type="button" onClick={() => setNewDoctor(v)} className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 font-medium', newDoctor === v ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              {newDoctor ? (
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <Input placeholder="Doktor adı soyadı" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                  <Input placeholder="Telefon (isteğe bağlı)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <p className="text-xs text-muted-foreground sm:col-span-2">Bu isim ya da telefon Cari Kart’ta varsa o doktora eklenir, yoksa yeni kart açılır.</p>
                </div>
              ) : (
                <CustomerCombobox value={customerId || undefined} onChange={setCustomerId} placeholder="Doktor seçin" />
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="owed-rep">Satış yapan</Label>
              <Input id="owed-rep" list="owed-rep-list" placeholder="Temsilci adı" value={rep} onChange={(e) => setRep(e.target.value)} />
              <datalist id="owed-rep-list">
                {reps.map((r) => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="owed-event">Kongre / Workshop</Label>
              <Input id="owed-event" placeholder="Örn. Mısır Kongresi" value={event} onChange={(e) => setEvent(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="owed-date">Sipariş tarihi</Label>
              <Input id="owed-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem_6.5rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ürün</span>
              <span>Sipariş</span>
              <span>Verilen</span>
              <span>Eksik</span>
              <span>Birim fiyat ₺</span>
              <span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[repeat(3,minmax(0,1fr))_2rem] items-start gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem_6.5rem_2rem] sm:border-0 sm:p-0">
                <div className="col-span-3 grid min-w-0 gap-1 sm:col-span-1">
                  {l.freeText ? (
                    <Input placeholder="Ürün adı" value={l.name} onChange={(e) => update(i, { name: e.target.value })} />
                  ) : (
                    <ProductCombobox value={l.productId || undefined} onChange={(p) => update(i, { productId: p.id, name: p.name, price: l.price || (p.unit_price ? String(p.unit_price) : '') })} />
                  )}
                  {!edit && (
                    <button type="button" className="w-fit text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => update(i, { freeText: !l.freeText, productId: '', name: '' })}>
                      {l.freeText ? 'Katalogdan seç' : 'Listede yok, elle yaz'}
                    </button>
                  )}
                </div>
                <Button type="button" size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive sm:order-last" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Satırı sil">
                  <Trash2 className="size-4" />
                </Button>
                <Input inputMode="numeric" aria-label="Sipariş adedi" placeholder="Sipariş" value={l.ordered} onChange={(e) => update(i, { ordered: e.target.value.replace(/[^\d]/g, '') })} />
                <Input inputMode="numeric" aria-label="Verilen adet" placeholder="Verilen" value={l.delivered} onChange={(e) => update(i, { delivered: e.target.value.replace(/[^\d]/g, '') })} />
                <span className={cn('flex h-9 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums', (Number(l.delivered) || 0) > (Number(l.ordered) || 0) && 'text-destructive')} aria-label="Eksik kalan">
                  {remaining(l)}
                </span>
                <Input className="col-span-3 sm:col-span-1" inputMode="decimal" aria-label="Birim fiyat" placeholder="Birim fiyat ₺" value={l.price} onChange={(e) => update(i, { price: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
              </div>
            ))}
            {!edit && (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                <Plus className="size-4" /> Ürün ekle
              </Button>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="owed-note">Not</Label>
            <Input id="owed-note" placeholder="Ayrıntılar — örn. faturasız, ürün gelince gönderilecek" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={() => void save()} disabled={!valid || busy}>
            {busy && <Loader2 className="animate-spin" />} {edit ? 'Kaydet' : 'Listeye ekle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
