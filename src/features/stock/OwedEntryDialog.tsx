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
import { supabase } from '@/lib/supabaseClient'
import { cn, getErrorMessage } from '@/lib/utils'

interface Line {
  productId: string
  freeText: boolean
  name: string
  qty: string
  price: string
}

const emptyLine = (): Line => ({ productId: '', freeText: false, name: '', qty: '1', price: '' })

export interface OwedEditTarget {
  pendingId: string
  doctor: string
  productName: string
  qty: number
  unitPrice: number
  note: string | null
}

/**
 * Borçlu olduğumuz ürünü elle girme / düzenleme (kullanıcı isteği, 2026-11-24: "borçlu olduğumuz kısımdaki
 * doktorlar ve ürünler manuel girilebilmeli"). Doktor Cari Kart'tan seçilir ya da yeni yazılır (aynı isim/telefon
 * Cari Kart'ta varsa o kart kullanılır, yoksa yeni kart açılır). Kayıt "eksik ürün" (customer_pending_products)
 * olarak durur — stok ancak "Gönderildi" denince düşer.
 */
export function OwedEntryDialog({ open, onOpenChange, edit }: { open: boolean; onOpenChange: (o: boolean) => void; edit?: OwedEditTarget | null }) {
  const queryClient = useQueryClient()
  const [customerId, setCustomerId] = React.useState<string>('')
  const [newDoctor, setNewDoctor] = React.useState(false)
  const [doctorName, setDoctorName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>([emptyLine()])
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCustomerId('')
    setNewDoctor(false)
    setDoctorName('')
    setPhone('')
    setNote(edit?.note ?? '')
    setLines(edit ? [{ productId: '', freeText: true, name: edit.productName, qty: String(edit.qty), price: edit.unitPrice ? String(edit.unitPrice) : '' }] : [emptyLine()])
  }, [open, edit])

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const lineOk = (l: Line) => l.name.trim() && Number(l.qty) > 0
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
    try {
      if (edit) {
        const l = lines[0]
        await updatePendingProduct(edit.pendingId, { product_name: l.name.trim(), quantity: Number(l.qty), unit_price: Number(l.price) || 0, note: note.trim() || null })
        toast.success('Kayıt güncellendi')
      } else {
        const cid = await resolveCustomer()
        for (const l of lines) {
          await createPendingProduct({ customer_id: cid, product_name: l.name.trim(), quantity: Number(l.qty), unit_price: Number(l.price) || 0, note: note.trim() || null })
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? `Borçlu ürünü düzenle — ${edit.doctor}` : 'Borçlu olduğumuz ürün ekle'}</DialogTitle>
          <DialogDescription>
            {edit ? 'Ürün, adet, fiyat ve notu düzeltebilirsiniz.' : 'Doktoru ve gönderilecek ürünleri girin. Stok, ürün gönderildi olarak işaretlenince düşülür.'}
          </DialogDescription>
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

          <div className="grid gap-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_7rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ürün</span>
              <span>Adet</span>
              <span>Birim fiyat ₺</span>
              <span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_2rem] items-start gap-2">
                <div className="grid min-w-0 gap-1">
                  {l.freeText ? (
                    <Input placeholder="Ürün adı" value={l.name} onChange={(e) => update(i, { name: e.target.value })} />
                  ) : (
                    <ProductCombobox
                      value={l.productId || undefined}
                      onChange={(p) => update(i, { productId: p.id, name: p.name, price: l.price || (p.unit_price ? String(p.unit_price) : '') })}
                    />
                  )}
                  {!edit && (
                    <button type="button" className="w-fit text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => update(i, { freeText: !l.freeText, productId: '', name: '' })}>
                      {l.freeText ? 'Katalogdan seç' : 'Listede yok, elle yaz'}
                    </button>
                  )}
                </div>
                <Input inputMode="numeric" aria-label="Adet" value={l.qty} onChange={(e) => update(i, { qty: e.target.value.replace(/[^\d]/g, '') })} />
                <Input inputMode="decimal" aria-label="Birim fiyat" placeholder="0" value={l.price} onChange={(e) => update(i, { price: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} />
                <Button type="button" size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Satırı sil">
                  <Trash2 className="size-4" />
                </Button>
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
            <Input id="owed-note" placeholder="Örn. ürün gelince gönderilecek" value={note} onChange={(e) => setNote(e.target.value)} />
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
