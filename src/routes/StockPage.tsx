import * as React from 'react'
import { toast } from 'sonner'
import {
  Search,
  Trash2,
  Loader2,
  Check,
  Plus,
  Minus,
  ChevronDown,
  Settings2,
  FileDown,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductForm } from '@/features/stock/ProductForm'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import { StockMovementDialog } from '@/features/stock/StockMovementDialog'
import { StockHistoryDialog } from '@/features/stock/StockHistoryDialog'
import {
  useCreateProductCatalog,
  useDeactivateProduct,
  useDeleteProductCatalog,
  useProductCatalogs,
  useProducts,
  useRecordStockMovement,
  useReorderProducts,
  useUpdateProductCampaign,
  useUpdateProductCatalog,
  useUpdateProductCategory,
  useUpdateProductPrice,
  useUpdateProductPackageSize,
  useUpdateProductExpiry,
} from '@/features/stock/hooks'
import { DailyCountPanel } from '@/features/stockCounts/DailyCountPanel'
import { StockCardPanel } from '@/features/stock/StockCardPanel'
import { CargoPanel } from '@/features/cargo/CargoPanel'
import { DoctorAccountsPanel } from '@/features/stock/DoctorAccountsPanel'
import { CongressShipmentsPanel } from '@/features/congressShipments/CongressShipmentsPanel'
import { ZoomableThumbnail } from '@/components/ZoomableThumbnail'
import { cn } from '@/lib/utils'
import { getExpiryStatus } from '@/lib/expiry'
import type { BrandLine, Product, ProductCatalog } from '@/types/database'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import type { ProductPriceField } from '@/features/stock/api'
import { exportPriceListPdf, type PriceListKind } from '@/features/stock/exportPriceListPdf'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { fixShortYear } from '@/lib/fixShortYear'

const ALL_BRANDS = 'all'

/** Mevcut iki katalog (dermakor/swiss) veritabanında hâlâ küçük harf
 * saklanıyor (geçmiş veriyle/komisyon kurallarıyla uyumluluk bozulmasın diye
 * değiştirilmedi) — sadece görünüm için düzgün yazılıyor. Admin'in
 * ekleyeceği yeni kataloglar zaten yazdığı gibi görünür. */
function catalogLabel(name: string) {
  if (name === 'dermakor') return 'Dermakor'
  if (name === 'swiss') return 'Swiss'
  return name
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
 * Paket / flakon adedi ve fiyat hücrelerinin ortak yerinde düzenleyicisi
 * (kullanıcı isteği, 2026-10-14: "üzerine tıklayınca rakamın tamamı görünsün,
 * rakam silinmesin, o anki rakamı görüp eksiltip yükseltebilmeliyim"):
 *  - tıklayınca mevcut değer seçili gelmez (yazınca silinmesin diye), imleç
 *    sonda durur; kutu hücrenin tamamını kaplar, rakam kesilmez
 *  - altta − / + düğmeleri (ve klavyede ↑ / ↓) değeri `step` kadar değiştirir
 *  - Enter / ✓ / dışarı tıklama kaydeder, Esc vazgeçer
 * Ondalık için virgül de kabul edilir ("1500,50").
 */
function parseEditorNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function formatEditorNumber(n: number | null): string {
  if (n == null) return ''
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

function InlineNumberEditor({
  value,
  onChange,
  onCommit,
  onCancel,
  step = 1,
  decimals = false,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  step?: number
  decimals?: boolean
  placeholder?: string
}) {
  function bump(dir: 1 | -1) {
    const cur = parseEditorNumber(value)
    const base = cur == null || Number.isNaN(cur) ? 0 : cur
    onChange(formatEditorNumber(Math.max(0, base + dir * step)))
  }
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="flex w-full flex-col items-stretch gap-1">
      <Input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(decimals ? e.target.value.replace(/[^\d.,]/g, '') : e.target.value.replace(/\D/g, ''))}
        onFocus={(e) => {
          const el = e.currentTarget
          const end = el.value.length
          el.setSelectionRange(end, end)
        }}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit()
          } else if (e.key === 'Escape') {
            onCancel()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            bump(e.key === 'ArrowUp' ? 1 : -1)
          }
        }}
        className="h-8 w-full min-w-0 px-1.5 text-center tabular-nums"
      />
      <div className="flex items-center justify-center gap-1">
        <Button type="button" variant="outline" size="icon" className="size-7" onMouseDown={keepFocus} onClick={() => bump(-1)} title={`${step} azalt`}>
          <Minus className="size-3.5" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-7" onMouseDown={keepFocus} onClick={() => bump(1)} title={`${step} artır`}>
          <Plus className="size-3.5" />
        </Button>
        <Button type="button" size="icon" className="size-7" onMouseDown={keepFocus} onClick={onCommit} title="Kaydet">
          <Check className="size-3.5" />
        </Button>
      </div>
    </div>
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
      <InlineNumberEditor
        value={value}
        onChange={setValue}
        onCommit={commit}
        onCancel={() => {
          setValue(String(product.current_quantity))
          setEditing(false)
        }}
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
      <Badge variant={isCritical ? 'destructive' : 'secondary'} className={cn(isCritical && 'animate-alert-glow-red')}>
        {product.current_quantity > 0 ? `${product.current_quantity} Tam Paket` : '—'}
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
      <InlineNumberEditor
        value={value}
        onChange={setValue}
        onCommit={commit}
        onCancel={() => {
          setValue(String(product.flakon_quantity))
          setEditing(false)
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Flakon adedini düzenlemek için tıklayın"
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
    >
      <Badge variant="secondary">{product.flakon_quantity > 0 ? `${product.flakon_quantity} flakon` : '—'}</Badge>
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
        <CampaignBadge text={product.campaign} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </button>
  )
}

