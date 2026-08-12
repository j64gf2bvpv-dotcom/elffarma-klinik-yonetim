import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ImageDown, IdCard, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { ProductMultiCombobox } from '@/features/stock/ProductMultiCombobox'
import { StockMovementDialog } from '@/features/stock/StockMovementDialog'
import { useSales } from '@/features/sales/hooks'
import { useSampleRequests } from '@/features/samples/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useAllStockMovements, useDeleteStockMovement, useProducts, useUpdateStockMovement } from '@/features/stock/hooks'
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
function InlineQtyCell({ value, onCommit }: { value: number; onCommit: (next: number) => void }) {
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
      className="-mx-1 min-w-6 rounded px-1 py-0.5 text-left hover:bg-accent"
    >
      {value > 0 ? value : <span className="text-muted-foreground">—</span>}
    </button>
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

  const queryClient = useQueryClient()
  const { data: movements = [] } = useAllStockMovements()
  const { data: sales = [] } = useSales()
  const { data: sampleRequests = [] } = useSampleRequests()
  const { data: customers = [] } = useCustomers('')
  const { data: allProducts = [] } = useProducts('')
  const deleteMovementMutation = useDeleteStockMovement()
  const updateMovementMutation = useUpdateStockMovement()

  const productById = React.useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts])

  function handleDeleteMovement(row: StockCardRow) {
    if (!confirm(`${formatDateTime(row.date)} tarihli hareket silinsin mi? Ürünün güncel stoğu buna göre geri alınır.`)) return
    deleteMovementMutation.mutate(row.id)
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
    () => (productId ? buildStockLedger(movements, productId) : []),
    [productId, movements],
  )

  const allRows = React.useMemo<StockCardRow[]>(() => buildStockLedger(movements), [movements])
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
      ? `${summary.inQty} giriş · ${summary.outQty} çıkış · Güncel Stok: ${summary.currentStock} ${product?.unit ?? ''} · ${summary.doctorCount} doktor`
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
                  {product.current_quantity} {product.unit}
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
                <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.currentStock}</p>
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
                product={mode === 'single' ? (product ?? undefined) : undefined}
                trigger={
                  <Button variant="outline" size="sm">
                    <ArrowLeftRight className="size-3.5" /> Giriş / Çıkış Ekle
                  </Button>
                }
              />
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
                  { header: 'Giriş', value: (r) => r.inQty || '' },
                  { header: 'Çıkış', value: (r) => r.outQty || '' },
                  { header: 'Güncel Stok', value: (r) => r.balance },
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
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(row.date)}</TableCell>
                      {mode === 'all' && <TableCell className="text-muted-foreground">{row.productName}</TableCell>}
                      <TableCell className="font-medium">{row.doctorName ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={KIND_BADGE_VARIANT[row.kind]}>{tr.movementType[row.kind]}</Badge>
                          {row.unitKind === 'flakon' && (
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                              Flakon
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.unitPrice != null ? currency(row.unitPrice) : '—'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-56">{row.reason ?? row.note ?? '—'}</TableCell>
                      <TableCell className="text-success tabular-nums">
                        <InlineQtyCell value={row.inQty} onCommit={(next) => handleInlineQtyChange(row, 'in', next)} />
                      </TableCell>
                      <TableCell className="text-destructive tabular-nums">
                        <InlineQtyCell value={row.outQty} onCommit={(next) => handleInlineQtyChange(row, 'out', next)} />
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{row.balance}</TableCell>
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
    </div>
  )
}
