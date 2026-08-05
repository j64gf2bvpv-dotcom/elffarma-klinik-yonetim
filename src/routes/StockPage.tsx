import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, AlertTriangle, Trash2, CalendarClock, Wallet, TrendingUp, PackageSearch, RotateCcw, Loader2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductForm } from '@/features/stock/ProductForm'
import { StockMovementDialog } from '@/features/stock/StockMovementDialog'
import { StockHistoryDialog } from '@/features/stock/StockHistoryDialog'
import { ProductLotsDialog } from '@/features/stock/ProductLotsDialog'
import { useDeactivateProduct, useProducts, useRecordStockMovement } from '@/features/stock/hooks'
import { createProduct, recordStockMovement } from '@/features/stock/api'
import { DailyCountPanel } from '@/features/stockCounts/DailyCountPanel'
import { StockCardPanel } from '@/features/stock/StockCardPanel'
import { cn } from '@/lib/utils'
import { getExpiryStatus } from '@/lib/expiry'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import { DailyMovementImportButton } from '@/features/stock/DailyMovementImportButton'
import { readCell, type ImportSummary } from '@/lib/importData'
import type { BrandLine, Product } from '@/types/database'

const ALL_BRANDS = 'all'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}


/**
 * Stok adedine tıklayınca yerinde (inline) düzenlenebilir hale gelir. Yeni
 * değer doğrudan products.current_quantity'ye yazılmıyor — CLAUDE.md kuralı
 * gereği fark, record_stock_movement RPC'si üzerinden (artışta 'adjustment',
 * azalışta 'out' hareketi olarak) denetim kaydına işlenip uygulanıyor.
 */
function QuantityCell({ product }: { product: Product }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(String(product.current_quantity))
  const mutation = useRecordStockMovement()
  const isCritical = product.current_quantity <= product.critical_stock_threshold

  React.useEffect(() => {
    if (!editing) setValue(String(product.current_quantity))
  }, [product.current_quantity, editing])

  async function commit() {
    const next = Number(value)
    setEditing(false)
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setValue(String(product.current_quantity))
      return
    }
    const diff = next - product.current_quantity
    if (diff === 0) return
    await mutation.mutateAsync({
      product_id: product.id,
      movement_type: diff > 0 ? 'adjustment' : 'out',
      quantity: Math.abs(diff),
      reason: 'Hızlı stok düzenleme',
    })
  }

  if (editing) {
    return (
      <Input
        type="number"
        min="0"
        step="1"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setValue(String(product.current_quantity))
            setEditing(false)
          }
        }}
        className="h-8 w-20"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Adedi düzenlemek için tıklayın"
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
    >
      {isCritical && <AlertTriangle className="size-3.5 text-destructive animate-alert-glow-red rounded-full" />}
      <Badge variant={isCritical ? 'destructive' : 'secondary'} className={cn(isCritical && 'animate-alert-glow-red')}>
        {product.current_quantity} {product.unit}
      </Badge>
    </button>
  )
}

