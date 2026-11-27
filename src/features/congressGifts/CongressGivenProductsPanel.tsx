import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Gift, Loader2, PackageCheck, PackageMinus, Plus, ShoppingBag, Trash2, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, PREMIUM_TABLE } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { type ExportColumn } from '@/lib/exportData'
import { cn, getErrorMessage } from '@/lib/utils'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useProducts } from '@/features/stock/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { readWorkbookMatrices } from '@/features/stock/owedListImport'
import type { CongressGivenProduct, Product } from '@/types/database'
import {
  createCongressGivenProduct,
  deductCongressGivenProduct,
  deleteCongressGivenProduct,
  fetchCongressGivenProducts,
  pendingDeduct,
  updateCongressGivenProduct,
  type CongressGivenInput,
} from './api'
import { matchGiven, parseCongressGivenExcel, type GivenLine } from './importExcel'

/**
 * Kongrede hocalara verilen ürünler (kullanıcı isteği, 2026-11-27: "Mısır kongresi için hocalara verdiğimiz ürünlerin
 * listesi var Excel olarak, programa ayrı bir sütuna işle, o formatta olsun"; "sadece kayıt tutulsun, stoktan düş tuşu
 * da olsun sonradan düşebilelim"). Tablo kullanıcının Excel'iyle aynı sütunlarda: No | Tarih | Açıklama | Adı Soyadı |
 * Ürünler | Sipariş | Teslim Edilen | Borç Ürün | Not. Kayıt stoğu değiştirmez; düşme satır satır ya da toplu yapılır.
 */

const KEY = ['congress_given_products']
const fmtDate = (d: string | null) => (d ? format(new Date(`${d}T00:00:00`), 'd/M/yy') : '')

type ViewRow = { sep: true; r?: undefined; first?: undefined; newGroup?: undefined; showName?: undefined; showRep?: undefined; gi?: undefined } | { sep?: undefined; r: CongressGivenProduct; first: boolean; newGroup: boolean; showName: boolean; showRep: boolean; gi: number }

/**
 * Premium tablo görünümü (kullanıcı isteği, 2026-11-27: "bu tabloyu daha kaliteli, premium yapar mısın, profesyonel
 * olsun"): şeffaf kırmızı sabit başlık, yumuşak çizgiler, hoca grupları sırayla hafif zeminli, tek yazı boyutu.
 */
const PREMIUM_GRID =
  '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-11 [&_th]:border-b [&_th]:border-primary/20 [&_th]:bg-[color-mix(in_oklab,var(--color-primary)_9%,var(--color-card))] [&_th]:px-3 [&_th]:text-[11px] [&_th]:font-bold [&_th]:tracking-wider [&_th]:whitespace-normal [&_th]:text-primary [&_th:not(:first-child)]:border-l [&_th:not(:first-child)]:border-l-primary/15 [&_td]:h-11 [&_td]:border-b [&_td]:border-border [&_td:not(:first-child)]:border-l [&_td:not(:first-child)]:border-l-border [&_td]:px-3 [&_td]:py-0 [&_td]:align-middle [&_td]:text-sm [&_td]:whitespace-nowrap [&_td]:overflow-hidden [&_td]:text-ellipsis'

