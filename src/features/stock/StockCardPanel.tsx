import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { toast } from 'sonner'
import { ImageDown, IdCard, ArrowLeftRight, Pencil, Trash2, PackageX, Loader2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { ProductMultiCombobox } from '@/features/stock/ProductMultiCombobox'
import { StockMovementDialog } from '@/features/stock/StockMovementDialog'
import { ResetAllStockDialog } from '@/features/stock/ResetAllStockDialog'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabaseClient'
import { useSales } from '@/features/sales/hooks'
import { useSampleRequests } from '@/features/samples/hooks'
import { useCustomers } from '@/features/customers/hooks'
import {
  useAllStockMovements,
  useDeactivateProduct,
  useDeleteStockMovement,
  useProducts,
  useUpdateStockMovement,
} from '@/features/stock/hooks'
import { tr } from '@/i18n/tr'
import { buildStockLedger, summarizeStockLedger, type StockCardRow } from './stockCardReport'
import { exportStockCardImage } from './exportStockCardImage'
import {
  importStockCardRows,
  STOCK_CARD_IMPORT_HEADERS,
  STOCK_CARD_IMPORT_SAMPLE_ROWS,
  STOCK_CARD_IMPORT_FIELD_HINTS,
} from './importStockCard'
import type { MovementType, Product } from '@/types/database'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

type ReportMode = 'single' | 'all'

const KIND_BADGE_VARIANT: Record<MovementType, 'success' | 'destructive' | 'warning'> = {
  in: 'success',
  return: 'success',
  adjustment: 'warning',
  sample: 'warning',
  out: 'destructive',
  disposal: 'destructive',
}

function formatDateTime(iso: string) {
  return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: trLocale })
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

/**
 * Hareket Dökümü'ndeki Giriş/Çıkış hücrelerine tıklayınca yerinde (inline)
 * düzenlenebilir — StockPage'deki stok adedi hücresiyle aynı desen. Değer 0
 * olsa (o satırda boş görünse) bile tıklanabilir kalır, çünkü boş taraf
 * üzerinden de yeni bir adet eklenebilmeli — bkz. handleInlineQtyChange.
 */
function InlineQtyCell({ value, unitLabel, onCommit }: { value: number; unitLabel?: string; onCommit: (next: number) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(value > 0 ? String(value) : '')

  React.useEffect(() => {
    if (!editing) setText(value > 0 ? String(value) : '')
  }, [value, editing])

  function commit() {
    setEditing(false)
    const next = Number(text)
    if (!Number.isFinite(next) || next <= 0 || Math.round(next) !== next) {
      setText(value > 0 ? String(value) : '')
      return
    }
    if (next !== value) onCommit(next)
  }

  if (editing) {
    return (
      <Input
        type="number"
        min="1"
        step="1"
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
            setText(value > 0 ? String(value) : '')
            setEditing(false)
          }
        }}
        className="h-7 w-16"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={value > 0 ? 'Adedi düzenlemek için tıklayın' : 'Eklemek için tıklayın'}
      className="min-w-6 rounded px-1 py-0.5 text-left hover:bg-accent"
    >
      {value > 0 ? (unitLabel ? `${value} ${unitLabel}` : value) : <span className="text-muted-foreground">—</span>}
    </button>
  )
}

/**
 * Tek ürün görünümündeki tüm hareket geçmişini kalıcı olarak siler (o
 * üründen başka HİÇBİR ürüne dokunmaz). stock_movements normalde hiç
 * silinmeyen bir denetim kaydı olduğu için bilerek sadece yöneticiye açık,
 * gerekçe zorunlu ve yazarak onay istiyor (bkz. StockPage'teki
 * ResetAllStockDialog ile aynı iki adımlı desen). Silme sonrası ürünün
 * paket/flakon stoğu 0'a çekilir — boş bir defterle tutarlı tek değer bu.
 */
/**
 * Bu ürüne ait TÜM geçmiş hareketleri kalıcı olarak siler — önceden gerekçe
 * girişi + ürün adını yazarak onaylama olmak üzere iki ayrı adımdı; kullanıcı
 * isteğiyle (2026-08-24 — "bu şekilde ekran hiçbirinde çıkmasın Sil veya
 * İptal Et çıkmalı") uygulamanın geri kalanındaki tek adımlı Vazgeç/Sil
 * deseniyle tutarlı olsun diye tek adıma indirildi. Gerekçe alanı kaldırılmadı
 * (RPC'nin kendisi denetim kaydı için zorunlu bir gerekçe istiyor), sadece
 * ekstra "ürün adını yazarak onayla" adımı kaldırıldı.
 */
