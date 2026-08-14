import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  AlertTriangle,
  Trash2,
  CalendarClock,
  TrendingUp,
  PackageSearch,
  RotateCcw,
  Loader2,
  Check,
  GripVertical,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductForm } from '@/features/stock/ProductForm'
import { StockMovementDialog } from '@/features/stock/StockMovementDialog'
import { StockHistoryDialog } from '@/features/stock/StockHistoryDialog'
import { ProductLotsDialog } from '@/features/stock/ProductLotsDialog'
import {
  useDeactivateProduct,
  useProducts,
  useRecordStockMovement,
  useReorderProducts,
  useUpdateProductCampaign,
  useUpdateProductCategory,
  useUpdateProductPrice,
} from '@/features/stock/hooks'
import { DailyCountPanel } from '@/features/stockCounts/DailyCountPanel'
import { StockCardPanel } from '@/features/stock/StockCardPanel'
import { CargoPanel } from '@/features/cargo/CargoPanel'
import { SafeThumbnail } from '@/components/SafeThumbnail'
import { cn } from '@/lib/utils'
import { getExpiryStatus } from '@/lib/expiry'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import { DailyMovementImportButton } from '@/features/stock/DailyMovementImportButton'
import {
  importProductRows,
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_SAMPLE_ROWS,
  PRODUCT_IMPORT_FIELD_HINTS,
} from '@/features/stock/importProducts'
import type { ImportSummary } from '@/lib/importData'
import type { BrandLine, Product } from '@/types/database'

const ALL_BRANDS = 'all'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Tıkla-düzenle hücrelerinde input'un yanına konan görünür "Kaydet" butonu —
 * blur/Enter ile kaydetme zaten çalışıyor ama kullanıcı için görünür bir onay
 * eylemi olsun diye eklendi. onMouseDown'da preventDefault yapılmazsa buton
 * tıklanmadan önce input blur olur, commit() editing'i false yapar ve buton
 * DOM'dan kalkıp click event'i hiç ateşlenmeden kaybolur.
 */
function SaveButton({ onCommit }: { onCommit: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      className="h-8 w-8 shrink-0"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onCommit}
      title="Kaydet"
    >
      <Check className="size-4" />
    </Button>
  )
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
      <div className="flex items-center gap-1">
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
        <SaveButton onCommit={commit} />
      </div>
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

/**
 * Flakon adedine tıklayınca yerinde düzenlenebilir hale gelir — QuantityCell'in
 * aynısı ama flakon_quantity için, record_stock_movement RPC'sine unit_kind:
 * 'flakon' ile çağrı yapar (paket adedini hiç etkilemez, bkz.
 * decouple_flakon_from_paket_movements migration'ı). Ürünün flakon_per_package
 * oranı tanımlı olsun olmasın her ürün için elle düzenlenebilir.
 */
function FlakonQuantityCell({ product }: { product: Product }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(String(product.flakon_quantity))
  const mutation = useRecordStockMovement()

  React.useEffect(() => {
    if (!editing) setValue(String(product.flakon_quantity))
  }, [product.flakon_quantity, editing])

  async function commit() {
    const next = Number(value)
    setEditing(false)
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setValue(String(product.flakon_quantity))
      return
    }
    const diff = next - product.flakon_quantity
    if (diff === 0) return
    await mutation.mutateAsync({
      product_id: product.id,
      movement_type: diff > 0 ? 'adjustment' : 'out',
      quantity: Math.abs(diff),
      reason: 'Hızlı flakon düzenleme',
      unit_kind: 'flakon',
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
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
              setValue(String(product.flakon_quantity))
              setEditing(false)
            }
          }}
          className="h-8 w-20"
        />
        <SaveButton onCommit={commit} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Flakon adedini düzenlemek için tıklayın"
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
    >
      <Badge variant="secondary">{product.flakon_quantity} flakon</Badge>
    </button>
  )
}

/** Kampanya metnine tıklayınca yerinde düzenlenebilir hale gelir — sadece campaign alanını günceller. */
function CampaignCell({ product }: { product: Product }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(product.campaign ?? '')
  const mutation = useUpdateProductCampaign()

  React.useEffect(() => {
    if (!editing) setValue(product.campaign ?? '')
  }, [product.campaign, editing])

  function commit() {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed === (product.campaign ?? '')) return
    mutation.mutate({ id: product.id, campaign: trimmed || null })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          placeholder="Örn. 5+1"
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
              setValue(product.campaign ?? '')
              setEditing(false)
            }
          }}
          className="h-8 w-28"
        />
        <SaveButton onCommit={commit} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Kampanyayı düzenlemek için tıklayın"
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
    >
      {product.campaign ? (
        <Badge variant="success">{product.campaign}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </button>
  )
}