/** Stok > "Fiyat Listesi PDF" — kullanıcının fiyat listesi düzeninde, her marka tek A4 sayfa (bkz. exportPriceListPdf). */
function PriceListPdfMenu({ products }: { products: Product[] }) {
  const [busy, setBusy] = React.useState(false)
  async function run(kind: PriceListKind) {
    setBusy(true)
    try {
      await exportPriceListPdf(products, kind)
    } catch (err) {
      toast.error('Fiyat listesi oluşturulamadı', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} Fiyat Listesi PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('uninvoiced')}>Faturasız Fiyat Listesi (A4)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('invoiced')}>Faturalı (Satış Fiyatı) Fiyat Listesi (A4)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * SKT — tıklayınca takvimli tarih kutusu açılır, seçilen/yazılan tarih
 * kaydedilir (kullanıcı isteği, 2026-10-14: "SKT bölümlerinin üzerine
 * tıkladığımızda tarihleri yazabileyim"). Süresi geçmiş kırmızı, yaklaşan
 * turuncu rozet davranışı aynen korunuyor; boşaltıp kaydetmek SKT'yi siler.
 */
function ExpiryCell({ product, status }: { product: Product; status: ReturnType<typeof getExpiryStatus> }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(product.expiry_date ?? '')
  const mutation = useUpdateProductExpiry()

  React.useEffect(() => {
    if (!editing) setValue(product.expiry_date ?? '')
  }, [product.expiry_date, editing])

  function commit() {
    setEditing(false)
    const next = fixShortYear(value || null)
    if (next === (product.expiry_date ?? null)) return
    mutation.mutate({ id: product.id, expiry_date: next })
  }

  if (editing) {
    return (
      <Input
        type="date"
        autoFocus
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setValue(product.expiry_date ?? '')
            setEditing(false)
          }
        }}
        className="mx-auto h-8 w-36"
      />
    )
  }

  const label = product.expiry_date ? product.expiry_date.split('-').reverse().join('.') : null
  return (
    <button
      type="button"
      title="SKT'yi yazmak / değiştirmek için tıklayın"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className="rounded-md px-1 py-0.5 hover:bg-accent"
    >
      {label ? (
        <Badge variant={status === 'expired' ? 'destructive' : status === 'soon' ? 'warning' : 'outline'}>{label}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </button>
  )
}

/**
 * Boyut / içerik ("6 X 6 ML", "1 X 5 ML"…) — ürün adından sonra ayrı sütun
 * (kullanıcı isteği, 2026-10-02). Tüm kullanıcılar tıklayıp düzenler (2026-10-14).
 */
function PackageSizeCell({ product }: { product: Product }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(product.package_size ?? '')
  const mutation = useUpdateProductPackageSize()

  React.useEffect(() => {
    if (!editing) setValue(product.package_size ?? '')
  }, [product.package_size, editing])

  function commit() {
    setEditing(false)
    const next = value.trim().toLocaleUpperCase('tr-TR')
    if (next === (product.package_size ?? '')) return
    mutation.mutate({ id: product.id, package_size: next || null })
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        placeholder="Örn. 6 X 6 ML"
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setValue(product.package_size ?? '')
            setEditing(false)
          }
        }}
        className="h-8 w-36"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      title="Boyutu düzenlemek için tıklayın"
      className="-mx-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent"
    >
      {product.package_size || '—'}
    </button>
  )
}

