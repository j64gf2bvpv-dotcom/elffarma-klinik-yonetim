import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { CheckCircle2, Loader2, PackageCheck, PackageOpen, Truck, Users, Boxes, ClipboardList, Plus, Pencil, Trash2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, PREMIUM_TABLE } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { exportToExcel, type ExportColumn } from '@/lib/exportData'
import { cn, getErrorMessage } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { useSales } from '@/features/sales/hooks'
import { updateSale } from '@/features/sales/api'
import { useAllPendingProducts } from '@/features/customers/hooks'
import { deletePendingProduct } from '@/features/customers/api'
import { useCustomers } from '@/features/customers/hooks'
import { useCargoShipments } from '@/features/cargo/hooks'
import { createCargoShipment, markCargoShipped } from '@/features/cargo/api'
import { useProducts } from '@/features/stock/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { SaleStockDialog } from '@/features/doctorVisits/SaleStockDialog'
import { matchProduct } from '@/features/doctorVisits/productMatch'
import { OwedEntryDialog, type OwedEditTarget } from './OwedEntryDialog'
import { OwedListImportDialog } from './OwedListImportDialog'
import { cleanOwedNote } from './owedListImport'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import type { CargoShipment, DoctorVisit, Sale } from '@/types/database'

/**
 * Borçlu Olduğumuz Ürünler (kullanıcı isteği, 2026-11-24: "stok bölümünde borçlu olduğumuz doktor ve ürün grupları
 * olsun, gönderdiğimiz göndermediğimizin takibi olmalı, kargo gitti gitmedi bilgisi de olmalı").
 * Kaynaklar: satışı yapılıp tamamı gönderilmemiş ürünler (sales), elle eklenen eksik ürünler
 * (customer_pending_products) ve temsilci raporundaki bekleyen siparişler (doctor_visits.sale.pending).
 * Kargo bilgisi Kargo sekmesindeki kayıtlardan (aynı doktor + ürün) gelir.
 */

type Source = 'satis' | 'elle' | 'rapor'
type Status = 'gonderilmedi' | 'kismi' | 'gonderildi'

interface OwedRow {
  key: string
  customerId: string | null
  doctor: string
  productName: string
  qty: number
  totalQty: number
  amount: number | null
  date: string
  source: Source
  status: Status
  shippedAt: string | null
  cargo?: CargoShipment
  sale?: Sale
  pendingId?: string
  unitPrice?: number
  note?: string | null
  visit?: DoctorVisit
  repName?: string
  /** Satışı yapan kişi */
  rep?: string | null
  /** Siparişin alındığı kongre / workshop / masterclass */
  event?: string | null
  /** Sipariş edilen toplam adet */
  ordered: number
  /** Şimdiye kadar verilen adet */
  delivered: number
  /** Aynı siparişten verilen ürünlerin adları */
  deliveredItems?: string | null
  /** Eksik kalan adet (= qty) değil; qty zaten eksik kalan */
  orderDate?: string | null
}

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/\s+/g, ' ').trim()
const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
const day = (d: string | null) => (d ? format(new Date(d.length === 10 ? `${d}T00:00:00` : d), 'd MMM yyyy', { locale: trLocale }) : '—')

// Liste düzeni (kullanıcı isteği, 2026-11-25): Doktor İsmi | Satış Yapan | Alınan Ürünler | Fiyat | Borçlu Ürünler | Not
/** Doktorun bu siparişten aldığı (kendisine verilen) ürünler */
const receivedText = (r: OwedRow) => r.deliveredItems || (r.delivered > 0 ? `${r.delivered} ${r.productName}` : '')
/** Hâlâ borçlu olduğumuz ürün: "5 BVRS PL" */
const owedText = (r: OwedRow) => `${r.qty} ${r.productName}`
/** Not: kongre / workshop adı ve not birlikte; tarih ve satış yapan yazılmaz */
const noteText = (r: OwedRow) => [r.event, cleanOwedNote(r.note)].filter(Boolean).join(' · ')

interface DoctorExportRow {
  no: number
  doctor: string
  items: string
  invoice: string
  amount: number
  notes: string
  cargo: string
}

type ExportRow = OwedRow & { doctorTotal: number | '' }

