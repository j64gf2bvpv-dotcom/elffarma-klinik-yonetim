import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Gift, Loader2, PackageMinus, Pencil, Trash2, Upload } from 'lucide-react'
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
} from './api'
import { matchGiven, parseCongressGivenExcel, type GivenLine } from './importExcel'

/**
 * Kongrede hocalara verilen ürünler (kullanıcı isteği, 2026-11-27: "Mısır kongresi için hocalara verdiğimiz ürünlerin
 * listesi var Excel olarak, programa ayrı bir sütuna işle, o formatta olsun"; "sadece kayıt tutulsun, stoktan düş tuşu
 * da olsun sonradan düşebilelim"). Tablo kullanıcının Excel'iyle aynı sütunlarda: No | Tarih | Açıklama | Adı Soyadı |
 * Ürünler | Sipariş | Teslim Edilen | Borç Ürün | Not. Kayıt stoğu değiştirmez; düşme satır satır ya da toplu yapılır.
 */

const KEY = ['congress_given_products']
const fmtDate = (d: string | null) => (d ? format(new Date(`${d}T00:00:00`), 'd.MM.yyyy') : '')

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
  const [edit, setEdit] = React.useState<CongressGivenProduct | null>(null)
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

  const sum = (k: 'ordered_quantity' | 'delivered_quantity' | 'owed_quantity' | 'stock_deducted_quantity') =>
    list.reduce((s, r) => s + r[k], 0)
  const doctors = new Set(list.map((r) => r.doctor_name.toLocaleLowerCase('tr-TR'))).size

  const columns: ExportColumn<CongressGivenProduct>[] = [
    { header: 'No', value: (r) => r.group_no ?? '' },
    { header: 'Tarih', value: (r) => fmtDate(r.given_date) },
    { header: 'Açıklama', value: (r) => r.description ?? '' },
    { header: 'Adı Soyadı', value: (r) => r.doctor_name },
    { header: 'Ürünler', value: (r) => r.product_name },
    { header: 'Sipariş', value: (r) => r.ordered_quantity },
    { header: 'Teslim Edilen', value: (r) => r.delivered_quantity },
    { header: 'Borç Ürün', value: (r) => r.owed_quantity },
    { header: 'Not', value: (r) => r.note ?? '' },
    { header: 'Stoktan Düşülen', value: (r) => r.stock_deducted_quantity },
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
              <ExportMenu title={`${current} — Hocalara Verilen Ürünler`} filename={`${current} hocalara verilen ürünler`} columns={columns} rows={list} />
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
            <Button onClick={() => setImportOpen(true)}>
              <Upload /> Excel'den yükle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Hoca', doctors],
              ['Sipariş', sum('ordered_quantity')],
              ['Teslim edilen', sum('delivered_quantity')],
              ['Borç ürün', sum('owed_quantity')],
              ['Stoktan düşülen', sum('stock_deducted_quantity')],
            ].map(([label, n]) => (
              <Card key={label} className="py-0">
                <CardContent className="px-3 py-2.5">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className={cn('text-lg font-semibold tabular-nums', label === 'Borç ürün' && Number(n) > 0 && 'text-destructive')}>{n}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="py-0">
            <Table className={cn(PREMIUM_TABLE, 'table-fixed')}>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-10 md:table-cell">No</TableHead>
                  <TableHead className="hidden w-24 md:table-cell">Tarih</TableHead>
                  <TableHead className="hidden w-[13%] lg:table-cell">Açıklama</TableHead>
                  <TableHead className="w-[20%]">Adı Soyadı</TableHead>
                  <TableHead>Ürünler</TableHead>
                  <TableHead className="w-14 text-center sm:w-18">Sipariş</TableHead>
                  <TableHead className="w-14 text-center sm:w-18">Teslim Edilen</TableHead>
                  <TableHead className="w-14 text-center sm:w-18">Borç Ürün</TableHead>
                  <TableHead className="hidden w-[10%] sm:table-cell">Not</TableHead>
                  <TableHead className="w-24 sm:w-32">Stok</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r, i) => {
                  const prev = list[i - 1]
                  const first = !prev || prev.doctor_name !== r.doctor_name || prev.given_date !== r.given_date || prev.group_no !== r.group_no
                  const newGroup = !prev || prev.group_no !== r.group_no || prev.doctor_name !== r.doctor_name
                  const left = pendingDeduct(r)
                  return (
                    <TableRow key={r.id} className={cn(newGroup && i > 0 && '[&>td]:border-t-2 [&>td]:border-t-border')}>
                      <TableCell className="hidden align-top font-medium tabular-nums md:table-cell">{newGroup ? r.group_no ?? '' : ''}</TableCell>
                      <TableCell className="hidden align-top tabular-nums md:table-cell">{first ? fmtDate(r.given_date) : ''}</TableCell>
                      <TableCell className="hidden align-top text-xs whitespace-normal text-muted-foreground lg:table-cell">{first ? r.description : ''}</TableCell>
                      <TableCell className="align-top font-medium break-words whitespace-normal">
                        {first ? (
                          <>
                            {r.doctor_name}
                            {r.given_date && <div className="text-xs font-normal text-muted-foreground md:hidden">{fmtDate(r.given_date)}</div>}
                          </>
                        ) : (
                          ''
                        )}
                      </TableCell>
                      <TableCell className={cn('break-words whitespace-normal', r.owed_quantity > 0 && 'bg-warning/15 font-semibold text-destructive')}>
                        {r.product_name}
                        {r.note && <div className="text-xs font-normal text-muted-foreground sm:hidden">{r.note}</div>}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{r.ordered_quantity}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.delivered_quantity}</TableCell>
                      <TableCell className={cn('text-center tabular-nums', r.owed_quantity > 0 && 'bg-warning/15 font-bold text-destructive')}>
                        {r.owed_quantity}
                      </TableCell>
                      <TableCell className="hidden text-xs whitespace-normal sm:table-cell">{r.note}</TableCell>
                      <TableCell className="whitespace-normal">
                        {left > 0 ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy != null} onClick={() => deductOne(r)}>
                            {busy === r.id ? <Loader2 className="animate-spin" /> : <PackageMinus />}
                            Düş ({left})
                          </Button>
                        ) : r.stock_deducted_quantity > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="size-3.5" /> Düşüldü
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {r.stock_deducted_quantity > 0 && left > 0 && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{r.stock_deducted_quantity} düşüldü</div>
                        )}
                      </TableCell>
                      <TableCell className="px-1">
                        <div className="flex justify-end">
                          <Button size="icon" variant="ghost" className="size-7" title="Düzenle" onClick={() => setEdit(r)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7 text-destructive" title="Sil" onClick={() => remove(r)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
      {edit && <GivenEditDialog row={edit} onClose={() => setEdit(null)} onSaved={refresh} />}
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
      {dialog}
    </div>
  )
}