/** Satış fiyatına tıklayınca yerinde düzenlenebilir hale gelir — sadece unit_price alanını günceller. */
function PriceCell({ product }: { product: Product }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(product.unit_price != null ? String(product.unit_price) : '')
  const mutation = useUpdateProductPrice()

  React.useEffect(() => {
    if (!editing) setValue(product.unit_price != null ? String(product.unit_price) : '')
  }, [product.unit_price, editing])

  function commit() {
    setEditing(false)
    const trimmed = value.trim()
    const current = product.unit_price != null ? String(product.unit_price) : ''
    if (trimmed === current) return
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setValue(current)
      return
    }
    mutation.mutate({ id: product.id, unit_price: parsed })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          step="0.01"
          autoFocus
          placeholder="Örn. 1500"
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
              setValue(product.unit_price != null ? String(product.unit_price) : '')
              setEditing(false)
            }
          }}
          className="h-8 w-28"
        />
        <SaveButton onCommit={commit} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Satış fiyatını düzenlemek için tıklayın"
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-muted-foreground hover:bg-accent"
    >
      {product.unit_price ? (
        <>
          {Number(product.unit_price).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
          {product.unit_cost != null && Number(product.unit_price) > 0 && (
            <span className="text-xs text-success">
              (%
              {Math.round(((Number(product.unit_price) - Number(product.unit_cost)) / Number(product.unit_price)) * 100)}{' '}
              marj)
            </span>
          )}
        </>
      ) : (
        <span>—</span>
      )}
    </button>
  )
}

/** Kategoriye tıklayınca yerinde düzenlenebilir hale gelir — sadece category alanını günceller. */
function CategoryCell({ product }: { product: Product }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(product.category ?? '')
  const mutation = useUpdateProductCategory()

  React.useEffect(() => {
    if (!editing) setValue(product.category ?? '')
  }, [product.category, editing])

  function commit() {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed === (product.category ?? '')) return
    mutation.mutate({ id: product.id, category: trimmed || null })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          placeholder="Örn. Dolgu"
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
              setValue(product.category ?? '')
              setEditing(false)
            }
          }}
          className="h-8 w-28"
        />
        <SaveButton onCommit={commit} />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Kategoriyi düzenlemek için tıklayın"
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-muted-foreground hover:bg-accent"
    >
      {product.category ?? '—'}
    </button>
  )
}

/**
 * `max-w-none` üründe resim kare gözükmeme ("ince çubuk" görünme) hatasının
 * gerçek kök nedeni için gerekli: Tailwind'in `img{max-width:100%;height:auto}`
 * global sıfırlaması, `size-9`'un genişliğini geçersiz KILMIYOR (ayrı bir CSS
 * özelliği) — tablo bu sütunu `table-layout:auto` yüzünden (Dermakor ve Swiss
 * tabloları birbirinden bağımsız, aynı kodla bile FARKLI genişliğe
 * yerleşebiliyor) 60px altına sıkıştırdığında resim de genişlikte küçülüyor,
 * ama `size-9`'un yüksekliği (daha spesifik class) sabit 36px kalıyor — sonuç
 * dar-ama-uzun bir "çubuk". Gerçek 1400/1024/800/600/400px pencere
 * genişliklerinde, gerçek ürün verisiyle headless Chrome'da ölçülüp doğrulandı.
 */