/**
 * Kampanya — fiyat listesi PDF'indeki gibi dar ve derli toplu (kullanıcı
 * isteği, 2026-10-02: "kampanya kısmı daha küçük sütunda olmalı, benim PDF
 * yaptığım gibi"): " · " ile ayrılmış kademeler ("10+2 · 20+5 · 30+8") küçük
 * yazıyla alt alta, ortalı. Kırmızı yazı, şeffaf zemin (2026-10-02).
 */
function CampaignBadge({ text }: { text: string }) {
  const parts = text.split(/\s*·\s*/).filter(Boolean)
  return (
    <span className="mx-auto inline-flex w-full max-w-48 flex-col items-center px-2 py-1 text-center text-xs leading-snug font-medium break-words whitespace-normal text-destructive">
      {parts.map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </span>
  )
}

/**
 * Fiyata tıklayınca yerinde düzenlenebilir hale gelir — `field` ile satış
 * fiyatı (unit_price) ya da faturasız fiyat (unit_price_uninvoiced, 2026-10-02)
 * seçilir; marj sadece satış fiyatında gösterilir.
 */
function PriceCell({ product, field = 'unit_price' }: { product: Product; field?: ProductPriceField }) {
  // Satış fiyatı ve faturasız fiyatı tüm aktif personel düzenleyebilir
  // (kullanıcı isteği, 2026-10-14; veritabanı tetikleyicisi de buna göre
  // güncellendi — migration 20261014113428).
  const price = product[field]
  const label = field === 'unit_price' ? 'Satış fiyatını' : 'Faturasız fiyatı'
  const [editing, setEditing] = React.useState(false)
  const current = formatEditorNumber(price != null ? Number(price) : null)
  const [value, setValue] = React.useState(current)
  const mutation = useUpdateProductPrice()

  React.useEffect(() => {
    if (!editing) setValue(current)
  }, [current, editing])

  function commit() {
    setEditing(false)
    const parsed = parseEditorNumber(value)
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setValue(current)
      return
    }
    if (parsed === (price != null ? Number(price) : null)) return
    mutation.mutate({ id: product.id, unit_price: parsed, field })
  }

  if (editing) {
    return (
      <InlineNumberEditor
        value={value}
        onChange={setValue}
        onCommit={commit}
        onCancel={() => {
          setValue(formatEditorNumber(price != null ? Number(price) : null))
          setEditing(false)
        }}
        step={10}
        decimals
        placeholder="Örn. 1500"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={`${label} düzenlemek için tıklayın`}
      className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
    >
      {price ? (
        <>
          <span className="font-semibold text-foreground tabular-nums">
            {`${Number(price).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`}
          </span>
          {field === 'unit_price' && product.unit_cost != null && Number(price) > 0 && (
            <span className="text-xs text-success">
              (%
              {Math.round(((Number(price) - Number(product.unit_cost)) / Number(price)) * 100)}{' '}
              marj)
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
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
const PRODUCT_COL_WIDTHS = [44, 68, 40, 180, 140, 160, 96, 90, 176, 110, 134, 192, 120, 340]
const PRODUCT_TABLE_WIDTH = PRODUCT_COL_WIDTHS.reduce((a, b) => a + b, 0)

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
        {/* Dermakor / Swiss tablolarında sütunlar yukarıdan aşağıya hizalı olsun diye
            (kullanıcı isteği, 2026-10-14) sabit genişlikli tablo düzeni — her
            iki tablo aynı PRODUCT_COL_WIDTHS'i kullanır. */}
        <Table className="table-fixed" style={{ width: PRODUCT_TABLE_WIDTH, minWidth: PRODUCT_TABLE_WIDTH }}>
          <colgroup>
            {PRODUCT_COL_WIDTHS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow>
              {/* Sıra numarası — kullanıcı isteği, 2026-08-28: "toplam kaç
                  ürün olduğunu sayılara bakarak anlarım". Katalog başına ayrı
                  bir ProductsTable render edildiği için (bkz. StockPage'in
                  ALL_BRANDS görünümü) index+1 zaten o kataloğun kendi sırası —
                  her katalogda 1'den başlar. */}
              <TableHead className="w-10 text-center text-muted-foreground">No</TableHead>
              <TableHead></TableHead>
              <TableHead>
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(v) => onToggleAll(products, v === true)}
                  aria-label="Tümünü seç"
                />
              </TableHead>
              <TableHead className="border-l">Ürün</TableHead>
              <TableHead className="border-l text-center">Boyut</TableHead>
              <TableHead className="border-l text-center">Kategori</TableHead>
              <TableHead className="border-l text-center leading-tight whitespace-normal">
                Tam Paket
                <br />
                (Kutu)
              </TableHead>
              <TableHead className="border-l text-center">Flakon</TableHead>
              <TableHead className="border-l text-center">Güncel Stok Durumu</TableHead>
              <TableHead className="border-l text-center">Satış Fiyatı</TableHead>
              <TableHead className="border-l text-center">Faturasız Fiyat</TableHead>
              <TableHead className="w-48 min-w-48 border-l text-center">Kampanya</TableHead>
              <TableHead className="border-l text-center">SKT</TableHead>
              <TableHead className="border-l text-center">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={PRODUCT_COL_WIDTHS.length} className="py-8 text-center text-muted-foreground">
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
                    // Ürünler arasında belirgin tablo çizgisi (kullanıcı isteği,
                    // 2026-10-02: "ürünler arasına tablo gibi çizgi koy, karışıyor").
                    // Dikey çizgilerle (td border-l) aynı renk ve kalınlıkta alt çizgi —
                    // her hücreye veriliyor ki satır arka planları çizgiyi örtmesin.
                    '[&>td]:border-b [&>td]:border-border',
                    // Kritik/süresi geçmiş rengi (bg-destructive/5) seçiliyken
                    // ATLANIYOR — aksi halde TableRow'un seçili-satır
                    // koyulaştırması twMerge birleştirmesinde bu renk
                    // tarafından ezilip görünmez oluyordu.
                    (isCritical || expiryStatus === 'expired') && product.id !== selectedId && 'bg-destructive/5',
                  )}
                >
                  <TableCell className="text-center text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  {/* Sıra: No → görsel (biraz büyük) → seçim kutusu (kullanıcı
                      isteği, 2026-10-14: "başka bir şey olmasın" — sürükleme
                      tutamacı kaldırıldı; sıralama için satırın kendisi hâlâ
                      sürüklenebilir). */}
                  <TableCell>
                    <ZoomableThumbnail
                      src={product.image_url}
                      alt={product.name}
                      className="size-12 max-w-none shrink-0 rounded-md border-2 border-muted-foreground/30 bg-muted object-cover"
                      fallback={<div className="size-12 shrink-0 rounded-md border-2 border-muted-foreground/30 bg-muted" />}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checkedIds.has(product.id)}
                      onCheckedChange={() => onToggleChecked(product.id)}
                      aria-label={`${product.name} seç`}
                    />
                  </TableCell>
                  <TableCell className="border-l font-medium">
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
                  <TableCell className="border-l text-center whitespace-nowrap">
                    <PackageSizeCell product={product} />
                  </TableCell>
                  <TableCell className="border-l text-center">
                    <CategoryCell product={product} />
                  </TableCell>
                  <TableCell className="border-l text-center">
                    <QuantityCell product={product} />
                  </TableCell>
                  <TableCell className="border-l text-center">
                    <FlakonQuantityCell product={product} />
                  </TableCell>
                  <TableCell className="border-l text-center">
                    {/* Sabit genişlikli paket VE flakon sütunları — kullanıcı
                        raporu, 2026-08-28: "yamuk yumuk sayılar düzenli
                        olmalı" + "tam ortalı değil". Metin uzunluğu satırdan
                        satıra değiştiği için (ör. "5 paket" / "44 paket" /
                        "—", "1 flakon" / "—") her iki tarafa da sabit genişlik
                        (w-14) verilmezse ya ayraç ya da ortalanan grubun
                        toplam genişliği satırdan satıra kayıyordu. İkisi de
                        sabit olunca hem ayraç her satırda tam aynı X'te hem de
                        justify-center ile grup her satırda tam aynı yerde
                        ortalanıyor. Uyarı ikonu kasıtlı olarak yok — kritik
                        durumda sadece rakamlar kırmızı + yanıp sönüyor
                        (kullanıcı isteği, 2026-08-28: "emojilerini kaldır ...
                        rakamlar kırmızı olsun yanıp sönsün"). Ayraç kısa/satır
                        içi — Paket ve Flakon zaten kendi gerçek sütunlarında
                        (tam yükseklikte border-l ile) ayrı gösteriliyor,
                        burada uzun bir çizgiye gerek yok (kullanıcı isteği,
                        2026-08-28: "bu kısımda yukarıdan aşağıya uzun çizgiler
                        olmasın"). */}
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span
                        className={cn(
                          'w-24 shrink-0 text-right',
                          isCritical &&
                            product.current_quantity > 0 &&
                            'font-medium text-destructive animate-alert-glow-red',
                        )}
                      >
                        {product.current_quantity > 0 ? `${product.current_quantity} tam paket` : '—'}
                      </span>
                      <span className="border-border h-4 border-l" />
                      <span className="w-14 shrink-0 text-left">
                        {product.flakon_quantity > 0 ? `${product.flakon_quantity} flakon` : '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="border-l text-center">
                    <PriceCell product={product} />
                  </TableCell>
                  <TableCell className="border-l text-center">
                    <PriceCell product={product} field="unit_price_uninvoiced" />
                  </TableCell>
                  <TableCell className="w-48 min-w-48 max-w-48 overflow-hidden border-l text-center whitespace-normal">
                    <CampaignCell product={product} />
                  </TableCell>
                  <TableCell className="border-l text-center">
                    {/* Takvim ikonu kasıtlı olarak yok — sadece kritikte
                        (süresi geçmiş/yaklaşan) rozet kırmızı/turuncu kalıyor
                        (kullanıcı isteği, 2026-08-28: "takvim simgesi olmasın
                        sadece kritiklerde kırmızı olarak kalsın tarih"). */}
                    <ExpiryCell product={product} status={expiryStatus} />
                  </TableCell>
                  <TableCell className="border-l">
                    <div className="flex justify-center gap-2">
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

/** Kullanıcı isteğiyle (2026-08-17) — Dermakor/Swiss'e sınırlı kalmasın diye
 * admin buradan yeni bir katalog/ürün hattı ekleyebiliyor; personel sadece
 * mevcut katalogları görür/filtreler, ekleme butonu admin'e özel. */
/**
 * Katalog adı satır-içi düzenlenebilir (tıkla-düzenle), altında açılıp
 * kapanan bölümde o kataloğa ait PDF/resim belgeleri (AttachmentsPanel,
 * ownerType='product_catalog') var. brand_line → product_catalogs.name FK'i
 * `on update cascade` olduğu için isim değişince ürünlerin brand_line'ı
 * otomatik güncelleniyor, ekstra bir senkron gerekmiyor. Silme ise
 * `on delete set null` — katalog silinince o katalogdaki ürünler kategori
 * bağlantısını kaybeder ama kendileri silinmez.
 */
function CatalogRow({ catalog }: { catalog: ProductCatalog }) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(catalog.name)
  const [showDocs, setShowDocs] = React.useState(false)
  const updateMutation = useUpdateProductCatalog()
  const deleteMutation = useDeleteProductCatalog()
  const { confirm, dialog } = useConfirmDialog()

  function commitName() {
    setEditing(false)
    const trimmed = name.trim()
    if (!trimmed || trimmed === catalog.name) {
      setName(catalog.name)
      return
    }
    updateMutation.mutate({ id: catalog.id, name: trimmed })
  }

  async function handleDelete() {
    if (
      !(await confirm(
        `"${catalog.name}" kataloğu silinsin mi? Bu katalogdaki ürünler kategori bağlantısını kaybeder, ürünlerin kendisi silinmez.`,
      ))
    )
      return
    deleteMutation.mutate(catalog.id)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowDocs((v) => !v)}
          title="Belgeleri göster/gizle"
          className="shrink-0 rounded p-1 hover:bg-accent"
        >
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', showDocs && 'rotate-180')} />
        </button>
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitName()
              }
              if (e.key === 'Escape') {
                setName(catalog.name)
                setEditing(false)
              }
            }}
            className="h-8 flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Adı düzenlemek için tıklayın"
            className="flex-1 rounded px-1 py-0.5 text-left text-sm font-medium hover:bg-accent"
          >
            {catalog.name}
          </button>
        )}
        <Button variant="ghost" size="icon" onClick={handleDelete} title="Kataloğu sil">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      {showDocs && (
        <div className="mt-3 border-t pt-3">
          <AttachmentsPanel ownerType="product_catalog" ownerId={catalog.id} />
        </div>
      )}
      {dialog}
    </div>
  )
}

