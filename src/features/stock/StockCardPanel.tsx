import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageDown, IdCard } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { ProductMultiCombobox } from '@/features/stock/ProductMultiCombobox'
import { useSales } from '@/features/sales/hooks'
import { useSampleRequests } from '@/features/samples/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useProducts } from '@/features/stock/hooks'
import { computeCariLedger, cariBalance } from '@/features/customers/cariLedger'
import { buildStockCardReport, summarizeStockCard, stockCardRowKindLabels, type StockCardRow } from './stockCardReport'
import { exportStockCardImage } from './exportStockCardImage'
import {
  importStockCardRows,
  STOCK_CARD_IMPORT_HEADERS,
  STOCK_CARD_IMPORT_SAMPLE_ROWS,
  STOCK_CARD_IMPORT_FIELD_HINTS,
} from './importStockCard'
import type { Product } from '@/types/database'

type ReportMode = 'single' | 'all'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

/**
 * "Stok Kartı" — iki mod: Tek Ürün (seçilen ürünün doktor bazlı satış/numune
 * dökümü) ve Tüm Ürünler (tüm ürünler için aynı döküm, tek tabloda, ürün
 * kolonuyla). İkisi de sales + sample_requests'i birleştirir (bkz.
 * stockCardReport.ts), her doktorun güncel cari bakiyesiyle birlikte.
 * Excel/Word/PDF (ExportMenu) ve PNG (canvas) olarak dışa aktarılabilir.
 */
export function StockCardPanel() {
  const [mode, setMode] = React.useState<ReportMode>('single')
  const [productId, setProductId] = React.useState<string | undefined>(undefined)
  const [product, setProduct] = React.useState<Product | null>(null)
  const [allProductIds, setAllProductIds] = React.useState<string[]>([])

  const queryClient = useQueryClient()
  const { data: sales = [] } = useSales()
  const { data: sampleRequests = [] } = useSampleRequests()
  const { data: allPayments = [] } = usePayments({})
  const { data: invoices = [] } = useInvoices()
  const { data: customers = [] } = useCustomers('')
  const { data: allProducts = [] } = useProducts('')

  const cariLedger = React.useMemo(
    () => computeCariLedger(allPayments, sales, invoices),
    [allPayments, sales, invoices],
  )

  const singleRows = React.useMemo<StockCardRow[]>(
    () => (productId ? buildStockCardReport(sales, sampleRequests, productId) : []),
    [productId, sales, sampleRequests],
  )

  const allRows = React.useMemo<StockCardRow[]>(() => buildStockCardReport(sales, sampleRequests), [sales, sampleRequests])
  const filteredAllRows = React.useMemo(() => {
    if (allProductIds.length === 0) return allRows
    const idSet = new Set(allProductIds)
    return allRows.filter((r) => idSet.has(r.productId))
  }, [allRows, allProductIds])

  const rows = mode === 'single' ? singleRows : filteredAllRows
  const summary = React.useMemo(() => summarizeStockCard(rows), [rows])
  const showReport = mode === 'all' || !!product

  const summaryLine =
    mode === 'single'
      ? `${summary.soldQty} satıldı · ${summary.sampleQty} numune verildi · ${summary.doctorCount} doktor · ${currency(summary.soldRevenue)} ciro`
      : `${summary.productCount} ürün · ${summary.soldQty} satıldı · ${summary.sampleQty} numune verildi · ${summary.doctorCount} doktor · ${currency(summary.soldRevenue)} ciro`

  async function handleImport(rawRows: Record<string, unknown>[]) {
    const result = await importStockCardRows(rawRows, allProducts, customers, allRows)
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
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Satılan</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.soldQty}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Numune Verilen</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.sampleQty}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Satış Cirosu</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(summary.soldRevenue)}</p>
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
              <ExportMenu<StockCardRow>
                title={mode === 'single' ? `Stok Kartı — ${product?.name}` : 'Stok Kartı — Tüm Ürünler'}
                filename={mode === 'single' ? `stok-karti-${product?.sku ?? product?.name}` : 'stok-karti-tum-urunler'}
                rows={rows}
                columns={[
                  { header: 'Tarih', value: (r) => r.date },
                  ...(mode === 'all' ? [{ header: 'Ürün', value: (r: StockCardRow) => r.productName }] : []),
                  { header: 'Doktor', value: (r) => r.doctorName },
                  { header: 'Tür', value: (r) => stockCardRowKindLabels[r.kind] },
                  { header: 'Adet', value: (r) => r.quantity },
                  { header: 'Birim Fiyat', value: (r) => r.unitPrice },
                  { header: 'Tutar', value: (r) => r.total },
                  { header: 'Cari Bakiye', value: (r) => cariBalance(cariLedger, r.doctorId) },
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
                    <TableHead>Adet</TableHead>
                    <TableHead>Birim Fiyat</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Cari Bakiye</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={mode === 'all' ? 8 : 7} className="text-muted-foreground py-8 text-center">
                        {mode === 'single' ? 'Bu ürün için henüz satış/numune kaydı yok' : 'Kayıt yok'}
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => {
                    const doctor = customers.find((c) => c.id === row.doctorId)
                    const balance = cariBalance(cariLedger, row.doctorId)
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.date}</TableCell>
                        {mode === 'all' && <TableCell className="text-muted-foreground">{row.productName}</TableCell>}
                        <TableCell className="font-medium">{doctor?.full_name ?? row.doctorName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              row.kind === 'numune'
                                ? 'border-warning/30 bg-warning/10 text-warning-foreground'
                                : row.kind === 'iade'
                                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                  : 'border-success/30 bg-success/10 text-success'
                            }
                          >
                            {stockCardRowKindLabels[row.kind]}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{currency(row.unitPrice)}</TableCell>
                        <TableCell className="font-medium">{currency(row.total)}</TableCell>
                        <TableCell className={balance > 0 ? 'text-destructive' : 'text-success'}>
                          {currency(balance)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