export function CongressGivenProductsPanel() {
  const queryClient = useQueryClient()
  const { data: rows = [], isLoading, error } = useQuery({ queryKey: KEY, queryFn: fetchCongressGivenProducts })
  const { data: products = [] } = useProducts('')
  const { confirm, dialog } = useConfirmDialog()

  const congresses = React.useMemo(() => [...new Set(rows.map((r) => r.congress_name))], [rows])
  const [active, setActive] = React.useState<string | null>(null)
  const current = active && congresses.includes(active) ? active : (congresses[0] ?? null)
  const list = rows.filter((r) => r.congress_name === current)

  const [importOpen, setImportOpen] = React.useState(false)
  const [focusId, setFocusId] = React.useState<string | null>(null)
  const [pick, setPick] = React.useState<CongressGivenProduct | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: KEY })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
  }

  const productFor = (r: CongressGivenProduct) =>
    (r.product_id && products.find((p) => p.id === r.product_id)) || matchGiven(r.product_name, products)

  async function deductOne(r: CongressGivenProduct, product?: Product) {
    const p = product ?? productFor(r)
    if (!p) {
      setPick(r)
      return
    }
    setBusy(r.id)
    try {
      const n = await deductCongressGivenProduct(r, p.id)
      toast.success(`${n} ${p.name} stoktan düşüldü`, { description: r.doctor_name })
    } catch (err) {
      toast.error('Stoktan düşülemedi', { description: getErrorMessage(err) })
    } finally {
      setBusy(null)
      refresh()
    }
  }

  const waiting = list.filter((r) => pendingDeduct(r) > 0)
  async function deductAll() {
    const unmatched = waiting.filter((r) => !productFor(r))
    const ready = waiting.filter((r) => productFor(r))
    const total = ready.reduce((s, r) => s + pendingDeduct(r), 0)
    if (!ready.length) {
      toast.error('Düşülecek eşleşmiş ürün yok', { description: 'Ürünü tanınmayan satırlarda “Stoktan düş” ile ürünü seçin.' })
      return
    }
    const ok = await confirm(
      `${current} listesindeki teslim edilen ${total} ürün (${ready.length} satır) stoktan düşülsün mü?` +
        (unmatched.length ? ` Ürünü tanınmayan ${unmatched.length} satır atlanacak, onları tek tek seçebilirsiniz.` : ''),
      { title: 'Stoktan düş', confirmLabel: 'Stoktan Düş', variant: 'default' },
    )
    if (!ok) return
    setBusy('all')
    let done = 0
    try {
      for (const r of ready) {
        await deductCongressGivenProduct(r, productFor(r)!.id)
        done++
      }
      toast.success(`${done} satır stoktan düşüldü`)
    } catch (err) {
      toast.error(`${done} satır düşüldü, kalanlar düşülemedi`, { description: getErrorMessage(err) })
    } finally {
      setBusy(null)
      refresh()
    }
  }

  async function remove(r: CongressGivenProduct) {
    const extra = r.stock_deducted_quantity ? ' Stoktan düşülen adet geri eklenmez; gerekiyorsa stok geçmişinden silin.' : ''
    if (!(await confirm(`${r.doctor_name} — ${r.product_name} kaydı silinsin mi?${extra}`))) return
    try {
      await deleteCongressGivenProduct(r.id)
      refresh()
    } catch (err) {
      toast.error('Silinemedi', { description: getErrorMessage(err) })
    }
  }

  async function removeAll() {
    if (!current) return
    const deducted = list.filter((r) => r.stock_deducted_quantity > 0).length
    const ok = await confirm(
      `${current} borç listesindeki ${list.length} satırın tamamı silinsin mi?` +
        (deducted ? ` ${deducted} satır stoktan düşülmüştü; stok geri eklenmez, gerekiyorsa stok geçmişinden silin.` : ''),
      { title: 'Listeyi sil', confirmLabel: 'Tümünü Sil' },
    )
    if (!ok) return
    setBusy('del')
    let done = 0
    try {
      for (const r of list) {
        await deleteCongressGivenProduct(r.id)
        done++
      }
      toast.success(`${done} satır silindi`)
    } catch (err) {
      toast.error(`${done} satır silindi, kalanlar silinemedi`, { description: getErrorMessage(err) })
    } finally {
      setBusy(null)
      refresh()
    }
  }

  type Field = 'given_date' | 'description' | 'doctor_name' | 'sales_rep_name' | 'product_name' | 'ordered_quantity' | 'delivered_quantity' | 'owed_quantity' | 'note'
  const CARRY: Field[] = ['given_date', 'description', 'doctor_name', 'sales_rep_name']

  /**
   * Hücre düzenleme (kullanıcı isteği, 2026-11-27: "tabloların içine müdahil olalım, düzenleme ekleme yapabilelim").
   * Hoca / satışçı / tarih / açıklama Excel'deki gibi üstten devralınır: yazılı hücre değişince ona bağlı alttaki
   * satırlar da değişir; boş hücreye yazılınca o satırdan itibaren geçerli olur. Sipariş ya da teslim değişince borç
   * = sipariş − teslim olarak yeniden hesaplanır.
   */
  async function saveCell(r: CongressGivenProduct, field: Field, raw: string) {
    const isNum = field === 'ordered_quantity' || field === 'delivered_quantity' || field === 'owed_quantity'
    const value = isNum ? Math.max(0, Math.round(Number(raw.replace(',', '.')) || 0)) : raw.trim() || null
    if (field === 'doctor_name' && !value) return
    if (field === 'product_name' && !value) return
    const targets: CongressGivenProduct[] = [r]
    if (CARRY.includes(field)) {
      const idx = list.findIndex((x) => x.id === r.id)
      for (let j = idx + 1; j < list.length; j++) {
        const x = list[j]
        if (x.group_no !== r.group_no || (x[field] ?? null) !== (r[field] ?? null)) break
        if (field === 'description' && x.given_date !== r.given_date) break
        targets.push(x)
      }
    }
    try {
      for (const t of targets) {
        const patch: Partial<CongressGivenInput> = { [field]: value }
        if (field === 'ordered_quantity' || field === 'delivered_quantity') {
          const o = field === 'ordered_quantity' ? (value as number) : t.ordered_quantity
          const d = field === 'delivered_quantity' ? (value as number) : t.delivered_quantity
          patch.owed_quantity = Math.max(0, o - d)
        }
        await updateCongressGivenProduct(t.id, patch)
      }
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      void queryClient.invalidateQueries({ queryKey: KEY })
    }
  }

  /** Ekleme penceresi (kullanıcı isteği, 2026-11-27: "yeni hoca ekle yerine stoktaki ürünler ve hoca ismi gelsin"). */
  const [adding, setAdding] = React.useState<AddTarget | null>(null)

  function addBelow(r: CongressGivenProduct) {
    // Aynı hocanın aynı tarihli ürünlerinin sonuna eklenir
    let idx = list.findIndex((x) => x.id === r.id)
    while (list[idx + 1] && list[idx + 1].group_no === r.group_no && list[idx + 1].given_date === r.given_date) idx++
    const last = list[idx]
    setAdding({
      groupNo: r.group_no,
      doctor: r.doctor_name,
      rep: r.sales_rep_name ?? '',
      date: r.given_date ?? '',
      description: r.description ?? '',
      after: last.sort_order,
      before: list[idx + 1]?.sort_order ?? null,
    })
  }

  function addDoctor() {
    const last = list[list.length - 1]
    setAdding({
      groupNo: list.reduce((m, x) => Math.max(m, x.group_no ?? 0), 0) + 1,
      doctor: '',
      rep: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: last?.description ?? '',
      after: last?.sort_order ?? 0,
      before: null,
      newDoctor: true,
    })
  }

  const cell = (r: CongressGivenProduct, field: Field, shown: boolean, opts: { type?: 'text' | 'number' | 'date'; className?: string; display?: React.ReactNode; placeholder?: string } = {}) => (
    <EditCell
      key={field}
      value={r[field] == null ? '' : String(r[field])}
      type={opts.type}
      className={opts.className}
      placeholder={opts.placeholder}
      autoEdit={focusId === `${r.id}:${field}`}
      onDone={() => setFocusId(null)}
      onSave={(v) => saveCell(r, field, v)}
    >
      {shown ? (opts.display ?? r[field]) : ''}
    </EditCell>
  )

  const sum = (k: 'ordered_quantity' | 'delivered_quantity' | 'owed_quantity' | 'stock_deducted_quantity') =>
    list.reduce((s, r) => s + r[k], 0)
  const doctors = new Set(list.map((r) => r.doctor_name.toLocaleLowerCase('tr-TR'))).size

  /** Hoca şeridindeki toplamlar — aynı grup (No, yoksa hoca adı) */
  const groupStats = (r: CongressGivenProduct) => {
    const same = list.filter((x) => (r.group_no != null ? x.group_no === r.group_no : x.doctor_name === r.doctor_name))
    const dates = [...new Set(same.map((x) => x.given_date).filter(Boolean) as string[])].map(fmtDate)
    return {
      ordered: same.reduce((n, x) => n + x.ordered_quantity, 0),
      delivered: same.reduce((n, x) => n + x.delivered_quantity, 0),
      owed: same.reduce((n, x) => n + x.owed_quantity, 0),
      reps: [...new Set(same.map((x) => x.sales_rep_name).filter(Boolean) as string[])],
      dates: dates.length > 2 ? `${dates[0]} – ${dates[dates.length - 1]}` : dates.join(', '),
      last: same[same.length - 1],
    }
  }

  // Excel'deki düzen: hoca/tarih/açıklama yalnız ilk satırda, hocalar arasında boş ayırıcı satır
  const view: ViewRow[] = []
  let gi = -1
  list.forEach((r, i) => {
    const prev = list[i - 1]
    const newGroup = !prev || (r.group_no != null ? prev.group_no !== r.group_no : prev.doctor_name !== r.doctor_name)
    const first = newGroup || prev.given_date !== r.given_date
    const showName = newGroup || prev.doctor_name !== r.doctor_name
    const showRep = newGroup || (prev.sales_rep_name ?? '') !== (r.sales_rep_name ?? '')
    if (newGroup) gi++
    if (newGroup && i > 0) view.push({ sep: true })
    view.push({ r, first, newGroup, showName, showRep, gi })
  })
  const x = (v: ViewRow, f: (r: CongressGivenProduct) => string | number) => (v.r ? f(v.r) : '')
  const columns: ExportColumn<ViewRow>[] = [
    { header: 'NO', value: (v) => x(v, (r) => (v.newGroup ? r.group_no ?? '' : '')) },
    { header: 'TARİH', value: (v) => x(v, (r) => (v.first ? fmtDate(r.given_date) : '')) },
    { header: 'AÇIKLAMA', value: (v) => x(v, (r) => (v.first ? r.description ?? '' : '')) },
    { header: 'ADI SOYADI', value: (v) => x(v, (r) => (v.showName ? r.doctor_name : '')) },
    { header: 'SATIŞÇISI', value: (v) => x(v, (r) => (v.showRep ? r.sales_rep_name ?? '' : '')) },
    { header: 'ÜRÜNLER', value: (v) => x(v, (r) => r.product_name) },
    { header: 'SİPARİŞ', value: (v) => x(v, (r) => r.ordered_quantity) },
    { header: 'TESLİM EDİLEN', value: (v) => x(v, (r) => r.delivered_quantity) },
    { header: 'BORÇ ÜRÜN', value: (v) => x(v, (r) => r.owed_quantity) },
    { header: 'NOT', value: (v) => x(v, (r) => r.note ?? '') },
    { header: 'STOKTAN DÜŞÜLEN', value: (v) => x(v, (r) => r.stock_deducted_quantity) },
  ]

  if (isLoading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  if (error)
    return (
      <p className="py-6 text-sm text-destructive">
        Kongre ürünleri yüklenemedi: {getErrorMessage(error)}
      </p>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {congresses.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-border',
              c === current ? 'bg-primary text-primary-foreground ring-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet /> Excel'den yükle
          </Button>
          {current && (
            <>
              <Button onClick={deductAll} disabled={!waiting.length || busy != null}>
                {busy === 'all' ? <Loader2 className="animate-spin" /> : <PackageMinus />}
                Tümünü stoktan düş{waiting.length ? ` (${waiting.reduce((s, r) => s + pendingDeduct(r), 0)})` : ''}
              </Button>
              <Button variant="outline" className="text-destructive" onClick={removeAll} disabled={busy != null}>
                {busy === 'del' ? <Loader2 className="animate-spin" /> : <Trash2 />} Tümünü sil
              </Button>
              <ExportMenu title={`${current} Borç Listesi`.toLocaleUpperCase('tr-TR')} filename={`${current} borç listesi`} columns={columns} rows={view} />
            </>
          )}
        </div>
      </div>

      {!current ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Gift className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Henüz kongre ürün listesi yok. Kongrede hocalara verilen ürünlerin Excel listesini yükleyin; kayıt stoğu değiştirmez,
              stoktan düşmeyi sonra siz yaparsınız.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setImportOpen(true)}>
                <Upload /> Excel'den yükle
              </Button>
              <Button variant="outline" onClick={addDoctor}>
                <Plus /> Yeni hoca ekle
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-center">
            <h2 className="text-xl font-bold tracking-wide text-primary">{`${current} Borç Listesi`.toLocaleUpperCase('tr-TR')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {doctors} hoca · {list.length} ürün satırı · hücreye tıklayıp düzenleyebilirsiniz
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ['Hoca', doctors, Users, 'bg-primary/10 text-primary'],
                ['Sipariş', sum('ordered_quantity'), ShoppingBag, 'bg-sky-500/10 text-sky-600 dark:text-sky-400'],
                ['Teslim edilen', sum('delivered_quantity'), PackageCheck, 'bg-success/10 text-success'],
                ['Borç ürün', sum('owed_quantity'), AlertTriangle, 'bg-destructive/10 text-destructive'],
                ['Stoktan düşülen', sum('stock_deducted_quantity'), PackageMinus, 'bg-amber-500/10 text-amber-600 dark:text-amber-400'],
              ] as const
            ).map(([label, n, Icon, tone]) => (
              <Card key={label} className="py-0">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
                    <div className={cn('text-xl font-bold tabular-nums', label === 'Borç ürün' && n > 0 && 'text-destructive')}>{n}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden py-0 shadow-md">
            {/* Listenin kendi dikey kaydırma çubuğu, başlık üstte sabit (kullanıcı isteği, 2026-11-27: "listede kaydırma çubuğu yok").
                Her hoca kendi şeridiyle bir blok (kullanıcı isteği, 2026-11-27: "daha güzel, kaliteli olmalı") */}
            <div className="max-h-[calc(100vh-16rem)] min-h-64 overflow-y-auto">
              <table className={cn('w-full table-fixed border-separate border-spacing-0', PREMIUM_GRID)}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[12%] pl-5! sm:w-[9%]">TARİH</TableHead>
                    <TableHead>ÜRÜNLER</TableHead>
                    <TableHead className="hidden w-[10%] md:table-cell">SATIŞÇISI</TableHead>
                    <TableHead className="w-[11%] text-center sm:w-[8%]">SİPARİŞ</TableHead>
                    <TableHead className="w-[11%] text-center sm:w-[8%]">TESLİM EDİLEN</TableHead>
                    <TableHead className="w-[11%] text-center sm:w-[8%]">BORÇ ÜRÜN</TableHead>
                    <TableHead className="hidden w-[9%] sm:table-cell">NOT</TableHead>
                    <TableHead className="w-[16%] px-2! text-center sm:w-[11%]">STOK</TableHead>
                    <TableHead className="w-[12%] sm:w-[7%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.map((v) => {
                    if (!v.r) return null
                    const r = v.r
                    const left = pendingDeduct(r)
                    const owed = r.owed_quantity > 0
                    const num = 'text-center tabular-nums'
                    const g = v.newGroup ? groupStats(r) : null
                    return (
                      <React.Fragment key={r.id}>
                        {g && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={9} className={cn('h-14! overflow-visible! border-b-primary/15! bg-gradient-to-r from-primary/[0.07] via-primary/[0.03] to-transparent px-4!', v.gi > 0 && 'border-t-[6px]! border-t-background!')}>
                              <div className="flex items-center gap-3">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm tabular-nums">
                                  {r.group_no ?? '•'}
                                </span>
                                <div className="min-w-0">
                                  <InlineEdit
                                    value={r.doctor_name}
                                    placeholder="Hoca adı"
                                    autoEdit={focusId === `${r.id}:doctor_name`}
                                    onDone={() => setFocusId(null)}
                                    onSave={(val) => saveCell(r, 'doctor_name', val)}
                                    className="text-base font-bold text-foreground"
                                  />
                                  <div className="truncate text-xs text-muted-foreground">
                                    {[g.reps.join(', '), g.dates, r.description].filter(Boolean).join(' · ')}
                                  </div>
                                </div>
                                <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
                                  <Stat label="Sipariş" value={g.ordered} />
                                  <Stat label="Teslim" value={g.delivered} tone="success" />
                                  <Stat label="Borç" value={g.owed} tone={g.owed ? 'danger' : undefined} />
                                  <Button size="sm" variant="ghost" className="h-8 text-primary" onClick={() => addBelow(g.last)}>
                                    <Plus /> Ürün ekle
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow
                          className={cn(
                            'group/row transition-colors hover:bg-primary/[0.035]',
                            owed && 'bg-destructive/[0.045] hover:bg-destructive/[0.07] [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-destructive)]',
                          )}
                        >
                          {cell(r, 'given_date', v.first, {
                            type: 'date',
                            className: 'pl-5! tabular-nums text-muted-foreground',
                            display: <span title={r.description ?? undefined}>{fmtDate(r.given_date)}</span>,
                          })}
                          {cell(r, 'product_name', true, {
                            className: cn('font-semibold', owed && 'text-destructive'),
                            placeholder: 'Ürün yazın',
                            display: (
                              <>
                                {r.product_name || <span className="font-normal text-muted-foreground">Ürün yazın</span>}
                                {r.note && <span className="ml-1 text-xs font-normal sm:hidden">· {r.note}</span>}
                              </>
                            ),
                          })}
                          {cell(r, 'sales_rep_name', v.showRep && !v.newGroup, {
                            className: 'hidden md:table-cell',
                            display: r.sales_rep_name && (
                              <span className="inline-flex max-w-full truncate rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{r.sales_rep_name}</span>
                            ),
                          })}
                          {cell(r, 'ordered_quantity', true, { type: 'number', className: cn(num, 'font-medium') })}
                          {cell(r, 'delivered_quantity', true, { type: 'number', className: cn(num, 'font-medium', r.delivered_quantity > 0 ? 'text-success' : 'text-muted-foreground/70') })}
                          {cell(r, 'owed_quantity', true, {
                            type: 'number',
                            className: num,
                            display: owed ? (
                              <span className="inline-flex min-w-7 justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white shadow-sm tabular-nums">{r.owed_quantity}</span>
                            ) : (
                              <span className="text-muted-foreground/70">0</span>
                            ),
                          })}
                          {cell(r, 'note', true, {
                            className: 'hidden px-2! sm:table-cell',
                            display: r.note && (
                              <span className={cn('inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-xs font-semibold', /borç/i.test(r.note) ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
                                {r.note.toLocaleUpperCase('tr-TR')}
                              </span>
                            ),
                          })}
                          <TableCell className="px-2! text-center">
                            {left > 0 ? (
                              <Button size="sm" variant="outline" className="h-7 gap-1 rounded-full px-2.5 text-xs shadow-none [&_svg]:size-3.5" disabled={busy != null} onClick={() => deductOne(r)}>
                                {busy === r.id ? <Loader2 className="animate-spin" /> : <PackageMinus />}
                                Düş ({left})
                              </Button>
                            ) : r.stock_deducted_quantity > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                                <CheckCircle2 className="size-3.5" /> Düşüldü
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-1!">
                            <div className="flex justify-end opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                              <Button size="icon" variant="ghost" className="size-7" title="Bu hocaya ürün ekle" onClick={() => addBelow(r)}>
                                <Plus className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7 text-destructive" title="Sil" onClick={() => remove(r)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-3 py-2">
              <Button size="sm" variant="outline" onClick={addDoctor}>
                <Plus /> Yeni hoca ekle
              </Button>
              <span className="text-xs text-muted-foreground">Hücreye tıklayıp düzenleyin; Enter kaydeder, Esc vazgeçer.</span>
            </div>
          </Card>
        </>
      )}

      <GivenImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        products={products}
        existing={rows}
        defaultCongress={current ?? 'Mısır Kongresi'}
        onDone={(name) => {
          setActive(name)
          refresh()
        }}
      />
            <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stoktaki ürünü seçin</DialogTitle>
            <DialogDescription>
              “{pick?.product_name}” stokta bir ürünle eşleşmedi. Hangi üründen düşüleceğini seçin; seçim bu satıra kaydedilir.
            </DialogDescription>
          </DialogHeader>
          <ProductCombobox
            value={undefined}
            placeholder="Ürün seçin..."
            onChange={(p) => {
              const r = pick
              setPick(null)
              if (r) void deductOne(r, p)
            }}
          />
        </DialogContent>
      </Dialog>
      {adding && (
        <GivenAddDialog
          target={adding}
          congress={current ?? 'Mısır Kongresi'}
          existing={list}
          onClose={() => setAdding(null)}
          onSaved={() => {
            if (!current) setActive('Mısır Kongresi')
            void queryClient.invalidateQueries({ queryKey: KEY })
          }}
        />
      )}
      {dialog}
    </div>
  )
}

interface AddTarget {
  groupNo: number | null
  doctor: string
  rep: string
  date: string
  description: string
  /** Yeni satırlar bu iki sort_order arasına yerleşir */
  after: number
  before: number | null
  newDoctor?: boolean
}

type AddLine = { product?: Product; ordered: string; delivered: string }

function GivenAddDialog({
  target,
  congress,
  existing,
  onClose,
  onSaved,
}: {
  target: AddTarget
  congress: string
  existing: CongressGivenProduct[]
  onClose: () => void
  onSaved: () => void
}) {
  const { data: customers = [] } = useCustomers('')
  const { data: reps = [] } = useSalesReps()
  const [doctor, setDoctor] = React.useState(target.doctor)
  const [rep, setRep] = React.useState(target.rep)
  const [date, setDate] = React.useState(target.date)
  const [description, setDescription] = React.useState(target.description)
  const [lines, setLines] = React.useState<AddLine[]>([{ ordered: '1', delivered: '0' }])
  const [saving, setSaving] = React.useState(false)

  const doctorNames = [...new Set([...existing.map((r) => r.doctor_name), ...customers.map((c) => c.full_name)])].filter(Boolean)
  const repNames = [...new Set([...reps.filter((r) => r.is_active).map((r) => r.name), ...existing.map((r) => r.sales_rep_name ?? '')])].filter(Boolean)
  const setLine = (i: number, patch: Partial<AddLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const ready = lines.filter((l) => l.product)

  async function save() {
    const name = doctor.trim()
    if (!name) {
      toast.error('Hoca adını yazın')
      return
    }
    if (!ready.length) {
      toast.error('Stoktan en az bir ürün seçin')
      return
    }
    setSaving(true)
    const fold = (t: string) => t.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()
    const customer = customers.find((c) => fold(c.full_name) === fold(name))
    const gap = (target.before ?? target.after + ready.length + 1) - target.after
    let ok = 0
    try {
      for (const [k, l] of ready.entries()) {
        const ordered = Math.max(0, Math.round(Number(l.ordered) || 0))
        const delivered = Math.max(0, Math.round(Number(l.delivered) || 0))
        await createCongressGivenProduct({
          congress_name: congress,
          group_no: target.groupNo,
          given_date: date || null,
          description: description.trim() || null,
          doctor_name: name,
          sales_rep_name: rep.trim() || null,
          customer_id: customer?.id ?? null,
          product_name: l.product!.name,
          product_id: l.product!.id,
          ordered_quantity: ordered,
          delivered_quantity: delivered,
          owed_quantity: Math.max(0, ordered - delivered),
          note: null,
          sort_order: target.after + (gap * (k + 1)) / (ready.length + 1),
        })
        ok++
      }
      toast.success(`${ok} ürün ${name} için eklendi`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(ok ? `${ok} ürün eklendi, kalanlar eklenemedi` : 'Eklenemedi', { description: getErrorMessage(err) })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{target.newDoctor ? 'Yeni hoca ekle' : `${target.doctor} — ürün ekle`}</DialogTitle>
          <DialogDescription>Hocayı Cari Kart'tan, ürünleri stoktan seçin. Kayıt stoğu değiştirmez.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Hoca adı</span>
            <Input list="given-doctors" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Yazmaya başlayın…" autoFocus={target.newDoctor} />
            <datalist id="given-doctors">
              {doctorNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Satışçısı</span>
            <Input list="given-reps" value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Ör. AHSEN" />
            <datalist id="given-reps">
              {repNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Tarih</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Açıklama</span>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="KAYIT KONAKLAMA ULAŞIM" />
          </label>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem_2rem] gap-2 text-xs font-semibold text-muted-foreground">
            <span>ÜRÜN (stoktan)</span>
            <span className="text-center">SİPARİŞ</span>
            <span className="text-center">TESLİM</span>
            <span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem_2rem] items-center gap-2">
              <ProductCombobox value={l.product?.id} placeholder="Stoktan ürün seçin..." onChange={(p) => setLine(i, { product: p })} />
              <Input type="number" min={0} className="text-center" value={l.ordered} onChange={(e) => setLine(i, { ordered: e.target.value })} />
              <Input type="number" min={0} className="text-center" value={l.delivered} onChange={(e) => setLine(i, { delivered: e.target.value })} />
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-destructive"
                title="Satırı kaldır"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setLines((ls) => [...ls, { ordered: '1', delivered: '0' }])}>
            <Plus /> Ürün satırı ekle
          </Button>
          <p className="text-xs text-muted-foreground">Borç = sipariş − teslim olarak hesaplanır.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} {ready.length ? `${ready.length} ürünü ekle` : 'Ekle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GivenImportDialog({
  open,
  onOpenChange,
  products,
  existing,
  defaultCongress,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  products: Product[]
  existing: CongressGivenProduct[]
  defaultCongress: string
  onDone: (congress: string) => void
}) {
  const [name, setName] = React.useState(defaultCongress)
  const [lines, setLines] = React.useState<GivenLine[] | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [replace, setReplace] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(defaultCongress)
      setLines(null)
      setFileName('')
      setReplace(true)
    }
  }, [open, defaultCongress])

  async function onFile(f: File | undefined) {
    if (!f) return
    try {
      const parsed = parseCongressGivenExcel(await readWorkbookMatrices(f), products)
      if (!parsed.length) {
        toast.error('Listede ürün satırı bulunamadı', { description: 'Başlık satırında “ADI SOYADI” ve “ÜRÜNLER” sütunları olmalı.' })
        return
      }
      setFileName(f.name)
      setLines(parsed)
    } catch (err) {
      toast.error('Excel okunamadı', { description: getErrorMessage(err) })
    }
  }

  const previous = existing.filter((r) => r.congress_name === name.trim())
  const checks = lines?.filter((l) => l.check).length ?? 0
  const unmatched = lines?.filter((l) => !l.product).length ?? 0

  async function save() {
    if (!lines) return
    const congress = name.trim()
    if (!congress) {
      toast.error('Kongre adını yazın')
      return
    }
    if (replace && previous.some((r) => r.stock_deducted_quantity > 0)) {
      toast.error('Bu kongrenin eski listesinde stoktan düşülmüş satırlar var', {
        description: 'Önceki listeyi değiştir seçeneğini kaldırın ya da kongre adını farklı yazın; düşülmüş kayıtlar silinmez.',
      })
      return
    }
    setBusy(true)
    let ok = 0
    try {
      if (replace) for (const r of previous) await deleteCongressGivenProduct(r.id)
      const base = replace ? 0 : previous.reduce((m, r) => Math.max(m, r.sort_order + 1), 0)
      for (const [i, l] of lines.entries()) {
        await createCongressGivenProduct({
          congress_name: congress,
          group_no: l.groupNo,
          given_date: l.date,
          description: l.description,
          doctor_name: l.doctor,
          sales_rep_name: l.rep,
          customer_id: null,
          product_name: l.productText,
          product_id: l.product?.id ?? null,
          ordered_quantity: l.ordered,
          delivered_quantity: l.delivered,
          owed_quantity: l.owed,
          note: l.note,
          sort_order: base + i,
        })
        ok++
      }
      toast.success(`${ok} satır “${congress}” listesine eklendi`, { description: 'Stok değişmedi; düşmek için “Stoktan düş”ü kullanın.' })
      onDone(congress)
      onOpenChange(false)
    } catch (err) {
      toast.error(ok ? `${ok} satır eklendi, kalanlar eklenemedi` : 'Eklenemedi', { description: getErrorMessage(err) })
      onDone(congress)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Kongre ürün listesini Excel'den yükle</DialogTitle>
          <DialogDescription>
            Excel'deki satırlar olduğu gibi aktarılır: No, Tarih, Açıklama, Adı Soyadı, Satışçısı, Ürünler, Sipariş, Teslim Edilen, Borç Ürün, Not. Stok
            değişmez.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Kongre adı</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mısır Kongresi" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Excel dosyası</span>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
        {previous.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            “{name.trim()}” için programdaki önceki listeyi ({previous.length} satır) sil, yerine bu dosyayı koy
          </label>
        )}
        {lines && (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <span>
                <b>{fileName}</b>: {lines.length} ürün satırı, {new Set(lines.map((l) => l.doctor)).size} hoca
              </span>
              {checks > 0 && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-4" /> {checks} satırda boş adet hücresi var, kontrol edin
                </span>
              )}
              {unmatched > 0 && <span className="text-muted-foreground">{unmatched} ürün stokta tanınmadı (düşerken seçilir)</span>}
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              <Table className={cn(PREMIUM_TABLE, 'table-fixed text-xs')}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden w-8 md:table-cell">No</TableHead>
                    <TableHead className="hidden w-20 md:table-cell">Tarih</TableHead>
                    <TableHead className="hidden lg:table-cell">Açıklama</TableHead>
                    <TableHead>Adı Soyadı</TableHead>
                    <TableHead className="hidden w-20 md:table-cell">Satışçısı</TableHead>
                    <TableHead>Ürünler</TableHead>
                    <TableHead className="w-12 text-center">Sip.</TableHead>
                    <TableHead className="w-12 text-center">Tes.</TableHead>
                    <TableHead className="w-12 text-center">Borç</TableHead>
                    <TableHead className="hidden sm:table-cell">Not / Kontrol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i} className={cn(l.check && 'bg-warning/10')}>
                      <TableCell className="hidden md:table-cell">{l.groupNo ?? ''}</TableCell>
                      <TableCell className="hidden md:table-cell">{fmtDate(l.date)}</TableCell>
                      <TableCell className="hidden whitespace-normal lg:table-cell">{l.description}</TableCell>
                      <TableCell className="whitespace-normal">{l.doctor}</TableCell>
                      <TableCell className="hidden md:table-cell">{l.rep}</TableCell>
                      <TableCell className="whitespace-normal">
                        {l.productText}
                        {!l.product && <span className="ml-1 text-muted-foreground">(stokta yok)</span>}
                      </TableCell>
                      <TableCell className="text-center">{l.ordered}</TableCell>
                      <TableCell className="text-center">{l.delivered}</TableCell>
                      <TableCell className={cn('text-center', l.owed > 0 && 'font-bold text-destructive')}>{l.owed}</TableCell>
                      <TableCell className="hidden whitespace-normal sm:table-cell">
                        {l.note}
                        {l.check && <div className="text-warning">{l.check}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={!lines || busy}>
            {busy && <Loader2 className="animate-spin" />} {lines ? `${lines.length} satırı kaydet` : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Tıklayınca düzenlenen tablo hücresi — Enter / dışarı tıklama kaydeder, Esc vazgeçer. */
function EditCell({
  value,
  type = 'text',
  className,
  placeholder,
  autoEdit,
  onDone,
  onSave,
  children,
}: {
  value: string
  type?: 'text' | 'number' | 'date'
  className?: string
  placeholder?: string
  autoEdit?: boolean
  onDone?: () => void
  onSave: (v: string) => void
  children: React.ReactNode
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const open = editing || !!autoEdit
  const start = () => {
    setDraft(value)
    setEditing(true)
  }
  const finish = (save: boolean) => {
    setEditing(false)
    onDone?.()
    if (save && draft !== value) onSave(draft)
  }
  return (
    <TableCell
      className={cn('cursor-text hover:bg-primary/[0.06]', open && 'p-0!', className)}
      title={type === 'text' && value ? value : undefined}
      onClick={() => !open && start()}
    >
      {open ? (
        <input
          autoFocus
          type={type}
          min={type === 'number' ? 0 : undefined}
          value={editing ? draft : value}
          placeholder={placeholder}
          onFocus={(e) => {
            if (!editing) start()
            if (type !== 'date') e.currentTarget.select()
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.preventDefault()
              finish(false)
            }
          }}
          className={cn(
            'h-10 w-full min-w-0 bg-background px-3 text-sm font-normal text-foreground ring-2 ring-primary outline-none ring-inset',
            type === 'number' && 'text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          )}
        />
      ) : (
        children
      )}
    </TableCell>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-xs',
        tone === 'danger' && 'border-destructive/30 bg-destructive/5 text-destructive',
        tone === 'success' && 'text-success',
      )}
    >
      {label}
      <b className="text-sm tabular-nums">{value}</b>
    </span>
  )
}

/** Hoca şeridindeki adı tıklayınca düzenleme — Enter / dışarı tıklama kaydeder, Esc vazgeçer. */
function InlineEdit({
  value,
  placeholder,
  autoEdit,
  onDone,
  onSave,
  className,
}: {
  value: string
  placeholder?: string
  autoEdit?: boolean
  onDone?: () => void
  onSave: (v: string) => void
  className?: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const open = editing || !!autoEdit
  const finish = (save: boolean) => {
    setEditing(false)
    onDone?.()
    if (save && draft.trim() && draft !== value) onSave(draft)
  }
  if (open)
    return (
      <input
        autoFocus
        value={editing ? draft : value}
        placeholder={placeholder}
        onFocus={(e) => {
          if (!editing) {
            setDraft(value)
            setEditing(true)
          }
          e.currentTarget.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.preventDefault()
            finish(false)
          }
        }}
        className={cn('h-7 w-64 max-w-full rounded-md bg-background px-2 ring-2 ring-primary outline-none', className)}
      />
    )
  return (
    <button
      type="button"
      title="Hoca adını düzenlemek için tıklayın"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={cn('block max-w-full truncate rounded-md text-left hover:text-primary', className)}
    >
      {value || <span className="font-normal text-muted-foreground">{placeholder}</span>}
    </button>
  )
}