function ManageCatalogsDialog({ catalogs }: { catalogs: ProductCatalog[] }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 className="size-3.5" /> Katalogları Yönet
      </Button>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Katalogları Yönet</DialogTitle>
          <DialogDescription>
            İsimlendirmeyi değiştirin, PDF/resim belgesi ekleyin ya da katalog silin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {catalogs.length === 0 && <p className="text-muted-foreground text-sm">Henüz katalog yok.</p>}
          {catalogs.map((c) => (
            <CatalogRow key={c.id} catalog={c} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddCatalogDialog({ existingNames }: { existingNames: string[] }) {
  const createCatalog = useCreateProductCatalog()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  const trimmed = name.trim()
  const duplicate = trimmed.length > 0 && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  async function handleAdd() {
    if (!trimmed || duplicate) return
    await createCatalog.mutateAsync(trimmed)
    setName('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setName('') }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> Yeni Katalog
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Katalog Ekle</DialogTitle>
          <DialogDescription>Ürün hattı/marka olarak eklenir, "Tümü" sekmesinde ayrı bir grup olarak görünür.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-catalog-name">Katalog Adı</Label>
          <Input
            id="new-catalog-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Acme Kozmetik"
            autoFocus
          />
          {duplicate && <p className="text-destructive text-xs">Bu isimde bir katalog zaten var.</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleAdd} disabled={!trimmed || duplicate || createCatalog.isPending}>
            {createCatalog.isPending && <Loader2 className="animate-spin" />}
            Ekle
          </Button>
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

  // Dermakor / Swiss (katalog) tabloları yatayda BİRLİKTE kaysın (kullanıcı
  // isteği, 2026-10-02) — birinin kaydırma kutusu kayınca diğerleri aynı
  // scrollLeft'e eşitlenir.
  const groupsRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const root = groupsRef.current
    if (!root) return
    const boxes = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="table-container"]'))
    if (boxes.length < 2) return
    const handlers = boxes.map((box) => {
      // Sadece konum farklıysa eşitlenir — eşitlenen kutunun kendi scroll
      // olayı geldiğinde konumlar zaten aynı olduğu için döngü oluşmaz.
      const onScroll = () => {
        for (const other of boxes) if (other !== box && Math.abs(other.scrollLeft - box.scrollLeft) > 1) other.scrollLeft = box.scrollLeft
      }
      box.addEventListener('scroll', onScroll, { passive: true })
      return [box, onScroll] as const
    })
    return () => handlers.forEach(([box, fn]) => box.removeEventListener('scroll', fn))
  })
  const { data: catalogs = [] } = useProductCatalogs()
  // Tümü/Dermakor/Swiss sekme sırası sabit kalsın diye (kullanıcı isteğiyle,
  // 2026-08-23 — sonradan eklenen kataloglar o sırayı kalabalıklaştırmasın)
  // — admin'in ekleyeceği yeni kataloglar ayrı bir "Diğer Kataloglar"
  // açılır listesinde gösteriliyor, "Tümü" görünümündeki gruplu listeleme
  // hâlâ TÜM katalogları (pinned + diğer) kapsıyor.
  const pinnedCatalogs = React.useMemo(() => catalogs.filter((c) => c.name === 'dermakor' || c.name === 'swiss'), [catalogs])
  const otherCatalogs = React.useMemo(() => catalogs.filter((c) => c.name !== 'dermakor' && c.name !== 'swiss'), [catalogs])
  const deactivateMutation = useDeactivateProduct()
  const reorderMutation = useReorderProducts()
  const { confirm, dialog } = useConfirmDialog()

  // Ekranda o an görünen ürün satırlarının GERÇEK dikey sırası — ALL_BRANDS
  // filtresinde katalog başına bir ProductsTable render edildiği için,
  // klavye ok tuşlarının render sırasıyla birebir eşleşmesi için aynı bölme
  // mantığı burada da uygulanıyor. Hiçbir katalogla eşleşmeyen ("Diğer")
  // ürünler artık "Tümü" görünümünde HİÇ gösterilmiyor (kullanıcı isteği,
  // 2026-08-27: "stok ve günlükten diğer kısmını kaldır") — bu yüzden burada
  // da dahil edilmiyor, aksi halde ok tuşuyla ekranda hiç görünmeyen bir
  // satıra atlamaya çalışırdı.
  const orderedVisibleProducts = React.useMemo(() => {
    if (brandFilter === ALL_BRANDS) {
      return catalogs.flatMap((c) => products.filter((p) => p.brand_line === c.name))
    }
    return products
  }, [products, brandFilter, catalogs])

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
      // AppShell'deki sol menü ok-tuşu odak gezinmesiyle çakışmasın diye
      // capture aşamasında yakalanıp durduruluyor — Stok sayfasındayken ok
      // tuşları önce ürün satırları arasında gezinsin.
      e.stopPropagation()
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
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [orderedVisibleProducts, selectedProductId])

  async function handleRemove(product: Product) {
    if (!(await confirm(`${product.name} kaldırılsın mı? Ürün stok listesinden kaldırılır, geçmiş hareketler saklanır.`)))
      return
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
    if (
      !(await confirm(`${selected.length} ürün kaldırılsın mı? Ürünler stok listesinden kaldırılır, geçmiş hareketler saklanır.`))
    )
      return
    for (const p of selected) {
      await deactivateMutation.mutateAsync(p.id)
    }
    setCheckedIds(new Set())
  }

  return (
    <div>
      <PageHeader title="Stok" description="Ürün kataloğunu ve stok seviyelerini yönetin" />

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products">Ürünler</TabsTrigger>
          <TabsTrigger value="count">Günlük Sayım</TabsTrigger>
          <TabsTrigger value="card">Stok Kartı</TabsTrigger>
          <TabsTrigger value="congress">Kongre/Workshop</TabsTrigger>
          <TabsTrigger value="cargo">Kargo</TabsTrigger>
          <TabsTrigger value="accounts">Doktor Hesapları</TabsTrigger>
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
                {pinnedCatalogs.map((c) => (
                  <TabsTrigger key={c.id} value={c.name}>
                    {catalogLabel(c.name)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {otherCatalogs.length > 0 && (
              <Select
                value={otherCatalogs.some((c) => c.name === brandFilter) ? brandFilter : ''}
                onValueChange={(v) => setBrandFilter(v as typeof brandFilter)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Diğer Kataloglar" />
                </SelectTrigger>
                <SelectContent>
                  {otherCatalogs.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {catalogLabel(c.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ProductForm
              trigger={
                <Button size="sm">
                  <Plus className="size-3.5" /> Yeni Ürün Ekle
                </Button>
              }
            />
            <AddCatalogDialog existingNames={catalogs.map((c) => c.name)} />
            <ManageCatalogsDialog catalogs={catalogs} />
            <PriceListPdfMenu products={allProducts} />
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
            <div ref={groupsRef} className="grid gap-6">
              {catalogs.map((c) => (
                <div key={c.id} className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {catalogLabel(c.name)}
                  </h3>
                  <ProductsTable
                    products={products.filter((p) => p.brand_line === c.name)}
                    onRemove={handleRemove}
                    selectedId={selectedProductId}
                    onSelect={setSelectedProductId}
                    checkedIds={checkedIds}
                    onToggleChecked={toggleChecked}
                    onToggleAll={toggleAllChecked}
                    onReorder={handleReorder}
                  />
                </div>
              ))}
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

        <TabsContent value="congress">
          <CongressShipmentsPanel />
        </TabsContent>

        <TabsContent value="cargo">
          <CargoPanel />
        </TabsContent>

        <TabsContent value="accounts">
          <DoctorAccountsPanel />
        </TabsContent>
      </Tabs>
      {dialog}
    </div>
  )
}