function DeleteAllMovementsDialog({ product }: { product: Product }) {
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  if (staff?.role !== 'admin') return null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setReason('')
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('delete_all_stock_movements_for_product', {
        p_product_id: product.id,
        p_reason: reason.trim(),
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      toast.success(`${product.name} için ${data ?? 0} hareket kalıcı olarak silindi`)
      handleOpenChange(false)
    } catch (error) {
      toast.error('Silinemedi', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        title="Bu ürünün TÜM stok hareket geçmişini kalıcı olarak siler"
      >
        <Trash2 className="size-3.5" /> Tüm Hareketleri Sil
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name} — Tüm Hareketleri Sil</DialogTitle>
          <DialogDescription>
            Bu ürüne ait TÜM geçmiş giriş/çıkış hareketleri kalıcı olarak silinecek ve stok (paket + flakon) 0'a
            çekilecek. Bu işlem geri alınamaz.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="delete-all-reason">Gerekçe (zorunlu)</Label>
          <Textarea
            id="delete-all-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ör. hatalı toplu içe aktarma sonrası geçmişi temizleme..."
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            İptal Et
          </Button>
          <Button type="button" variant="destructive" disabled={!reason.trim() || submitting} onClick={handleConfirm}>
            {submitting && <Loader2 className="animate-spin" />}
            Sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Stok Kartı" — iki mod: Tek Ürün (seçilen ürünün kronolojik Giriş/Çıkış/
 * Güncel Stok defteri, doktor ve fiyat bilgisiyle) ve Tüm Ürünler (aynı döküm,
 * tek tabloda, ürün kolonuyla). İkisi de gerçek `stock_movements` denetim
 * kaydından kuruluyor (bkz. stockCardReport.ts) — yani her satırdaki "Güncel
 * Stok" o andaki gerçek stok bakiyesiyle birebir tutar. Elle Giriş/Çıkış/
 * Düzeltme kaydı "Hareket Dökümü" başlığındaki butondan girilebilir (Tek Ürün
 * modunda seçili ürüne kilitli, Tüm Ürünler modunda ürün seçici açılır).
 * Excel'den içe aktarılan geçmiş satış/numune kayıtları (bkz. importStockCard.ts)
 * bilinçli olarak gerçek stoğu değiştirmediği için bu deftere yansımaz.
 */
export function StockCardPanel() {
  const [mode, setMode] = React.useState<ReportMode>('single')
  const [productId, setProductId] = React.useState<string | undefined>(undefined)
  const [product, setProduct] = React.useState<Product | null>(null)
  const [allProductIds, setAllProductIds] = React.useState<string[]>([])
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null)

  const queryClient = useQueryClient()
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const { data: movements = [] } = useAllStockMovements()
  const { data: sales = [] } = useSales()
  const { data: sampleRequests = [] } = useSampleRequests()
  const { data: customers = [] } = useCustomers('')
  const { data: allProducts = [] } = useProducts('')
  const deleteMovementMutation = useDeleteStockMovement()
  const updateMovementMutation = useUpdateStockMovement()
  const deactivateProductMutation = useDeactivateProduct()

  const productById = React.useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts])
  // `product` seçim anındaki bir anlık görüntü (stale) — current_quantity/
  // flakon_quantity değişse bile güncellenmiyor. Stok miktarına duyarlı her
  // yerde (canlı stok gösterimi, yetersiz-stok kontrolü) bunun yerine bu
  // canlı sürüm kullanılmalı (QA'da bulundu, 2026-08-24).
  const liveProduct = product ? (productById.get(product.id) ?? product) : null
  const resetAffectedCount = allProducts.filter((p) => p.current_quantity > 0 || p.flakon_quantity > 0).length
  const productQuantities = React.useMemo(
    () =>
      new Map(
        allProducts.map((p) => [p.id, { current_quantity: p.current_quantity, flakon_quantity: p.flakon_quantity }]),
      ),
    [allProducts],
  )

  const { confirm, dialog } = useConfirmDialog()

  async function handleDeleteMovement(row: StockCardRow) {
    if (!(await confirm(`${formatDateTime(row.date)} tarihli hareket silinsin mi? Ürünün güncel stoğu buna göre geri alınır.`)))
      return
    deleteMovementMutation.mutate(row.id)
  }

  async function handleDeleteProduct(row: StockCardRow) {
    if (!(await confirm(`${row.productName} kaldırılsın mı? Ürün stok listesinden kaldırılır, geçmiş hareketler saklanır.`)))
      return
    deactivateProductMutation.mutate(row.productId)
    if (mode === 'single' && row.productId === productId) {
      setProductId(undefined)
      setProduct(null)
    }
  }

  /**
   * `side` tıklanan hücre (giriş/çıkış) — satırın mevcut yönüyle aynıysa
   * sadece miktar güncellenir, farklıysa (o taraf boşken tıklanıp yeni bir
   * adet girildiyse) hareketin türü de o tarafın genel karşılığına
   * ('in'/'out') çevrilir. Belirli bir tür (iade/numune/imha/düzeltme)
   * isteniyorsa kalem simgesindeki tam düzenleme diyaloğu kullanılmalı.
   */
  function handleInlineQtyChange(row: StockCardRow, side: 'in' | 'out', nextQty: number) {
    const rowIsInSide = row.inQty > 0
    const matchesCurrentSide = (side === 'in') === rowIsInSide
    updateMovementMutation.mutate({
      id: row.id,
      product_id: row.productId,
      movement_type: matchesCurrentSide ? row.kind : side,
      quantity: nextQty,
      reason: row.reason,
      note: row.note,
      lot_id: row.lotId,
      unit_price: row.unitPrice,
      unit_kind: row.unitKind,
    })
  }

  const singleRows = React.useMemo<StockCardRow[]>(
    () => (productId ? buildStockLedger(movements, productQuantities, productId) : []),
    [productId, movements, productQuantities],
  )

  const allRows = React.useMemo<StockCardRow[]>(
    () => buildStockLedger(movements, productQuantities),
    [movements, productQuantities],
  )
  const filteredAllRows = React.useMemo(() => {
    if (allProductIds.length === 0) return allRows
    const idSet = new Set(allProductIds)
    return allRows.filter((r) => idSet.has(r.productId))
  }, [allRows, allProductIds])

  const rows = mode === 'single' ? singleRows : filteredAllRows
  const summary = React.useMemo(() => summarizeStockLedger(rows), [rows])
  const showReport = mode === 'all' || !!product

  const summaryLine =
    mode === 'single'
      ? `${summary.inQty} giriş · ${summary.outQty} çıkış · Güncel Stok: ${summary.currentStock} Paket · ${summary.doctorCount} doktor`
      : `${summary.productCount} ürün · ${summary.inQty} giriş · ${summary.outQty} çıkış · Toplam Güncel Stok: ${summary.currentStock} · ${summary.doctorCount} doktor`

  async function handleImport(rawRows: Record<string, unknown>[]) {
    const result = await importStockCardRows(rawRows, allProducts, customers, sales, sampleRequests)
    if (result.added > 0) {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['sample_requests'] })
    }
    return result
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ReportMode)}>
          <TabsList>
            <TabsTrigger value="single">Tek Ürün</TabsTrigger>
            <TabsTrigger value="all">Tüm Ürünler</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <ImportMenu
              label="Eski Excel Listesini Yükle"
              onImport={handleImport}
              templateFilename="stok-karti-sablon"
              templateHeaders={STOCK_CARD_IMPORT_HEADERS}
              templateSampleRows={STOCK_CARD_IMPORT_SAMPLE_ROWS}
            />
            <SmartImportDialog
              title="Stok Kartını Akıllı İçe Aktar"
              targetLabel="stok kartı satış/numune"
              fieldHeaders={STOCK_CARD_IMPORT_HEADERS}
              fieldHints={STOCK_CARD_IMPORT_FIELD_HINTS}
              onImport={handleImport}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            İçe aktarılanlar satış/numune geçmişi olarak kaydedilir, bugünkü stoğu değiştirmez — aşağıdaki defterde görünmez
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          {mode === 'single' ? (
            <>
              <div className="max-w-sm flex-1">
                <ProductCombobox
                  value={productId}
                  onChange={(p) => {
                    setProductId(p.id)
                    setProduct(p)
                  }}
                  placeholder="Rapor için ürün seçin"
                />
              </div>
              {product && (
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <IdCard className="size-3.5" />
                  Kod: {product.sku ?? '—'} {product.barcode ? `· Barkod: ${product.barcode}` : ''} · Stokta:{' '}
                  {(liveProduct?.current_quantity ?? 0) > 0 ? `${liveProduct?.current_quantity} Paket` : '—'}
                </span>
              )}
            </>
          ) : (
            <div className="max-w-sm flex-1">
              <ProductMultiCombobox
                value={allProductIds}
                onChange={setAllProductIds}
                placeholder="Ürün seçin (boş = tümü)"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {showReport && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mode === 'all' && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Ürün Sayısı</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.productCount}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Giriş</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{summary.inQty}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Çıkış</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{summary.outQty}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {mode === 'single' ? 'Güncel Stok' : 'Toplam Güncel Stok'}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summary.currentStock > 0 ? summary.currentStock : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Doktor Sayısı</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.doctorCount}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Hareket Dökümü</h3>
            <div className="flex items-center gap-2">
              <StockMovementDialog
                product={mode === 'single' ? (liveProduct ?? undefined) : undefined}
                trigger={
                  <Button variant="outline" size="sm">
                    <ArrowLeftRight className="size-3.5" /> Giriş / Çıkış Ekle
                  </Button>
                }
              />
              {mode === 'single' && product && <DeleteAllMovementsDialog product={product} />}
              <ResetAllStockDialog affectedCount={resetAffectedCount} />
              <ExportMenu<StockCardRow>
                title={mode === 'single' ? `Stok Kartı — ${product?.name}` : 'Stok Kartı — Tüm Ürünler'}
                filename={mode === 'single' ? `stok-karti-${product?.sku ?? product?.name}` : 'stok-karti-tum-urunler'}
                rows={rows}
                columns={[
                  { header: 'Tarih', value: (r) => formatDateTime(r.date) },
                  ...(mode === 'all' ? [{ header: 'Ürün', value: (r: StockCardRow) => r.productName }] : []),
                  { header: 'Doktor', value: (r) => r.doctorName ?? '—' },
                  { header: 'Tür', value: (r) => tr.movementType[r.kind] },
                  { header: 'Fiyat', value: (r) => (r.unitPrice != null ? r.unitPrice : '') },
                  { header: 'Sebep / Not', value: (r) => r.reason ?? r.note ?? '' },
                  { header: 'Giriş', value: (r) => (r.inQty ? `${r.inQty} ${r.unitKind === 'flakon' ? 'Flakon' : 'Paket'}` : '') },
                  { header: 'Çıkış', value: (r) => (r.outQty ? `${r.outQty} ${r.unitKind === 'flakon' ? 'Flakon' : 'Paket'}` : '') },
                  {
                    header: 'Güncel Stok',
                    value: (r) =>
                      r.unitKind === 'flakon'
                        ? r.flakonBalance > 0
                          ? `${r.flakonBalance} Flakon`
                          : '—'
                        : r.balance > 0
                          ? `${r.balance} Paket`
                          : '—',
                  },
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportStockCardImage(
                    mode === 'single' ? (product?.name ?? '') : 'Tüm Ürünler',
                    mode === 'single' && product?.sku ? `Kod: ${product.sku}` : null,
                    summaryLine,
                    rows,
                    mode === 'all',
                  )
                }
              >
                <ImageDown className="size-3.5" /> Görsel (PNG)
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    {mode === 'all' && <TableHead>Ürün</TableHead>}
                    <TableHead>Doktor</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Fiyat</TableHead>
                    <TableHead>Sebep / Not</TableHead>
                    <TableHead>Giriş</TableHead>
                    <TableHead>Çıkış</TableHead>
                    <TableHead>Güncel Stok</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={mode === 'all' ? 10 : 9} className="text-muted-foreground py-8 text-center">
                        {mode === 'single' ? 'Bu ürün için henüz stok hareketi yok' : 'Kayıt yok'}
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => (
                    <TableRow key={row.id} onClick={() => setSelectedRowId(row.id)} selected={row.id === selectedRowId}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(row.date)}</TableCell>
                      {mode === 'all' && <TableCell className="text-muted-foreground">{row.productName}</TableCell>}
                      <TableCell className="font-medium">{row.doctorName ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={KIND_BADGE_VARIANT[row.kind]}>{tr.movementType[row.kind]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{row.unitPrice != null ? currency(row.unitPrice) : '—'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-40 truncate" title={row.reason ?? row.note ?? undefined}>
                        {row.reason ?? row.note ?? '—'}
                      </TableCell>
                      <TableCell className="text-success tabular-nums">
                        <InlineQtyCell
                          value={row.inQty}
                          unitLabel={row.unitKind === 'flakon' ? 'Flakon' : 'Paket'}
                          onCommit={(next) => handleInlineQtyChange(row, 'in', next)}
                        />
                      </TableCell>
                      <TableCell className="text-destructive tabular-nums">
                        <InlineQtyCell
                          value={row.outQty}
                          unitLabel={row.unitKind === 'flakon' ? 'Flakon' : 'Paket'}
                          onCommit={(next) => handleInlineQtyChange(row, 'out', next)}
                        />
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {row.unitKind === 'flakon'
                          ? row.flakonBalance > 0
                            ? `${row.flakonBalance} Flakon`
                            : '—'
                          : row.balance > 0
                            ? `${row.balance} Paket`
                            : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <StockMovementDialog
                            product={productById.get(row.productId)}
                            movement={{
                              id: row.id,
                              movement_type: row.kind,
                              quantity: row.quantity,
                              unit_price: row.unitPrice,
                              reason: row.reason,
                              note: row.note,
                              lot_id: row.lotId,
                              unit_kind: row.unitKind,
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" title="Hareketi düzenle">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <Button variant="ghost" size="icon" title="Hareketi sil" onClick={() => handleDeleteMovement(row)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ürünü kaldır"
                              onClick={() => handleDeleteProduct(row)}
                            >
                              <PackageX className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {dialog}
    </div>
  )
}
