import * as React from 'react'
import { Search, AlertTriangle, Trash2, CalendarClock } from 'lucide-react'

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
import { useDeactivateProduct, useProducts } from '@/features/stock/hooks'
import { createProduct, recordStockMovement, type ProductWithWarehouse } from '@/features/stock/api'
import { WarehouseDialog } from '@/features/warehouses/WarehouseDialog'
import { DailyCountPanel } from '@/features/stockCounts/DailyCountPanel'
import { cn } from '@/lib/utils'
import { getExpiryStatus } from '@/lib/expiry'
import { ExportMenu } from '@/components/ExportMenu'
import { ExcelImportDialog, type ImportField } from '@/components/ExcelImportDialog'
import { queryClient } from '@/lib/queryClient'
import type { BrandLine } from '@/types/database'

const ALL_BRANDS = 'all'

const productImportFields: ImportField[] = [
  { key: 'name', label: 'Ürün Adı', required: true, aliases: ['ürün', 'isim', 'ad'] },
  { key: 'sku', label: 'SKU / Stok Kodu', aliases: ['sku', 'stok kodu', 'kod'] },
  { key: 'category', label: 'Kategori', aliases: ['kategori'] },
  { key: 'unit', label: 'Birim', required: true, aliases: ['birim', 'ölçü birimi'] },
  {
    key: 'critical_stock_threshold',
    label: 'Kritik Stok Eşiği',
    required: true,
    aliases: ['kritik stok', 'kritik seviye', 'kritik eşik'],
  },
  { key: 'current_quantity', label: 'Başlangıç Stok Miktarı', aliases: ['mevcut stok', 'miktar', 'stok miktarı', 'adet'] },
  { key: 'unit_cost', label: 'Birim Maliyet', aliases: ['maliyet', 'alış fiyatı'] },
  { key: 'unit_price', label: 'Birim Satış Fiyatı', aliases: ['satış fiyatı', 'fiyat'] },
  { key: 'barcode', label: 'Barkod', aliases: ['barkod'] },
  { key: 'expiry_date', label: 'Son Kullanma Tarihi', aliases: ['skt', 'son kullanma tarihi', 'miat'] },
  { key: 'lot_number', label: 'Lot No', aliases: ['lot', 'lot no', 'parti no'] },
  { key: 'serial_number', label: 'Seri No', aliases: ['seri', 'seri no'] },
  { key: 'minimum_stock', label: 'Minimum Stok', aliases: ['min stok', 'minimum stok', 'yeniden sipariş seviyesi'] },
]

function parseOptionalNumber(v: string): number | null {
  const t = v?.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseOptionalDate(v: string): string | null {
  const t = v?.trim()
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

async function importProductRow(row: Record<string, string>) {
  const name = row.name?.trim()
  if (!name) throw new Error('Ürün adı boş olamaz')
  const unit = row.unit?.trim()
  if (!unit) throw new Error('Birim boş olamaz')
  const threshold = parseOptionalNumber(row.critical_stock_threshold)
  if (threshold == null || threshold < 0) throw new Error('Kritik stok eşiği geçerli bir sayı olmalı')

  const product = await createProduct({
    name,
    sku: row.sku?.trim() || null,
    category: row.category?.trim() || null,
    unit,
    critical_stock_threshold: threshold,
    minimum_stock: parseOptionalNumber(row.minimum_stock),
    unit_cost: parseOptionalNumber(row.unit_cost),
    unit_price: parseOptionalNumber(row.unit_price),
    barcode: row.barcode?.trim() || null,
    expiry_date: parseOptionalDate(row.expiry_date),
    lot_number: row.lot_number?.trim() || null,
    serial_number: row.serial_number?.trim() || null,
  })

  const startQty = parseOptionalNumber(row.current_quantity)
  if (startQty && startQty > 0) {
    await recordStockMovement({
      product_id: product.id,
      movement_type: 'in',
      quantity: startQty,
      reason: 'İçe aktarma - başlangıç stoğu',
    })
  }
}

function ProductsTable({
  products,
  onRemove,
}: {
  products: ProductWithWarehouse[]
  onRemove: (product: ProductWithWarehouse) => void
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Depo</TableHead>
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
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Ürün bulunamadı
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => {
              const isCritical = product.current_quantity <= product.critical_stock_threshold
              const isBelowMinimum =
                !isCritical && product.minimum_stock != null && product.current_quantity <= product.minimum_stock
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
                    {product.name}
                    {product.sku && <span className="ml-2 text-xs text-muted-foreground">{product.sku}</span>}
                    {product.barcode && (
                      <span className="block text-xs text-muted-foreground">Barkod: {product.barcode}</span>
                    )}
                    {product.lot_number && (
                      <span className="block text-xs text-muted-foreground">Lot: {product.lot_number}</span>
                    )}
                    {product.serial_number && (
                      <span className="block text-xs text-muted-foreground">Seri: {product.serial_number}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.category ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{product.warehouses?.name ?? '—'}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      {isCritical && <AlertTriangle className="size-3.5 text-destructive" />}
                      <Badge variant={isCritical ? 'destructive' : isBelowMinimum ? 'warning' : 'secondary'}>
                        {product.current_quantity} {product.unit}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.unit_price
                      ? Number(product.unit_price).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
                      : '—'}
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
  const deactivateMutation = useDeactivateProduct()

  function handleRemove(product: ProductWithWarehouse) {
    if (!confirm(`${product.name} kaldırılsın mı? Ürün stok listesinden kaldırılır, geçmiş hareketler saklanır.`)) return
    deactivateMutation.mutate(product.id)
  }

  return (
    <div>
      <PageHeader
        title="Stok"
        description="Ürün kataloğunu ve stok seviyelerini yönetin"
        actions={
          <div className="flex gap-2">
            <ExportMenu<ProductWithWarehouse>
              title="Stok Listesi"
              filename="stok"
              rows={products}
              columns={[
                { header: 'Ürün', value: (p) => p.name },
                { header: 'Kategori', value: (p) => p.category ?? '' },
                { header: 'Depo', value: (p) => p.warehouses?.name ?? '' },
                { header: 'Stok', value: (p) => `${p.current_quantity} ${p.unit}` },
                { header: 'Minimum Stok', value: (p) => (p.minimum_stock ?? '') },
                { header: 'Satış Fiyatı', value: (p) => (p.unit_price ? Number(p.unit_price) : '') },
                { header: 'Kampanya', value: (p) => p.campaign ?? '' },
                { header: 'Barkod', value: (p) => p.barcode ?? '' },
                { header: 'Lot No', value: (p) => p.lot_number ?? '' },
                { header: 'Seri No', value: (p) => p.serial_number ?? '' },
                { header: 'Ürün Hattı', value: (p) => (p.brand_line === 'dermakor' ? 'Dermakor' : p.brand_line === 'swiss' ? 'Swiss' : '') },
                { header: 'Son Kullanım Tarihi', value: (p) => p.expiry_date ?? '' },
              ]}
            />
            <ExcelImportDialog
              title="Ürünleri Excel'den İçe Aktar"
              fields={productImportFields}
              importRow={importProductRow}
              onDone={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
            />
            <WarehouseDialog />
            <ProductForm />
          </div>
        }
      />

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products">Ürünler</TabsTrigger>
          <TabsTrigger value="count">Günlük Sayım</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