function ProductsTable({
  products,
  onRemove,
  selectedId,
  onSelect,
  checkedIds,
  onToggleChecked,
  onToggleAll,
  onReorder,
}: {
  products: Product[]
  onRemove: (product: Product) => void
  selectedId: string | null
  onSelect: (id: string) => void
  checkedIds: Set<string>
  onToggleChecked: (id: string) => void
  onToggleAll: (products: Product[], checkAll: boolean) => void
  onReorder: (products: Product[]) => void
}) {
  const dragIndexRef = React.useRef<number | null>(null)
  const allChecked = products.length > 0 && products.every((p) => checkedIds.has(p.id))

  function handleDrop(targetIndex: number) {
    const from = dragIndexRef.current
    dragIndexRef.current = null
    if (from === null || from === targetIndex) return
    const reordered = [...products]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(targetIndex, 0, moved)
    onReorder(reordered)
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-8">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => onToggleAll(products, v === true)}
                  aria-label="Tümünü seç"
                />
              </TableHead>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Paket</TableHead>
              <TableHead>Flakon</TableHead>
              <TableHead>Güncel Stok Durumu</TableHead>
              <TableHead>Satış Fiyatı</TableHead>
              <TableHead>Kampanya</TableHead>
              <TableHead>SKT</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                  Ürün bulunamadı
                </TableCell>
              </TableRow>
            )}
            {products.map((product, index) => {
              const isCritical = product.current_quantity <= product.critical_stock_threshold
              const expiryStatus = getExpiryStatus(product.expiry_date)
              return (
                <TableRow
                  key={product.id}
                  id={`product-row-${product.id}`}
                  draggable
                  onDragStart={() => (dragIndexRef.current = index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onClick={() => onSelect(product.id)}
                  selected={product.id === selectedId}
                  className={cn(
                    // Kritik/süresi geçmiş rengi (bg-destructive/5) seçiliyken
                    // ATLANIYOR — aksi halde TableRow'un seçili-satır
                    // koyulaştırması twMerge birleştirmesinde bu renk
                    // tarafından ezilip görünmez oluyordu.
                    (isCritical || expiryStatus === 'expired') && product.id !== selectedId && 'bg-destructive/5',
                  )}
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="cursor-grab text-muted-foreground">
                    <GripVertical className="size-4" />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checkedIds.has(product.id)}
                      onCheckedChange={() => onToggleChecked(product.id)}
                      aria-label={`${product.name} seç`}
                    />
                  </TableCell>
                  <TableCell>
                    <SafeThumbnail
                      src={product.image_url}
                      alt={product.name}
                      className="size-9 max-w-none shrink-0 rounded-md border-2 border-muted-foreground/30 bg-muted object-cover"
                      fallback={<div className="size-9 shrink-0 rounded-md border-2 border-muted-foreground/30 bg-muted" />}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <ProductForm
                      product={product}
                      trigger={
                        <button type="button" className="block text-left hover:underline" title="Tüm bilgileri düzenle">
                          {product.name}
                          {product.barcode && (
                            <span className="block text-xs text-muted-foreground">Barkod: {product.barcode}</span>
                          )}
                        </button>
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <CategoryCell product={product} />
                  </TableCell>
                  <TableCell>
                    <QuantityCell product={product} />
                  </TableCell>
                  <TableCell>
                    <FlakonQuantityCell product={product} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      {isCritical && <AlertTriangle className="size-3.5 text-destructive animate-alert-glow-red" />}
                      <span className={cn('flex items-center gap-1.5', isCritical && 'font-medium text-destructive')}>
                        <span>{product.current_quantity} paket</span>
                        <span className="text-border">|</span>
                        <span>{product.flakon_quantity} flakon</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PriceCell product={product} />
                  </TableCell>
                  <TableCell>
                    <CampaignCell product={product} />
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

/**
 * "Tüm Ürünleri Sıfırla" — sadece yönetici, iki adımlı onay: (1) etkilenecek
 * ürün sayısının önizlemesi + zorunlu bir gerekçe metni, (2) ürün sayısını
 * elle yazarak kesin onay. Gönderildiğinde `reset_all_stock` RPC'sini TEK
 * seferde çağırır — RPC sunucu tarafında hem paket hem flakon sayaçlarını
 * tek bir transaction içinde sıfırlar (ya hepsi ya hiçbiri).
 */
function ResetAllStockDialog({ affectedCount }: { affectedCount: number }) {
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2>(1)
  const [reason, setReason] = React.useState('')
  const [confirmText, setConfirmText] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  if (staff?.role !== 'admin') return null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setStep(1)
      setReason('')
      setConfirmText('')
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('reset_all_stock', { p_reason: reason.trim() })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(`${data ?? affectedCount} ürünün stoğu (paket + flakon) sıfırlandı`)
      handleOpenChange(false)
    } catch (error) {
      toast.error('Sıfırlanamadı', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={affectedCount === 0}
        title="Tüm ürünlerin paket ve flakon stok miktarını 0'a çeker (denetim kaydı olarak işlenir)"
      >
        <RotateCcw />
        Tüm Ürünleri Sıfırla
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tüm Ürünleri Sıfırla</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `${affectedCount} ürünün stoğu (paket + flakon) SIFIRLANACAK. Bu işlem her ürün için "çıkış" hareketi olarak denetim kaydına işlenir ve geri alınamaz.`
              : 'Son onay: devam etmek için etkilenecek ürün sayısını aşağıya yazın.'}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reset-reason">Gerekçe (zorunlu)</Label>
              <Textarea
                id="reset-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ör. yıl sonu fiziksel sayım sonrası toplu sıfırlama..."
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="reset-confirm">Onaylamak için "{affectedCount}" yazın</Label>
            <Input id="reset-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Vazgeç
          </Button>
          {step === 1 ? (
            <Button type="button" variant="destructive" disabled={!reason.trim()} onClick={() => setStep(2)}>
              Devam Et
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText.trim() !== String(affectedCount) || submitting}
              onClick={handleConfirm}
            >
              {submitting && <Loader2 className="animate-spin" />}
              Sıfırla
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StockPage() {
  const [search, setSearch] = React.useState('')
  const [brandFilter, setBrandFilter] = React.useState<typeof ALL_BRANDS | BrandLine>(ALL_BRANDS)
  // Kaydırırken hangi satırla ilgilendiğini kaybetmemek için tıklanan satır
  // vurgulanıp öyle kalıyor — hover gibi fare pozisyonuna bağlı değil.
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null)
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set())
  const { data: products = [], isLoading } = useProducts(search, brandFilter === ALL_BRANDS ? undefined : brandFilter)
  const { data: allProducts = [] } = useProducts('')
  const deactivateMutation = useDeactivateProduct()
  const reorderMutation = useReorderProducts()
  const queryClient = useQueryClient()

  // Ekranda o an görünen ürün satırlarının GERÇEK dikey sırası — ALL_BRANDS
  // filtresinde iki ayrı ProductsTable (Dermakor sonra Swiss) render
  // edildiği için, klavye ok tuşlarının render sırasıyla birebir eşleşmesi
  // için aynı bölme mantığı burada da uygulanıyor.
  const orderedVisibleProducts = React.useMemo(() => {
    if (brandFilter === ALL_BRANDS) {
      return [
        ...products.filter((p) => p.brand_line === 'dermakor'),
        ...products.filter((p) => p.brand_line === 'swiss'),
      ]
    }
    return products
  }, [products, brandFilter])

  // Yukarı/aşağı/sağa/sola ok tuşlarıyla seçili ürün panelini bir öncekine/
  // sonrakine taşır — arama kutusu gibi bir metin alanına yazarken devreye
  // girmiyor. Seçili satır her zaman görünüme kaydırılır.
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as HTMLElement | null
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return
      if (orderedVisibleProducts.length === 0) return

      e.preventDefault()
      const currentIndex = orderedVisibleProducts.findIndex((p) => p.id === selectedProductId)
      const goingForward = e.key === 'ArrowDown' || e.key === 'ArrowRight'
      const nextIndex =
        currentIndex < 0
          ? 0
          : goingForward
            ? Math.min(currentIndex + 1, orderedVisibleProducts.length - 1)
            : Math.max(currentIndex - 1, 0)
      const nextProduct = orderedVisibleProducts[nextIndex]
      setSelectedProductId(nextProduct.id)
      document.getElementById(`product-row-${nextProduct.id}`)?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [orderedVisibleProducts, selectedProductId])

  function handleRemove(product: Product) {
    if (!confirm(`${product.name} kaldırılsın mı? Ürün stok listesinden kaldırılır, geçmiş hareketler saklanır.`)) return
    deactivateMutation.mutate(product.id)
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllChecked(rows: Product[], checkAll: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      for (const p of rows) {
        if (checkAll) next.add(p.id)
        else next.delete(p.id)
      }
      return next
    })
  }

  /** Sürükle-bırakla bırakılan satırın ait olduğu (Dermakor/Swiss) filtrelenmiş
   * listeye göre 10, 20, 30... yeni sort_order değerleri yazılır. */
  function handleReorder(reordered: Product[]) {
    reorderMutation.mutate(reordered.map((p, i) => ({ id: p.id, sort_order: (i + 1) * 10 })))
  }

  async function handleBulkRemove() {
    const selected = allProducts.filter((p) => checkedIds.has(p.id))
    if (selected.length === 0) return
    if (!confirm(`${selected.length} ürün kaldırılsın mı? Ürünler stok listesinden kaldırılır, geçmiş hareketler saklanır.`)) return
    for (const p of selected) {
      await deactivateMutation.mutateAsync(p.id)
    }
    setCheckedIds(new Set())
  }

  const resetAffectedCount = allProducts.filter((p) => p.current_quantity > 0 || p.flakon_quantity > 0).length

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const summary = await importProductRows(rows, allProducts)
    if (summary.added > 0 || (summary.updated ?? 0) > 0) await queryClient.invalidateQueries({ queryKey: ['products'] })
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
                { header: 'Paket', value: (p) => `${p.current_quantity} ${p.unit}` },
                { header: 'Flakon', value: (p) => p.flakon_quantity },
                {
                  header: 'Güncel Stok Durumu',
                  value: (p) => `${p.current_quantity} paket, ${p.flakon_quantity} flakon`,
                },
                { header: 'Satış Fiyatı', value: (p) => (p.unit_price ? Number(p.unit_price) : '') },
                { header: 'Kampanya', value: (p) => p.campaign ?? '' },
                { header: 'Barkod', value: (p) => p.barcode ?? '' },
                { header: 'Son Kullanım Tarihi', value: (p) => p.expiry_date ?? '' },
              ]}
            />
            <ImportMenu
              onImport={handleImport}
              templateFilename="stok-sablon"
              templateHeaders={PRODUCT_IMPORT_HEADERS}
              templateSampleRows={PRODUCT_IMPORT_SAMPLE_ROWS}
            />
            <SmartImportDialog
              title="Ürünleri Akıllı İçe Aktar"
              targetLabel="stok/ürün"
              fieldHeaders={PRODUCT_IMPORT_HEADERS}
              fieldHints={PRODUCT_IMPORT_FIELD_HINTS}
              onImport={handleImport}
            />
            <DailyMovementImportButton />
            <ResetAllStockDialog affectedCount={resetAffectedCount} />
            <ProductForm />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
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
          <TabsTrigger value="cargo">Kargo</TabsTrigger>
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

          {checkedIds.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">{checkedIds.size} ürün seçili</span>
              <Button variant="outline" size="sm" onClick={() => setCheckedIds(new Set())}>
                Seçimi Temizle
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleBulkRemove}
              >
                <Trash2 className="size-3.5" /> Seçilenleri Kaldır
              </Button>
            </div>
          )}

          {isLoading && <p className="text-muted-foreground py-8 text-center">Yükleniyor...</p>}

          {!isLoading && brandFilter === ALL_BRANDS && (
            <div className="grid gap-6">
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dermakor</h3>
                <ProductsTable
                  products={products.filter((p) => p.brand_line === 'dermakor')}
                  onRemove={handleRemove}
                  selectedId={selectedProductId}
                  onSelect={setSelectedProductId}
                  checkedIds={checkedIds}
                  onToggleChecked={toggleChecked}
                  onToggleAll={toggleAllChecked}
                  onReorder={handleReorder}
                />
              </div>
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Swiss</h3>
                <ProductsTable
                  products={products.filter((p) => p.brand_line === 'swiss')}
                  onRemove={handleRemove}
                  selectedId={selectedProductId}
                  onSelect={setSelectedProductId}
                  checkedIds={checkedIds}
                  onToggleChecked={toggleChecked}
                  onToggleAll={toggleAllChecked}
                  onReorder={handleReorder}
                />
              </div>
            </div>
          )}

          {!isLoading && brandFilter !== ALL_BRANDS && (
            <ProductsTable
              products={products}
              onRemove={handleRemove}
              selectedId={selectedProductId}
              onSelect={setSelectedProductId}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              onToggleAll={toggleAllChecked}
              onReorder={handleReorder}
            />
          )}
        </TabsContent>

        <TabsContent value="count">
          <DailyCountPanel />
        </TabsContent>

        <TabsContent value="card">
          <StockCardPanel />
        </TabsContent>

        <TabsContent value="cargo">
          <CargoPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