function ProductsTable({ products, onRemove }: { products: Product[]; onRemove: (product: Product) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>Satış Fiyatı</TableHead>
              <TableHead>Kampanya</TableHead>
              <TableHead>Ürün Hattı</TableHead>
              <TableHead>SKT</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Ürün bulunamadı
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => {
              const isCritical = product.current_quantity <= product.critical_stock_threshold
              const expiryStatus = getExpiryStatus(product.expiry_date)
              return (
                <TableRow
                  key={product.id}
                  className={cn((isCritical || expiryStatus === 'expired') && 'bg-destructive/5')}
                >
                  <TableCell>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="size-9 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="size-9 rounded-md border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <ProductForm
                      product={product}
                      trigger={
                        <button type="button" className="text-left hover:underline" title="Tüm bilgileri düzenle">
                          {product.name}
                          {product.sku && <span className="ml-2 text-xs text-muted-foreground">{product.sku}</span>}
                          {product.barcode && (
                            <span className="block text-xs text-muted-foreground">Barkod: {product.barcode}</span>
                          )}
                        </button>
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.category ?? '—'}</TableCell>
                  <TableCell>
                    <QuantityCell product={product} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.unit_price ? (
                      <>
                        {Number(product.unit_price).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        {product.unit_cost != null && Number(product.unit_price) > 0 && (
                          <span className="ml-1.5 text-xs text-success">
                            (%
                            {Math.round(
                              ((Number(product.unit_price) - Number(product.unit_cost)) / Number(product.unit_price)) * 100,
                            )}{' '}
                            marj)
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {product.campaign ? (
                      <Badge variant="success">{product.campaign}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.brand_line ? (
                      <Badge variant="outline">{product.brand_line === 'dermakor' ? 'Dermakor' : 'Swiss'}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.expiry_date ? (
                      <span className="inline-flex items-center gap-1.5">
                        {expiryStatus !== 'ok' && <CalendarClock className="size-3.5 text-destructive" />}
                        <Badge
                          variant={
                            expiryStatus === 'expired' ? 'destructive' : expiryStatus === 'soon' ? 'warning' : 'outline'
                          }
                        >
                          {product.expiry_date}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <StockHistoryDialog product={product} />
                      <ProductLotsDialog product={product} />
                      <StockMovementDialog product={product} />
                      <ProductForm product={product} />
                      <Button variant="ghost" size="icon" onClick={() => onRemove(product)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function StockPage() {
  const [search, setSearch] = React.useState('')
  const [brandFilter, setBrandFilter] = React.useState<typeof ALL_BRANDS | BrandLine>(ALL_BRANDS)
  const { data: products = [], isLoading } = useProducts(search, brandFilter === ALL_BRANDS ? undefined : brandFilter)
  const { data: allProducts = [] } = useProducts('')
  const deactivateMutation = useDeactivateProduct()
  const queryClient = useQueryClient()

  function handleRemove(product: Product) {
    if (!confirm(`${product.name} kaldırılsın mı? Ürün stok listesinden kaldırılır, geçmiş hareketler saklanır.`)) return
    deactivateMutation.mutate(product.id)
  }

  const [resettingStock, setResettingStock] = React.useState(false)

  /**
   * Tüm ürünlerin stok miktarını 0'a çeker — doğrudan products.current_quantity
   * güncellemesi DEĞİL, her ürün için record_stock_movement RPC'sini 'out'
   * hareketiyle çağırıp denetim kaydına işleyerek yapılır (CLAUDE.md kuralı).
   */
  async function handleResetAllStock() {
    const nonZero = allProducts.filter((p) => p.current_quantity > 0)
    if (nonZero.length === 0) {
      toast.info('Zaten tüm ürünlerin stoğu 0')
      return
    }
    if (
      !confirm(
        `${nonZero.length} ürünün stoğu SIFIRLANACAK. Bu işlem her ürün için bir "çıkış" hareketi olarak kaydedilir, geri alınamaz. Emin misiniz?`,
      )
    ) {
      return
    }
    setResettingStock(true)
    let done = 0
    let failed = 0
    for (const p of nonZero) {
      try {
        await recordStockMovement({
          product_id: p.id,
          movement_type: 'out',
          quantity: p.current_quantity,
          reason: 'Toplu stok sıfırlama',
        })
        done++
      } catch {
        failed++
      }
    }
    setResettingStock(false)
    await queryClient.invalidateQueries({ queryKey: ['products'] })
    if (failed === 0) {
      toast.success(`${done} ürünün stoğu sıfırlandı`)
    } else {
      toast.error(`${done} ürün sıfırlandı, ${failed} ürün başarısız oldu`)
    }
  }

  /**
   * Stok kritik olduğu için içe aktarma ya HEPSİ ya HİÇBİRİ şeklinde çalışır:
   * önce tüm satırlar (isim eksikliği, sayı olmayan stok miktarı vb.) yazma
   * yapılmadan doğrulanır; herhangi bir satırda hata varsa hiçbir ürün
   * oluşturulmaz, tüm hatalar birden gösterilir (kısmi/karışık bir içe
   * aktarma — bazı satırlar eklenmiş bazıları eklenmemiş — bırakılmaz).
   * Zaten var olan ürünler (SKU/isim eşleşmesi) hata değil, atlanan kayıt
   * sayılır.
   */
  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const existingSkus = new Set(allProducts.filter((p) => p.sku).map((p) => p.sku))
    const existingNames = new Set(allProducts.map((p) => p.name.toLocaleLowerCase('tr')))
    const seenSkusInBatch = new Set<string>()
    const seenNamesInBatch = new Set<string>()
    const errors: string[] = []
    let skipped = 0

    const planned: { input: Parameters<typeof createProduct>[0]; initialQty: number }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowLabel = `Satır ${i + 2}`
      const name = readCell(row, 'Ürün', 'Ürün Adı')
      if (!name) {
        errors.push(`${rowLabel}: Ürün adı eksik`)
        continue
      }
      const nameKey = name.toLocaleLowerCase('tr')
      const sku = readCell(row, 'SKU') || null
      if (
        (sku && existingSkus.has(sku)) ||
        existingNames.has(nameKey) ||
        seenNamesInBatch.has(nameKey) ||
        (sku && seenSkusInBatch.has(sku))
      ) {
        skipped++
        continue
      }

      const initialQtyText = readCell(row, 'Başlangıç Stoğu', 'Stok')
      const initialQty = initialQtyText ? Number(initialQtyText.replace(/[^\d.-]/g, '')) : 0
      if (initialQtyText && !Number.isFinite(initialQty)) {
        errors.push(`${rowLabel}: Başlangıç stoğu sayı değil ("${initialQtyText}")`)
        continue
      }

      const brandText = readCell(row, 'Ürün Hattı')
      seenNamesInBatch.add(nameKey)
      if (sku) seenSkusInBatch.add(sku)
      planned.push({
        input: {
          name,
          sku,
          category: readCell(row, 'Kategori') || null,
          unit: readCell(row, 'Birim') || 'adet',
          critical_stock_threshold: Number(readCell(row, 'Kritik Stok Eşiği') || 5),
          unit_cost: readCell(row, 'Birim Maliyet') ? Number(readCell(row, 'Birim Maliyet')) : null,
          unit_price: readCell(row, 'Satış Fiyatı') ? Number(readCell(row, 'Satış Fiyatı')) : null,
          campaign: readCell(row, 'Kampanya') || null,
          expiry_date: readCell(row, 'Son Kullanım Tarihi') || null,
          barcode: readCell(row, 'Barkod') || null,
          brand_line: /dermakor/i.test(brandText) ? 'dermakor' : /swiss/i.test(brandText) ? 'swiss' : null,
        },
        initialQty,
      })
    }

    if (errors.length > 0) {
      return { added: 0, skipped: 0, errors }
    }

    const summary: ImportSummary = { added: 0, skipped, errors: [] }
    for (const p of planned) {
      try {
        const created = await createProduct(p.input)
        if (p.initialQty > 0) {
          await recordStockMovement({
            product_id: created.id,
            movement_type: 'in',
            quantity: p.initialQty,
            reason: 'İçe aktarma — başlangıç stoğu',
          })
        }
        summary.added++
      } catch (err) {
        summary.errors.push(`${p.input.name}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
      }
    }

    if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['products'] })
    return summary
  }

  const totalCostValue = allProducts.reduce((sum, p) => sum + p.current_quantity * Number(p.unit_cost ?? 0), 0)
  const totalRetailValue = allProducts.reduce((sum, p) => sum + p.current_quantity * Number(p.unit_price ?? 0), 0)
  const criticalCount = allProducts.filter((p) => p.current_quantity <= p.critical_stock_threshold).length

  return (
    <div>
      <PageHeader
        title="Stok"
        description="Ürün kataloğunu ve stok seviyelerini yönetin"
        actions={
          <div className="flex gap-2">
            <ExportMenu<Product>
              title="Stok Listesi"
              filename="stok"
              rows={products}
              columns={[
                { header: 'Ürün', value: (p) => p.name },
                { header: 'Kategori', value: (p) => p.category ?? '' },
                { header: 'Stok', value: (p) => `${p.current_quantity} ${p.unit}` },
                { header: 'Satış Fiyatı', value: (p) => (p.unit_price ? Number(p.unit_price) : '') },
                { header: 'Kampanya', value: (p) => p.campaign ?? '' },
                { header: 'Barkod', value: (p) => p.barcode ?? '' },
                { header: 'Ürün Hattı', value: (p) => (p.brand_line === 'dermakor' ? 'Dermakor' : p.brand_line === 'swiss' ? 'Swiss' : '') },
                { header: 'Son Kullanım Tarihi', value: (p) => p.expiry_date ?? '' },
              ]}
            />
            <ImportMenu
              onImport={handleImport}
              templateFilename="stok-sablon"
              templateHeaders={[
                'Ürün',
                'SKU',
                'Kategori',
                'Birim',
                'Kritik Stok Eşiği',
                'Birim Maliyet',
                'Satış Fiyatı',
                'Kampanya',
                'Barkod',
                'Ürün Hattı',
                'Son Kullanım Tarihi',
                'Başlangıç Stoğu',
              ]}
              templateSampleRows={[
                {
                  Ürün: 'Botoks 100u',
                  SKU: 'BTX-100',
                  Kategori: 'Botoks',
                  Birim: 'adet',
                  'Kritik Stok Eşiği': 5,
                  'Birim Maliyet': 800,
                  'Satış Fiyatı': 1200,
                  Kampanya: '',
                  Barkod: '',
                  'Ürün Hattı': 'Dermakor',
                  'Son Kullanım Tarihi': '2027-01-01',
                  'Başlangıç Stoğu': 20,
                },
              ]}
            />
            <SmartImportDialog
              title="Ürünleri Akıllı İçe Aktar"
              targetLabel="stok/ürün"
              fieldHeaders={[
                'Ürün',
                'SKU',
                'Kategori',
                'Birim',
                'Kritik Stok Eşiği',
                'Birim Maliyet',
                'Satış Fiyatı',
                'Kampanya',
                'Barkod',
                'Ürün Hattı',
                'Son Kullanım Tarihi',
                'Başlangıç Stoğu',
              ]}
              fieldHints={{
                Birim: 'ör. "adet", "kutu" — yoksa "adet" yaz',
                'Kritik Stok Eşiği': 'sayı, yoksa 5 yaz',
                'Ürün Hattı': '"Dermakor" veya "Swiss", yoksa boş',
                'Son Kullanım Tarihi': 'YYYY-AA-GG formatında, yoksa boş',
                'Başlangıç Stoğu': 'sayı, yoksa 0 yaz',
              }}
              onImport={handleImport}
            />
            <DailyMovementImportButton />
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleResetAllStock}
              disabled={resettingStock}
              title="Tüm ürünlerin stok miktarını 0'a çeker (denetim kaydı olarak işlenir)"
            >
              {resettingStock ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Tüm Ürünleri Sıfırla
            </Button>
            <ProductForm />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Stok Değeri (Maliyet)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalCostValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Stok Değeri (Satış)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalRetailValue)}</p>
              <p className="text-muted-foreground text-xs">
                Potansiyel kâr: {currency(totalRetailValue - totalCostValue)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <PackageSearch className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Kritik Stok</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{criticalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products">Ürünler</TabsTrigger>
          <TabsTrigger value="count">Günlük Sayım</TabsTrigger>
          <TabsTrigger value="card">Stok Kartı</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ürün ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={brandFilter} onValueChange={(v) => setBrandFilter(v as typeof brandFilter)}>
              <TabsList>
                <TabsTrigger value={ALL_BRANDS}>Tümü</TabsTrigger>
                <TabsTrigger value="dermakor">Dermakor</TabsTrigger>
                <TabsTrigger value="swiss">Swiss</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading && <p className="text-muted-foreground py-8 text-center">Yükleniyor...</p>}

          {!isLoading && brandFilter === ALL_BRANDS && (
            <div className="grid gap-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dermakor</h3>
                <ProductsTable products={products.filter((p) => p.brand_line === 'dermakor')} onRemove={handleRemove} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Swiss</h3>
                <ProductsTable products={products.filter((p) => p.brand_line === 'swiss')} onRemove={handleRemove} />
              </div>
              {products.some((p) => !p.brand_line) && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Diğer</h3>
                  <ProductsTable products={products.filter((p) => !p.brand_line)} onRemove={handleRemove} />
                </div>
              )}
            </div>
          )}

          {!isLoading && brandFilter !== ALL_BRANDS && <ProductsTable products={products} onRemove={handleRemove} />}
        </TabsContent>

        <TabsContent value="count">
          <DailyCountPanel />
        </TabsContent>

        <TabsContent value="card">
          <StockCardPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