// Her ürün ayrı satır (kullanıcı isteği, 2026-11-24: "doktor ismi, satış yapan kişi, verilen ürün, eksik kalan ürün,
// hangi kongre/workshop'ta alındığı ve tarihi; tutar ayrı, o doktora kalan toplam borç ayrı; diğer yazılar not kısmında")
const productColumns: ExportColumn<ExportRow>[] = [
  { header: 'Doktor İsmi', value: (r) => r.doctor },
  { header: 'Satış Yapan', value: (r) => r.rep ?? '' },
  { header: 'Alınan Ürünler', value: (r) => receivedText(r) },
  { header: 'Fiyat', value: (r) => r.amount ?? '' },
  { header: 'Borçlu Ürünler', value: (r) => owedText(r) },
  { header: 'Not', value: (r) => noteText(r) },
]

function useRepPendingVisits() {
  return useQuery({
    queryKey: ['doctor_visits', 'pending-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('doctor_visits').select('*').not('sale', 'is', null).order('visit_date', { ascending: false })
      if (error) throw error
      return ((data ?? []) as DoctorVisit[]).filter((v) => v.sale?.pending && v.sale.stock !== 'done' && v.sale.items?.length)
    },
  })
}

function cargoLabel(r: OwedRow): { text: string; tone: 'ok' | 'wait' | 'none' } {
  if (r.status === 'gonderildi') return { text: `Gönderildi · ${day(r.shippedAt)}`, tone: 'ok' }
  const c = r.cargo
  if (!c) return { text: 'Kargo kaydı yok', tone: 'none' }
  if (c.status === 'gonderildi') return { text: `Kargo gitti · ${day(c.shipped_at)}`, tone: 'ok' }
  if (c.status === 'gonderilecek') return { text: `Kargoya verilecek${c.ship_date ? ` · ${day(c.ship_date)}` : ''}`, tone: 'wait' }
  return { text: 'Kargoda bekletiliyor', tone: 'wait' }
}