function GivenEditDialog({ row, onClose, onSaved }: { row: CongressGivenProduct; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState({
    doctor_name: row.doctor_name,
    product_name: row.product_name,
    ordered_quantity: String(row.ordered_quantity),
    delivered_quantity: String(row.delivered_quantity),
    owed_quantity: String(row.owed_quantity),
    note: row.note ?? '',
  })
  const [saving, setSaving] = React.useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  async function save() {
    setSaving(true)
    try {
      await updateCongressGivenProduct(row.id, {
        doctor_name: v.doctor_name.trim() || row.doctor_name,
        product_name: v.product_name.trim() || row.product_name,
        ordered_quantity: Math.max(0, Number(v.ordered_quantity) || 0),
        delivered_quantity: Math.max(0, Number(v.delivered_quantity) || 0),
        owed_quantity: Math.max(0, Number(v.owed_quantity) || 0),
        note: v.note.trim() || null,
      })
      onSaved()
      onClose()
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }
  const field = (label: string, k: keyof typeof v, type = 'text') => (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input type={type} min={type === 'number' ? 0 : undefined} value={v[k]} onChange={set(k)} />
    </label>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kaydı düzenle</DialogTitle>
          <DialogDescription>Sonradan teslim edilenleri buradan güncelleyin; artan teslim adedi “Stoktan düş” ile düşülür.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {field('Adı Soyadı', 'doctor_name')}
          {field('Ürün', 'product_name')}
          <div className="grid grid-cols-3 gap-2">
            {field('Sipariş', 'ordered_quantity', 'number')}
            {field('Teslim Edilen', 'delivered_quantity', 'number')}
            {field('Borç Ürün', 'owed_quantity', 'number')}
          </div>
          {field('Not', 'note')}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Kaydet
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
            Excel'deki satırlar olduğu gibi aktarılır: No, Tarih, Açıklama, Adı Soyadı, Ürünler, Sipariş, Teslim Edilen, Borç Ürün, Not. Stok
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