export function OwedProductsPanel() {
  const { data: sales = [], isLoading: salesLoading } = useSales()
  const { data: pending = [] } = useAllPendingProducts()
  const { data: customers = [] } = useCustomers('')
  const { data: cargo = [] } = useCargoShipments()
  const { data: products = [] } = useProducts('')
  const { data: reps = [] } = useSalesReps()
  const { data: repVisits = [] } = useRepPendingVisits()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirmDialog()
  const [view, setView] = React.useState<'doktor' | 'urun'>('doktor')
  const [filter, setFilter] = React.useState<'bekleyen' | 'gonderildi' | 'tumu'>('bekleyen')
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [stockVisit, setStockVisit] = React.useState<OwedRow | null>(null)
  const [entryOpen, setEntryOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<OwedEditTarget | null>(null)
  const [listOpen, setListOpen] = React.useState(false)

  async function removeManual(r: OwedRow) {
    if (!r.pendingId || !(await confirm(`${r.doctor} — ${r.qty} ${r.productName} borç listesinden silinsin mi?`))) return
    try {
      await deletePendingProduct(r.pendingId)
      toast.success('Kayıt silindi')
      void queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
    } catch (err) {
      toast.error('Silinemedi', { description: getErrorMessage(err) })
    }
  }

  const customerName = React.useMemo(() => new Map(customers.map((c) => [c.id, c.full_name])), [customers])
  const customerPhone = React.useMemo(() => new Map(customers.map((c) => [c.id, c.phone])), [customers])

  const rows = React.useMemo<OwedRow[]>(() => {
    const findCargo = (customerId: string | null, doctor: string, product: string) =>
      cargo
        .filter(
          (c) =>
            (customerId ? c.customer_id === customerId : fold(c.recipient_name) === fold(doctor)) &&
            (fold(c.product_name).includes(fold(product)) || fold(product).includes(fold(c.product_name))),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const since = new Date(Date.now() - 60 * 864e5).toISOString()
    const repOf = (id: string | null) => (id ? reps.find((r) => r.id === id)?.name ?? null : null)
    const out: OwedRow[] = []
    for (const s of sales) {
      if (s.type !== 'sale') continue
      const shipped = s.shipped_quantity ?? 0
      const waiting = s.quantity - shipped
      const doctor = customerName.get(s.customer_id) ?? '—'
      if (waiting <= 0) {
        // Gönderilmiş olanlar son 60 gün için "Gönderildi" olarak görünür
        if (!s.shipped_at || s.shipped_at < since) continue
        out.push({ key: `s:${s.id}`, customerId: s.customer_id, doctor, productName: s.product_name, qty: s.quantity, totalQty: s.quantity, amount: s.quantity * Number(s.unit_price), date: s.sale_date, orderDate: s.sale_date, source: 'satis', status: 'gonderildi', shippedAt: s.shipped_at, sale: s, note: s.note, rep: repOf(s.sales_rep_id), event: s.congress_name, ordered: s.quantity, delivered: s.quantity, cargo: findCargo(s.customer_id, doctor, s.product_name) })
        continue
      }
      out.push({ key: `s:${s.id}`, customerId: s.customer_id, doctor, productName: s.product_name, qty: waiting, totalQty: s.quantity, amount: waiting * Number(s.unit_price), date: s.sale_date, orderDate: s.sale_date, source: 'satis', status: shipped > 0 ? 'kismi' : 'gonderilmedi', shippedAt: s.shipped_at, sale: s, note: s.note, rep: repOf(s.sales_rep_id), event: s.congress_name, ordered: s.quantity, delivered: shipped, cargo: findCargo(s.customer_id, doctor, s.product_name) })
    }
    for (const p of pending) {
      const doctor = customerName.get(p.customer_id) ?? '—'
      const delivered = p.delivered_quantity ?? 0
      out.push({ key: `p:${p.id}`, customerId: p.customer_id, doctor, productName: p.product_name, qty: p.quantity, totalQty: p.quantity, amount: p.quantity * Number(p.unit_price), date: p.order_date ?? p.created_at, orderDate: p.order_date, source: 'elle', status: 'gonderilmedi', shippedAt: null, pendingId: p.id, unitPrice: Number(p.unit_price), note: p.note, rep: p.sales_rep_name, event: p.event_name, ordered: p.ordered_quantity ?? p.quantity + delivered, delivered, deliveredItems: p.delivered_items, cargo: findCargo(p.customer_id, doctor, p.product_name) })
    }
    for (const v of repVisits) {
      const repName = reps.find((r) => r.id === v.sales_rep_id)?.name ?? 'Temsilci'
      for (const [i, it] of v.sale!.items.entries()) {
        const qty = Number(it.text.match(/\d+/)?.[0] ?? 1)
        out.push({ key: `v:${v.id}:${i}`, customerId: v.customer_id, doctor: v.doctor_name, productName: it.text.replace(/^\s*\d+\s*(\+\s*\d+\s*)?(paket|kutu|adet|flakon)?\s*/i, '') || it.text, qty, totalQty: qty, amount: it.amount, date: v.visit_date, orderDate: v.visit_date, source: 'rapor', status: 'gonderilmedi', shippedAt: null, visit: v, repName, rep: repName, ordered: qty, delivered: 0, cargo: findCargo(v.customer_id, v.doctor_name, it.text) })
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [sales, pending, repVisits, cargo, customerName, reps])

  const visible = rows.filter((r) => (filter === 'tumu' ? true : filter === 'gonderildi' ? r.status === 'gonderildi' : r.status !== 'gonderildi'))
  const open = rows.filter((r) => r.status !== 'gonderildi')
  const totals = {
    doctors: new Set(open.map((r) => r.customerId ?? r.doctor)).size,
    qty: open.reduce((s, r) => s + r.qty, 0),
    amount: open.reduce((s, r) => s + (r.amount ?? 0), 0),
    noCargo: open.filter((r) => !r.cargo || r.cargo.status !== 'gonderildi').filter((r) => !r.cargo).length,
    inCargo: open.filter((r) => r.cargo && r.cargo.status !== 'gonderildi').length,
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['sales'] })
    void queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
    void queryClient.invalidateQueries({ queryKey: ['cargo_shipments'] })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  async function addCargo(r: OwedRow) {
    setBusyKey(r.key)
    try {
      await createCargoShipment({
        customer_id: r.customerId,
        recipient_name: r.doctor,
        phone: r.customerId ? customerPhone.get(r.customerId) ?? null : null,
        // Satışta stok zaten düşüldü — kargo kaydı ürüne bağlanmaz (ikinci kez düşmesin)
        product_id: r.source === 'elle' ? matchProduct(r.productName, products)?.id ?? null : null,
        product_name: r.productName,
        quantity: r.qty,
        note: 'Borçlu olduğumuz ürün',
      })
      toast.success('Kargo kaydı açıldı', { description: 'Kargo sekmesinde "bekletiliyor" olarak duruyor.' })
      refresh()
    } catch (err) {
      toast.error('Kargo kaydı açılamadı', { description: getErrorMessage(err) })
    } finally {
      setBusyKey(null)
    }
  }

  async function markSent(r: OwedRow) {
    const stockNote = r.source === 'elle' ? ' Bu ürün henüz satışa girmediği için stoktan da düşülecek.' : ''
    if (!(await confirm(`${r.doctor} — ${r.qty} ${r.productName} gönderildi olarak işaretlensin mi?${stockNote}`))) return
    setBusyKey(r.key)
    try {
      let shipment = r.cargo && r.cargo.status !== 'gonderildi' ? r.cargo : undefined
      if (!shipment && !(r.cargo?.status === 'gonderildi')) {
        shipment = await createCargoShipment({
          customer_id: r.customerId,
          recipient_name: r.doctor,
          phone: r.customerId ? customerPhone.get(r.customerId) ?? null : null,
          product_id: r.source === 'elle' ? matchProduct(r.productName, products)?.id ?? null : null,
          product_name: r.productName,
          quantity: r.qty,
          note: 'Borçlu olduğumuz ürün — gönderildi',
        })
      }
      if (shipment) await markCargoShipped(shipment)
      if (r.sale) await updateSale(r.sale, { shipped_quantity: r.sale.quantity, shipped_at: new Date().toISOString() })
      if (r.pendingId) await deletePendingProduct(r.pendingId)
      toast.success('Gönderildi olarak işaretlendi')
      refresh()
    } catch (err) {
      toast.error('İşaretlenemedi', { description: getErrorMessage(err) })
    } finally {
      setBusyKey(null)
    }
  }

  // Doktora kalan toplam borç (gönderilmeyenlerin tutarı) — tutar ayrı, doktor toplamı ayrı (kullanıcı isteği, 2026-11-24)
  const doctorKey = (r: OwedRow) => r.customerId ?? fold(r.doctor)
  const doctorTotal = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of open) m.set(doctorKey(r), (m.get(doctorKey(r)) ?? 0) + (r.amount ?? 0))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // Dışa aktarma: her ürün ayrı satır, doktora göre sıralı; doktorun toplam borcu yalnız ilk satırında (toplanınca şişmesin)
  const exportRows = React.useMemo<ExportRow[]>(() => {
    const sorted = [...visible].sort((a, b) => a.doctor.localeCompare(b.doctor, 'tr') || (a.orderDate ?? a.date).localeCompare(b.orderDate ?? b.date))
    return sorted.map((r, i) => ({ ...r, doctorTotal: i === 0 || doctorKey(sorted[i - 1]) !== doctorKey(r) ? doctorTotal.get(doctorKey(r)) ?? 0 : '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, doctorTotal])

  // Doktor başına tek satır özet (kullanıcının ilk "ürün borçları" Excel'i düzeni) — menüde ayrı seçenek
  const doctorSummary = React.useMemo<DoctorExportRow[]>(() => {
    const map = new Map<string, OwedRow[]>()
    for (const r of visible) {
      if (!map.has(doctorKey(r))) map.set(doctorKey(r), [])
      map.get(doctorKey(r))!.push(r)
    }
    return [...map.values()]
      .sort((a, b) => a[0].doctor.localeCompare(b[0].doctor, 'tr'))
      .map((rs, i) => ({
        no: i + 1,
        doctor: rs[0].doctor,
        items: rs.map((r) => `${r.qty} ${r.productName}`).join(', '),
        invoice: '',
        amount: rs.reduce((s, r) => s + (r.amount ?? 0), 0),
        notes: [...new Set(rs.map((r) => r.note?.trim()).filter(Boolean) as string[])].join(' | '),
        cargo: [...new Set(rs.map((r) => cargoLabel(r).text))].join(', '),
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const groups = React.useMemo(() => {
    const map = new Map<string, { title: string; sub: string; rows: OwedRow[] }>()
    for (const r of visible) {
      const k = view === 'doktor' ? r.customerId ?? fold(r.doctor) : fold(matchProduct(r.productName, products)?.name ?? r.productName)
      const title = view === 'doktor' ? r.doctor : matchProduct(r.productName, products)?.name ?? r.productName
      if (!map.has(k)) map.set(k, { title, sub: '', rows: [] })
      map.get(k)!.rows.push(r)
    }
    return [...map.values()]
      .map((g) => ({ ...g, qty: g.rows.reduce((s, r) => s + r.qty, 0), amount: g.rows.reduce((s, r) => s + (r.amount ?? 0), 0) }))
      .sort((a, b) => b.qty - a.qty)
  }, [visible, view, products])

  const stat = (icon: React.ReactNode, label: string, value: string, hint?: string) => (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg leading-tight font-semibold tabular-nums">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-4">
      {dialog}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stat(<Users className="size-5" />, 'BORÇLU OLDUĞUMUZ DOKTOR', `${totals.doctors}`, 'ürünü gönderilmeyen')}
        {stat(<PackageOpen className="size-5" />, 'GÖNDERİLECEK ÜRÜN', `${totals.qty} adet`, totals.amount ? money(totals.amount) : undefined)}
        {stat(<Truck className="size-5" />, 'KARGODA BEKLEYEN', `${totals.inCargo}`, 'henüz gitmedi')}
        {stat(<ClipboardList className="size-5" />, 'KARGO KAYDI YOK', `${totals.noCargo}`, 'kargoya verilmedi')}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ['doktor', 'Doktora göre', Users],
              ['urun', 'Ürün grubuna göre', Boxes],
            ] as const
          ).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium', view === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ['bekleyen', `Gönderilmeyen (${open.length})`],
              ['gonderildi', 'Gönderilen (son 60 gün)'],
              ['tumu', 'Tümü'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={cn('rounded-md px-3 py-1.5 font-medium', filter === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setListOpen(true)}>
            <FileSpreadsheet className="size-4" /> WhatsApp / Excel’den ekle
          </Button>
          <Button size="sm" onClick={() => { setEditTarget(null); setEntryOpen(true) }}>
            <Plus className="size-4" /> Elle ekle
          </Button>
          <ExportMenu<ExportRow>
            title="Borçlu Olduğumuz Ürünler"
            filename="urun-borclari"
            rows={exportRows}
            columns={productColumns}
            extraItems={
              <DropdownMenuItem
                onClick={() =>
                  doctorSummary.length
                    ? exportToExcel('urun-borclari-doktor-ozeti', [
                        { header: 'Sıra', value: (r: DoctorExportRow) => r.no },
                        { header: 'Doktor', value: (r: DoctorExportRow) => r.doctor },
                        { header: 'Ürünler', value: (r: DoctorExportRow) => r.items },
                        { header: 'Kalan Toplam Borç', value: (r: DoctorExportRow) => r.amount || '' },
                        { header: 'Kargo', value: (r: DoctorExportRow) => r.cargo },
                        { header: 'Not', value: (r: DoctorExportRow) => r.notes },
                      ], doctorSummary)
                    : toast.error('Dışa aktarılacak veri yok')
                }
              >
                <FileSpreadsheet className="size-4" /> Doktor başına tek satır özet (Excel)
              </DropdownMenuItem>
            }
          />
        </div>
      </div>

      {salesLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" /> {filter === 'bekleyen' ? 'Gönderilmeyi bekleyen ürün yok. Eklemek için sağ üstteki “WhatsApp / Excel’den ekle” ya da “Elle ekle” düğmesini kullanın.' : 'Kayıt yok.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className={PREMIUM_TABLE}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">Doktor İsmi</TableHead>
                  <TableHead className="hidden md:table-cell">Satış Yapan</TableHead>
                  <TableHead className="hidden lg:table-cell">Alınan Ürünler</TableHead>
                  <TableHead className="text-right">Fiyat</TableHead>
                  <TableHead>Borçlu Ürünler</TableHead>
                  <TableHead className="hidden w-[24%] sm:table-cell">Not</TableHead>
                  <TableHead className="hidden xl:table-cell">Kargo</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <React.Fragment key={g.title}>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableCell colSpan={8} className="py-2">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold">{g.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {g.rows.length} kalem · {g.qty} adet eksik{g.amount ? ` · ${money(g.amount)}` : ''}
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                    {g.rows.map((r) => {
                      const c = cargoLabel(r)
                      return (
                        <React.Fragment key={r.key}>
                        <TableRow>
                          <TableCell className="whitespace-normal">
                            <span className="font-medium">{r.doctor}</span>
                            {/* Dar ekranda gizlenen sütunlar adın altında */}
                            {r.rep && <span className="block text-xs text-muted-foreground md:hidden">{r.rep}</span>}
                          </TableCell>
                          <TableCell className="hidden whitespace-normal md:table-cell">{r.rep || '—'}</TableCell>
                          <TableCell className="hidden whitespace-normal text-success lg:table-cell">{receivedText(r) || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.amount != null ? money(r.amount) : '—'}</TableCell>
                          <TableCell className="whitespace-normal">
                            <span className="font-semibold">{owedText(r)}</span>
                            {receivedText(r) && <span className="block text-xs text-success lg:hidden">Alınan: {receivedText(r)}</span>}
                            <span className={cn('mt-0.5 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium xl:hidden', c.tone === 'ok' && 'bg-success/12 text-success', c.tone === 'wait' && 'bg-warning/15 text-warning', c.tone === 'none' && 'bg-destructive/10 text-destructive')}>
                              {c.tone === 'ok' ? <PackageCheck className="size-3.5" /> : <Truck className="size-3.5" />} {c.text}
                            </span>
                            {noteText(r) && <span className={cn('block text-xs sm:hidden', /incelen/i.test(noteText(r)) ? 'font-medium text-warning' : 'text-muted-foreground')}>{noteText(r)}</span>}
                          </TableCell>
                          <TableCell className={cn('hidden whitespace-normal text-sm sm:table-cell', /incelen/i.test(noteText(r)) ? 'font-medium text-warning' : 'text-muted-foreground')}>{noteText(r) || '—'}</TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                c.tone === 'ok' && 'bg-success/12 text-success',
                                c.tone === 'wait' && 'bg-warning/15 text-warning',
                                c.tone === 'none' && 'bg-destructive/10 text-destructive',
                              )}
                            >
                              {c.tone === 'ok' ? <PackageCheck className="size-3.5" /> : <Truck className="size-3.5" />} {c.text}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === 'gonderildi' ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : r.source === 'rapor' ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStockVisit(r)}>
                                Satışa çevir
                              </Button>
                            ) : (
                              <span className="inline-flex flex-wrap justify-end gap-1.5">
                                {!r.cargo && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busyKey === r.key} onClick={() => void addCargo(r)}>
                                    <Truck className="size-3.5" /> Kargo kaydı
                                  </Button>
                                )}
                                <Button size="sm" className="h-7 text-xs" disabled={busyKey === r.key} onClick={() => void markSent(r)}>
                                  {busyKey === r.key ? <Loader2 className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />} Gönderildi
                                </Button>
                                {r.source === 'elle' && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7 text-muted-foreground"
                                      title="Düzenle"
                                      aria-label="Düzenle"
                                      onClick={() => {
                                        setEditTarget({ pendingId: r.pendingId!, doctor: r.doctor, productName: r.productName, qty: r.qty, unitPrice: r.unitPrice ?? 0, note: r.note ?? null, rep: r.rep ?? null, event: r.event ?? null, orderDate: r.orderDate ?? null, delivered: r.delivered, deliveredItems: r.deliveredItems ?? null })
                                        setEntryOpen(true)
                                      }}
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" title="Sil" aria-label="Sil" onClick={() => void removeManual(r)}>
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </>
                                )}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <OwedEntryDialog open={entryOpen} onOpenChange={setEntryOpen} edit={editTarget} />
      <OwedListImportDialog
        open={listOpen}
        onOpenChange={setListOpen}
        products={products}
        existing={open.map((r) => ({ customerId: r.customerId, doctor: r.doctor, productName: r.productName, qty: r.qty, pendingId: r.pendingId, note: r.note ?? null }))}
      />
      {stockVisit?.visit && (
        <SaleStockDialog
          visit={stockVisit.visit}
          sale={stockVisit.visit.sale!}
          repName={stockVisit.repName ?? 'Temsilci'}
          open={!!stockVisit}
          onOpenChange={(o) => {
            if (!o) {
              setStockVisit(null)
              void queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
            }
          }}
        />
      )}
    </div>
  )
}
