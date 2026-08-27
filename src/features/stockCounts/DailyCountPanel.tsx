import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck,
  CheckCircle2,
  Loader2,
  Undo2,
  ShoppingCart,
  UserRound,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Printer,
  ImageDown,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExportMenu } from '@/components/ExportMenu'
import { useSales, useUpdateSaleRep, useDeleteSale } from '@/features/sales/hooks'
import { deleteSale } from '@/features/sales/api'
import { SaleForm } from '@/features/sales/SaleForm'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useSalesReps } from '@/features/salesReps/hooks'
import {
  useAddCountItem,
  useCompleteCount,
  useCountItems,
  useDeleteCountItem,
  useDeleteStockCount,
  usePastCounts,
  useReopenCount,
  useSetCountStatus,
  useStartTodayCount,
  useTodayCount,
  useUndoCompleteCount,
  useUpdateCountDate,
  useUpdateCountItem,
  useUpdateCountItemFlakon,
} from './hooks'
import { exportDailyCountToExcel, exportDailyCountToPdf, exportDailyCountToWord, printDailyCount } from './exportDailyCount'
import { exportDailySummaryImage } from './exportSummaryImage'
import { todayDate, type StockCountItemWithProduct } from './api'
import type { SaleWithRelations } from '@/features/sales/api'
import type { StockCount } from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

const NO_REP = '__none__'

/** "Son Günlerin Stoğu" tablosunda her gün ayrı bir renkle yazılsın diye
 * (kullanıcı isteği, 2026-08-22) — tema CSS değişkenlerine bağlı, karanlık
 * modda da okunaklı 3 semantik renk (marka/başarı/uyarı). */
const DAY_COLOR_CLASSES = ['text-primary', 'text-success', 'text-warning']

/** "Sistemdeki Miktar" / "Son Sayım" / "O Günkü Stok" gibi taban hücreleri için —
 * paket ve flakon ikisi de 0 ise "—"; sadece biri 0 olan tarafta o taraf hiç
 * yazılmaz (kullanıcı isteğiyle, 2026-08-23 — "0 olanlar hiç yazmasın", önceden
 * paket 0 olduğunda "—, 1 Flakon" gibi gereksiz bir "—" görünüyordu). */
function baselineLabel(paket: number, flakon: number): string {
  if (paket <= 0 && flakon <= 0) return '—'
  if (paket <= 0) return `${flakon} Flakon`
  return flakon > 0 ? `${paket} Paket, ${flakon} Flakon` : `${paket} Paket`
}

/** Son Stok: paket ve flakon ikisi de 0 ise "—"; sadece biri 0 olan tarafta o taraf
 * hiç yazılmaz (kullanıcı isteğiyle, 2026-08-23 — "0 olanlar hiç yazmasın", önceden
 * paket 0 olduğunda tüm hücre "—" oluyor, flakon miktarı hiç görünmüyordu). İkisi
 * de doluysa "6 Paket - 4 Flakon", parantez kullanılmıyor. */
function finalStockLabel(paket: number, flakon: number): string {
  if (paket <= 0 && flakon <= 0) return '—'
  if (paket <= 0) return `${flakon} Flakon`
  return flakon > 0 ? `${paket} Paket - ${flakon} Flakon` : `${paket} Paket`
}

/** Bugün girilen tam sayım varsa onu, yoksa (henüz sayılmadı) tabanı (önceki
 * sayım / ilk sayımsa canlı stok) döndürür — "adetler aynıysa dünkü sayımla
 * eklemeden yaz" kuralı (kullanıcı isteği, 2026-08-22). */
function resolveCounted(baseline: number, counted: number | null): number {
  return counted ?? baseline
}

/**
 * Günün Satış/İade Hareketleri panelindeki tek bir satır — satış temsilcisini
 * (iadeyi alan / teslim eden) yerinde değiştirmeyi ve kaydı iptal etmeyi
 * (stok etkisini tersine çevirip kaydı silmeyi, bkz. SalesPage.tsx'teki aynı
 * desen) destekler.
 */
function SalesActivityRow({ sale, repRoleLabel }: { sale: SaleWithRelations; repRoleLabel: string }) {
  const { data: salesReps = [] } = useSalesReps()
  const updateRepMutation = useUpdateSaleRep()
  const deleteMutation = useDeleteSale()
  const { confirm, dialog } = useConfirmDialog()

  // Stok etkisi delete_sale RPC'si tarafında tersine çevriliyor (bkz.
  // SalesPage.tsx'teki aynı desen) — burada ayrıca çağırmaya gerek yok.
  async function handleCancel() {
    if (
      !(await confirm(
        `${sale.product_name} (${sale.quantity} adet) ${sale.type === 'sale' ? 'satış' : 'iade'} kaydı iptal edilsin mi? Stok buna göre düzeltilecek.`,
      ))
    )
      return
    deleteMutation.mutate(sale.id)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{sale.customers?.full_name ?? '—'}</span>
        <span className="text-muted-foreground">
          {' '}
          — {sale.product_name} × {sale.quantity}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{repRoleLabel}:</span>
        <Select
          value={sale.sales_rep_id ?? NO_REP}
          onValueChange={(value) => updateRepMutation.mutate({ id: sale.id, salesRepId: value === NO_REP ? null : value })}
        >
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REP}>Belirtilmedi</SelectItem>
            {salesReps
              .filter((r) => r.is_active)
              .map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <SaleForm sale={sale} />
        <Button variant="ghost" size="icon" className="size-7" onClick={handleCancel} title="İptal Et">
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
      {dialog}
    </div>
  )
}

function TodaySalesActivity({ countDate }: { countDate: string }) {
  const { data: sales = [] } = useSales()
  const todaySales = sales.filter((s) => s.sale_date === countDate)
  const queryClient = useQueryClient()
  const [deletingAll, setDeletingAll] = React.useState(false)
  const { confirm: confirmDeleteAll, dialog: deleteAllDialog } = useConfirmDialog()

  const returns = todaySales.filter((s) => s.type === 'return')
  const outgoing = todaySales.filter((s) => s.type === 'sale')

  const byRep = React.useMemo(() => {
    const map = new Map<string, { name: string; sale: number; returnQty: number }>()
    for (const s of todaySales) {
      const name = s.sales_reps?.name ?? 'Belirtilmemiş'
      const entry = map.get(name) ?? { name, sale: 0, returnQty: 0 }
      if (s.type === 'sale') entry.sale += s.quantity
      else entry.returnQty += s.quantity
      map.set(name, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.sale + b.returnQty - (a.sale + a.returnQty))
  }, [todaySales])

  // Bugüne ait TÜM satış/iade kayıtlarını tek seferde temizler (kullanıcı
  // isteği, 2026-08-27) — her kayıt kendi delete_sale RPC'siyle (stok etkisi
  // tersine çevrilerek) tek tek silinir; useDeleteSale hook'unu değil doğrudan
  // api fonksiyonunu kullanıyoruz ki her satır için ayrı "Silindi" toast'ı
  // yığılmasın, sonunda tek bir özet toast'ı gösterilsin.
  async function handleDeleteAll() {
    if (
      !(await confirmDeleteAll(
        `Bugüne (${countDate}) ait ${todaySales.length} satış/iade kaydının TÜMÜ silinsin mi? Her kayıt için stok ayrı ayrı geri düzeltilecek.`,
        { title: 'Tümünü Sil', confirmLabel: 'Tümünü Sil', variant: 'destructive' },
      ))
    )
      return
    setDeletingAll(true)
    try {
      for (const s of todaySales) {
        await deleteSale(s.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(`${todaySales.length} kayıt silindi`)
    } catch (error) {
      toast.error('Bazı kayıtlar silinemedi', { description: getErrorMessage(error) })
    } finally {
      setDeletingAll(false)
    }
  }

  if (todaySales.length === 0) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Günün Satış / İade Hareketleri</CardTitle>
          <SaleForm />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Bugün için kayıtlı satış veya iade yok.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Günün Satış / İade Hareketleri</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDeleteAll} disabled={deletingAll}>
            {deletingAll ? <Loader2 className="animate-spin" /> : <Trash2 className="text-destructive" />}
            Tümünü Sil
          </Button>
          <SaleForm />
          {deleteAllDialog}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
            <Undo2 className="size-3.5" /> İade Gelenler (Doktora Göre)
          </p>
          <div className="grid gap-2">
            {returns.length === 0 && <p className="text-muted-foreground text-sm">Bugün iade yok</p>}
            {returns.map((s) => (
              <SalesActivityRow key={s.id} sale={s} repRoleLabel="Alan" />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
            <ShoppingCart className="size-3.5" /> Doktorlara Çıkanlar
          </p>
          <div className="grid gap-2">
            {outgoing.length === 0 && <p className="text-muted-foreground text-sm">Bugün çıkan ürün yok</p>}
            {outgoing.map((s) => (
              <SalesActivityRow key={s.id} sale={s} repRoleLabel="Teslim eden" />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
            <UserRound className="size-3.5" /> Satış Temsilcisi Bazında
          </p>
          <div className="grid gap-2">
            {byRep.length === 0 && <p className="text-muted-foreground text-sm">Bugün hareket yok</p>}
            {byRep.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="flex gap-2">
                  {r.sale > 0 && <Badge variant="secondary">Sattığı: {r.sale}</Badge>}
                  {r.returnQty > 0 && (
                    <Badge variant="outline" className="border-destructive/30 text-destructive">
                      Aldığı iade: {r.returnQty}
                    </Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Tek satırda hem paket hem flakon sayımı — önceden iki ayrı panelde (Paket
 * Sayımı / Flakon Sayımı) aynı ürün satırları tekrarlanıyordu; kullanıcı
 * kaydırırken hangi ürünün hangi tabloda olduğunu takip etmek zor olduğu için
 * tek tabloda birleştirildi. "Sistemdeki Miktar" artık bir önceki TAMAMLANMIŞ
 * sayımın Son Stok değeri (baseline prop) — canlı products stoğu değil
 * (kullanıcı isteğiyle, 2026-08-22). Paket/Flakon kutusu bugünkü TAM sayımı
 * ifade eder: taban ile aynıysa Son Stok hiçbir şey eklemeden aynı rakamı
 * gösterir, farklıysa Son Stok bugün girilen yeni rakamı gösterir (aradaki
 * fark Sayımı Tamamla'da bir stok hareketi olarak uygulanır, bkz. api.ts).
 */
function CountItemRow({
  item,
  baseline,
  readOnly,
  selected,
  onSelect,
  onSavePaket,
  onSaveFlakon,
  onDelete,
  nextItemId,
}: {
  item: StockCountItemWithProduct
  baseline: { paket: number; flakon: number }
  readOnly: boolean
  selected: boolean
  onSelect: (id: string) => void
  onSavePaket: (id: string, value: number | null) => void
  onSaveFlakon: (id: string, value: number | null) => void
  onDelete: (item: StockCountItemWithProduct) => void
  /** Enter'la aşağı satıra geçebilmek için (kullanıcı isteği, 2026-08-22) —
   * Paket→Flakon→bir sonraki satırın Paket'i, StockMovementDialog'daki aynı
   * Enter-ile-ilerleme deseni (bkz. o dosyadaki quantityInputRef). */
  nextItemId?: string
}) {
  const [paketValue, setPaketValue] = React.useState(item.counted_quantity?.toString() ?? '')
  const [flakonValue, setFlakonValue] = React.useState(item.counted_quantity_flakon?.toString() ?? '')
  // "Bugünkü Stok" henüz elle sayılmadıysa geçmiş sayımın (baseline) değil,
  // CANLI ürün stoğunun karşılığı olmalı — aksi halde gün içinde "Günün
  // Satış/İade Hareketleri"nden girilen bir satış/iade burada hiç
  // görünmüyordu (kullanıcı isteği, 2026-08-24: "girilen ya da çıkılan ürün
  // güncel son stoktan düşmüyor/eklenmiyor"). "Son Sayım" sütunu ve aşağıdaki
  // "dünkü sayımdan az" uyarısı bilerek hâlâ baseline (geçmiş sayım) kullanıyor
  // — o, ayrı bir karşılaştırma amacı taşıyor.
  const finalPaket = resolveCounted(item.products.current_quantity, paketValue === '' ? null : Number(paketValue))
  const finalFlakon = resolveCounted(item.products.flakon_quantity, flakonValue === '' ? null : Number(flakonValue))
  const { confirm: confirmLowCount, dialog: lowCountDialog } = useConfirmDialog()

  // Dünkü sayımdan (baseline) daha az girilirse — yanlışlıkla eksik yazılmış
  // olabilir diye — "Tamam, Devam Et" onayı istiyoruz (kullanıcı isteği,
  // 2026-08-23). Onaylanmazsa girilen değer eski hâline geri alınır.
  async function handleBlurPaket() {
    const next = paketValue === '' ? null : Number(paketValue)
    if (next != null && next < baseline.paket) {
      const ok = await confirmLowCount(
        `${item.products.name} için girilen paket miktarı (${next}) dünkü sayımdan (${baseline.paket}) az. Devam edilsin mi?`,
        { title: 'Dikkat', confirmLabel: 'Tamam, Devam Et', variant: 'default' },
      )
      if (!ok) {
        setPaketValue(item.counted_quantity?.toString() ?? '')
        return
      }
    }
    onSavePaket(item.id, next)
  }

  async function handleBlurFlakon() {
    const next = flakonValue === '' ? null : Number(flakonValue)
    if (next != null && next < baseline.flakon) {
      const ok = await confirmLowCount(
        `${item.products.name} için girilen flakon miktarı (${next}) dünkü sayımdan (${baseline.flakon}) az. Devam edilsin mi?`,
        { title: 'Dikkat', confirmLabel: 'Tamam, Devam Et', variant: 'default' },
      )
      if (!ok) {
        setFlakonValue(item.counted_quantity_flakon?.toString() ?? '')
        return
      }
    }
    onSaveFlakon(item.id, next)
  }

  React.useEffect(() => {
    setPaketValue(item.counted_quantity?.toString() ?? '')
  }, [item.counted_quantity])

  React.useEffect(() => {
    setFlakonValue(item.counted_quantity_flakon?.toString() ?? '')
  }, [item.counted_quantity_flakon])

  return (
    <TableRow onClick={() => onSelect(item.id)} selected={selected}>
      <TableCell className="font-medium">{item.products.name}</TableCell>
      <TableCell className="font-bold text-foreground">
        {baselineLabel(baseline.paket, baseline.flakon)}
      </TableCell>
      <TableCell className="border-l">
        {readOnly ? (
          <span>{item.counted_quantity != null ? `${item.counted_quantity} Paket` : '—'}</span>
        ) : (
          <Input
            id={`count-paket-${item.id}`}
            type="number"
            min="0"
            className="w-20"
            placeholder={String(item.products.current_quantity)}
            value={paketValue}
            onChange={(e) => setPaketValue(e.target.value)}
            onBlur={handleBlurPaket}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                document.getElementById(`count-flakon-${item.id}`)?.focus()
              }
            }}
          />
        )}
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span>{item.counted_quantity_flakon != null ? `${item.counted_quantity_flakon} Flakon` : '—'}</span>
        ) : (
          <Input
            id={`count-flakon-${item.id}`}
            type="number"
            min="0"
            className="w-20"
            placeholder={String(item.products.flakon_quantity)}
            value={flakonValue}
            onChange={(e) => setFlakonValue(e.target.value)}
            onBlur={handleBlurFlakon}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (nextItemId) document.getElementById(`count-paket-${nextItemId}`)?.focus()
              }
            }}
          />
        )}
      </TableCell>
      <TableCell className="border-l font-medium">
        <span className="inline-flex items-center gap-1.5">
          {finalStockLabel(finalPaket, finalFlakon)}
          {(item.counted_quantity != null || item.counted_quantity_flakon != null) &&
            (finalPaket === baseline.paket && finalFlakon === baseline.flakon ? (
              <span title="Son sayımla aynı">
                <CheckCircle2 className="size-4 text-success" />
              </span>
            ) : (
              <span title="Son sayımdan farklı">
                <AlertTriangle className="size-4 text-destructive" />
              </span>
            ))}
        </span>
      </TableCell>
      {!readOnly && (
        <TableCell>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Sayımdan çıkar"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(item)
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </TableCell>
      )}
      {lowCountDialog}
    </TableRow>
  )
}

/**
 * Son 3 tamamlanmış sayımın Son Stok değerini ürün başına yan yana (tarih
 * tarih) gösteren salt-okunur karşılaştırma tablosu — kullanıcı isteğiyle
 * (2026-08-21), bugünkü sayımı girerken son günlerin stoğuna bakıp ona göre
 * ekleme/çıkarma kararı verebilsin diye. PastCountRow ile aynı sebepten
 * (bkz. yukarıdaki yorum) CANLI ürün stoğu değil, o günün kendi
 * expected_quantity anlık görüntüsü kullanılıyor — geçmiş bir günün "o gün
 * son stok neydi" sorusunun cevabı aradan geçen zamanla değişmemeli.
 */
function RecentStockComparison({ recentCounts }: { recentCounts: StockCount[] }) {
  const c0 = recentCounts[0]
  const c1 = recentCounts[1]
  const c2 = recentCounts[2]
  const { data: items0 = [] } = useCountItems(c0?.id)
  const { data: items1 = [] } = useCountItems(c1?.id)
  const { data: items2 = [] } = useCountItems(c2?.id)

  if (recentCounts.length === 0) return null

  const dayItems = [items0, items1, items2]
  const productRows = new Map<
    string,
    { productId: string; name: string; days: (StockCountItemWithProduct | undefined)[] }
  >()
  recentCounts.forEach((_, dayIndex) => {
    for (const item of dayItems[dayIndex]) {
      if (!productRows.has(item.product_id)) {
        productRows.set(item.product_id, {
          productId: item.product_id,
          name: item.products.name,
          days: [undefined, undefined, undefined],
        })
      }
      productRows.get(item.product_id)!.days[dayIndex] = item
    }
  })
  // Aynı isimli iki farklı ürün olabildiği için (ör. "MIXO LIGHT") anahtar
  // isim değil product_id — aksi halde React "duplicate key" uyarısı verip
  // satırları çoğaltıyor/atlıyordu (fark edildi, 2026-08-22).
  const sortedRows = Array.from(productRows.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Son Günlerin Stoğu</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ürün</TableHead>
              {recentCounts.map((c, i) => (
                <TableHead
                  key={c.id}
                  className={cn('border-l font-bold', DAY_COLOR_CLASSES[i % DAY_COLOR_CLASSES.length])}
                >
                  {format(new Date(c.count_date), 'd MMM yyyy', { locale: trLocale })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={recentCounts.length + 1} className="text-muted-foreground py-6 text-center">
                  Henüz geçmiş sayım verisi yok
                </TableCell>
              </TableRow>
            )}
            {sortedRows.map((row) => (
              <TableRow key={row.productId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                {row.days.slice(0, recentCounts.length).map((item, i) => (
                  <TableCell key={i} className={cn('border-l font-medium', DAY_COLOR_CLASSES[i % DAY_COLOR_CLASSES.length])}>
                    {item
                      ? finalStockLabel(
                          resolveCounted(item.expected_quantity, item.counted_quantity),
                          resolveCounted(item.expected_quantity_flakon, item.counted_quantity_flakon),
                        )
                      : '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** Geçmiş bir sayımın kalemlerini açılınca gösteren satır — tıklanmadan
 * önce hiç sorgu atmaz (useCountItems'a sadece açıkken gerçek id verilir).
 * Geçmiş bir sayım için "Sistemdeki Miktar"/"Son Stok" bilerek CANLI ürün
 * stoğu değil, o sayımın kendi expected_quantity anlık görüntüsü + o gün
 * girilen değer üzerinden hesaplanır — aksi halde aradan geçen zamanda olan
 * başka hareketler yüzünden o günkü gerçek son stok yanlış görünürdü. Sütun
 * başlıkları da bugünkü Sayım tablosuyla aynı desende: "O Günkü Stok" yerine
 * bir önceki sayımın tarihi, "Son Stok" yerine bu sayımın kendi tarihi
 * (kullanıcı isteği, 2026-08-22).
 */
function PastCountRow({ count, previousCount }: { count: StockCount; previousCount?: StockCount }) {
  const [open, setOpen] = React.useState(false)
  const { data: items = [], isLoading } = useCountItems(open ? count.id : undefined)
  const { data: previousItems = [] } = useCountItems(open ? previousCount?.id : undefined)
  const setStatus = useSetCountStatus()
  const updateDateMutation = useUpdateCountDate()
  const completeMutation = useCompleteCount()
  const undoMutation = useUndoCompleteCount()
  const updateItemMutation = useUpdateCountItem(count.id)
  const updateItemFlakonMutation = useUpdateCountItemFlakon(count.id)
  const addItemMutation = useAddCountItem(count.id)
  const deleteItemMutation = useDeleteCountItem(count.id)
  const deleteCountMutation = useDeleteStockCount()
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const isOpenCount = count.status === 'open'

  const baselineByProduct = React.useMemo(() => {
    const map = new Map<string, { paket: number; flakon: number }>()
    for (const item of previousItems) {
      map.set(item.product_id, {
        paket: resolveCounted(item.expected_quantity, item.counted_quantity),
        flakon: resolveCounted(item.expected_quantity_flakon, item.counted_quantity_flakon),
      })
    }
    return map
  }, [previousItems])
  function getBaseline(item: StockCountItemWithProduct) {
    return baselineByProduct.get(item.product_id) ?? { paket: item.products.current_quantity, flakon: item.products.flakon_quantity }
  }

  async function handleDeleteItem(item: StockCountItemWithProduct) {
    if (!(await confirm(`${item.products.name} bu sayımdan çıkarılsın mı?`))) return
    deleteItemMutation.mutate(item.id)
  }

  async function handleDeleteCount() {
    const dateLabel = format(new Date(count.count_date), 'd MMMM yyyy', { locale: trLocale })
    const message =
      count.status === 'completed'
        ? `${dateLabel} sayımı TAMAMLANMIŞ — silmek, tamamlanırken uygulanan stok değişikliklerini GERİ ALMAZ, sadece sayım kaydı silinir. Yine de silinsin mi?`
        : `${dateLabel} sayımı tamamen silinsin mi? Bu sayımdaki tüm kalemler de silinecek.`
    if (!(await confirm(message, { title: 'Sayımı Sil', confirmLabel: 'Sil', variant: 'destructive' }))) return
    deleteCountMutation.mutate(count.id)
  }

  async function handleUndoComplete() {
    const dateLabel = format(new Date(count.count_date), 'd MMMM yyyy', { locale: trLocale })
    if (
      !(await confirm(
        `${dateLabel} sayımının uyguladığı stok değişiklikleri geri alınacak (stok bir önceki sayımdaki değerine döndürülecek) ve sayım tekrar düzenlenebilir hale gelecek. Devam edilsin mi?`,
        { title: 'Sayımı Geri Al', confirmLabel: 'Geri Al' },
      ))
    )
      return
    undoMutation.mutate(count.id)
  }

  return (
    <div className="rounded-md border">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left hover:text-foreground"
        >
          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
          {format(new Date(count.count_date), 'd MMMM yyyy', { locale: trLocale })}
        </button>
        <div className="flex items-center gap-2">
          {/* Tarih elle öne/arkaya alınabilir (kullanıcı isteği, 2026-08-25) —
              ör. yanlış güne düşmüş bir sayımı düzeltmek için. */}
          <Input
            type="date"
            className="h-7 w-36"
            value={count.count_date}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => e.target.value && updateDateMutation.mutate({ stockCountId: count.id, countDate: e.target.value })}
            disabled={updateDateMutation.isPending}
          />
          {/* Durum elle değiştirilebilir (kullanıcı isteği, 2026-08-24) — sadece
              etiketi değiştirir, stok hareketi UYGULAMAZ (bkz. api.ts). */}
          <Select
            value={count.status}
            onValueChange={(value) => setStatus.mutate({ stockCountId: count.id, status: value as StockCount['status'] })}
            disabled={setStatus.isPending}
          >
            <SelectTrigger
              className={cn(
                'h-7 w-32',
                count.status === 'completed'
                  ? 'border-success/40 bg-success/10 text-success-foreground'
                  : 'border-secondary/40 bg-secondary/40 text-secondary-foreground',
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Açık</SelectItem>
              <SelectItem value="completed">Tamamlandı</SelectItem>
            </SelectContent>
          </Select>
          {count.status === 'completed' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-destructive hover:text-destructive"
              title="Bu sayımın uyguladığı stok değişikliklerini geri alır"
              onClick={(e) => {
                e.stopPropagation()
                handleUndoComplete()
              }}
              disabled={undoMutation.isPending}
            >
              {undoMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
              Geri Al
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title="Sayımı Sil"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteCount()
            }}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t">
          {isLoading && <p className="text-muted-foreground p-3 text-sm">Yükleniyor...</p>}
          {!isLoading && items.length === 0 && <p className="text-muted-foreground p-3 text-sm">Kalem yok</p>}
          {/* Açık bir geçmiş sayım, bugünkü sayım paneliyle AYNI şekilde elle
              düzenlenebilir (kullanıcı isteği, 2026-08-25: "önceki günleri
              yeniden açıp düzenlemeler yapabilmeliyim") — sadece bugünün
              sayımı değil, İSTENEN herhangi bir gün tamamlanabilir/güncellenebilir. */}
          {!isLoading && items.length > 0 && isOpenCount && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="font-bold text-foreground">
                      {previousCount
                        ? `Son Sayım (${format(new Date(previousCount.count_date), 'd MMMM yyyy', { locale: trLocale })})`
                        : 'Sistemdeki Miktar'}
                    </TableHead>
                    <TableHead className="border-l">Paket</TableHead>
                    <TableHead>Flakon</TableHead>
                    <TableHead className="border-l font-bold text-foreground">
                      {format(new Date(count.count_date), 'd MMMM yyyy', { locale: trLocale })} — O Günkü Stok
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <CountItemRow
                      key={item.id}
                      item={item}
                      baseline={getBaseline(item)}
                      readOnly={false}
                      selected={item.id === selectedItemId}
                      onSelect={setSelectedItemId}
                      onSavePaket={(id, value) => updateItemMutation.mutate({ id, counted_quantity: value })}
                      onSaveFlakon={(id, value) => updateItemFlakonMutation.mutate({ id, counted_quantity_flakon: value })}
                      onDelete={handleDeleteItem}
                      nextItemId={items[index + 1]?.id}
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="w-64">
                  <ProductCombobox
                    value={undefined}
                    placeholder="Sayıma ürün ekle..."
                    onChange={(product) => {
                      if (items.some((i) => i.product_id === product.id)) {
                        toast.info('Bu ürün zaten sayımda')
                        return
                      }
                      addItemMutation.mutate(product)
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => completeMutation.mutate(count.id)}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending && <Loader2 className="animate-spin" />}
                  Sayımı Tamamla ve Stoğu Güncelle
                </Button>
              </div>
            </>
          )}
          {!isLoading && items.length > 0 && !isOpenCount && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="font-bold text-foreground">
                    {previousCount
                      ? `Son Sayım (${format(new Date(previousCount.count_date), 'd MMMM yyyy', { locale: trLocale })})`
                      : 'O Günkü Stok'}
                  </TableHead>
                  <TableHead className="border-l">Paket</TableHead>
                  <TableHead>Flakon</TableHead>
                  <TableHead className="border-l font-bold text-foreground">
                    {format(new Date(count.count_date), 'd MMMM yyyy', { locale: trLocale })} — O Günkü Stok
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.products.name}</TableCell>
                    <TableCell className="font-bold text-foreground">
                      {baselineLabel(i.expected_quantity, i.expected_quantity_flakon)}
                    </TableCell>
                    <TableCell className="border-l">{i.counted_quantity ? `${i.counted_quantity} Paket` : '—'}</TableCell>
                    <TableCell>{i.counted_quantity_flakon ? `${i.counted_quantity_flakon} Flakon` : '—'}</TableCell>
                    <TableCell className="border-l font-medium">
                      {finalStockLabel(
                        resolveCounted(i.expected_quantity, i.counted_quantity),
                        resolveCounted(i.expected_quantity_flakon, i.counted_quantity_flakon),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
      {dialog}
    </div>
  )
}

export function DailyCountPanel() {
  const { data: todayCount, isLoading: loadingToday } = useTodayCount()
  const { data: pastCounts = [] } = usePastCounts()
  const startMutation = useStartTodayCount()
  const completeMutation = useCompleteCount()
  const reopenMutation = useReopenCount()
  const undoMutation = useUndoCompleteCount()
  const { data: allSales = [] } = useSales()
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)

  // İleri/geri okları SADECE gerçekten var olan sayımlar arasında gezdirir
  // (kullanıcı isteği, 2026-08-28: "sayım günün yanına ileri geri tuşları
  // koy o güne gidebileyim") — yeni tarih üretmez, sadece todayCount +
  // pastCounts içindeki tarihler arasında konum değiştirir. null = varsayılan
  // (todayCount).
  const [viewedDate, setViewedDate] = React.useState<string | null>(null)
  const navDates = React.useMemo(() => {
    const dates = new Set<string>()
    if (todayCount) dates.add(todayCount.count_date)
    for (const c of pastCounts) dates.add(c.count_date)
    return Array.from(dates).sort()
  }, [todayCount, pastCounts])
  const activeCount =
    (viewedDate
      ? (pastCounts.find((c) => c.count_date === viewedDate) ??
        (todayCount?.count_date === viewedDate ? todayCount : undefined))
      : todayCount) ?? todayCount
  const navIndex = activeCount ? navDates.indexOf(activeCount.count_date) : -1
  const canGoBack = navIndex > 0
  const canGoForward = navIndex >= 0 && navIndex < navDates.length - 1

  const { data: items = [] } = useCountItems(activeCount?.id)
  const updateItemMutation = useUpdateCountItem(activeCount?.id ?? '')
  const updateItemFlakonMutation = useUpdateCountItemFlakon(activeCount?.id ?? '')
  const addItemMutation = useAddCountItem(activeCount?.id ?? '')
  const deleteItemMutation = useDeleteCountItem(activeCount?.id ?? '')

  // Bir önceki TAMAMLANMIŞ sayım — "Sistemdeki Miktar" artık bunun Son Stok
  // değeri (canlı products stoğu değil, kullanıcı isteğiyle 2026-08-22).
  // Hook sırası bozulmasın diye (erken return'lerden ÖNCE) burada, en
  // tepede çağrılıyor — bkz. aşağıdaki baselineByProduct. Görüntülenen
  // sayımın TARİHİNE göre önceki (activeCount navigasyonla değişebildiği
  // için artık her zaman "bugünden önceki" değil, "görüntülenenden önceki").
  const otherPastCountsForBaseline = pastCounts.filter((c) => c.id !== activeCount?.id)
  const previousCompletedCount = otherPastCountsForBaseline
    .filter((c) => c.status === 'completed' && (!activeCount || c.count_date < activeCount.count_date))
    .sort((a, b) => b.count_date.localeCompare(a.count_date))[0]
  const { data: previousItems = [] } = useCountItems(previousCompletedCount?.id)
  const baselineByProduct = React.useMemo(() => {
    const map = new Map<string, { paket: number; flakon: number }>()
    for (const item of previousItems) {
      map.set(item.product_id, {
        paket: resolveCounted(item.expected_quantity, item.counted_quantity),
        flakon: resolveCounted(item.expected_quantity_flakon, item.counted_quantity_flakon),
      })
    }
    return map
  }, [previousItems])
  function getBaseline(item: StockCountItemWithProduct) {
    return baselineByProduct.get(item.product_id) ?? { paket: item.products.current_quantity, flakon: item.products.flakon_quantity }
  }

  const { confirm, dialog } = useConfirmDialog()
  const deleteCountMutation = useDeleteStockCount()

  async function handleDeleteItem(item: StockCountItemWithProduct) {
    if (!(await confirm(`${item.products.name} bu sayımdan çıkarılsın mı?`))) return
    deleteItemMutation.mutate(item.id)
  }

  async function handleUndoComplete(id: string) {
    if (
      !(await confirm(
        'Bu sayımın uyguladığı stok değişiklikleri geri alınacak (stok bir önceki sayımdaki değerine döndürülecek) ve sayım tekrar düzenlenebilir hale gelecek. Devam edilsin mi?',
        { title: 'Sayımı Geri Al', confirmLabel: 'Geri Al' },
      ))
    )
      return
    undoMutation.mutate(id)
  }

  async function handleDeleteTodayCount() {
    if (!activeCount) return
    const dateLabel = format(new Date(activeCount.count_date), 'd MMMM yyyy', { locale: trLocale })
    const message =
      activeCount.status === 'completed'
        ? `${dateLabel} sayımı TAMAMLANMIŞ — silmek, tamamlanırken uygulanan stok değişikliklerini GERİ ALMAZ, sadece sayım kaydı silinir. Yine de silinsin mi?`
        : `${dateLabel} sayımı tamamen silinsin mi? Bu sayımdaki tüm kalemler de silinecek.`
    if (!(await confirm(message, { title: 'Sayımı Sil', confirmLabel: 'Sil', variant: 'destructive' }))) return
    deleteCountMutation.mutate(activeCount.id)
    if (viewedDate === activeCount.count_date) setViewedDate(null)
  }

  if (loadingToday) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!activeCount) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground" />
          <p className="text-muted-foreground">Bugün için henüz bir sayım başlatılmadı.</p>
          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            {startMutation.isPending && <Loader2 className="animate-spin" />}
            Bugünün Sayımını Başlat
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isCompleted = activeCount.status === 'completed'
  const otherPastCounts = pastCounts.filter((c) => c.id !== activeCount.id)
  const previousDate = otherPastCounts.map((c) => c.count_date).sort((a, b) => b.localeCompare(a))[0] ?? null
  // Sadece TAMAMLANMIŞ sayımlar — açık (yarım kalmış) bir sayımın kısmi/boş
  // verisi "o günün son stoğu" gibi gösterilirse ekleme/çıkarma kararını
  // yanlış yönlendirir.
  const recentCounts = otherPastCounts.filter((c) => c.status === 'completed').slice(0, 3)
  const todayOutgoingSales = allSales.filter((s) => s.sale_date === activeCount.count_date && s.type === 'sale')

  const countDateLabel = format(new Date(activeCount.count_date), 'd MMMM yyyy (EEEE)', { locale: trLocale })

  // "Değişecek" — bugün girilen sayı taban (önceki sayım) ile FARKLIYSA
  // sayılıyor; aynıysa (kullanıcı isteğiyle) hiçbir hareket kaydedilmeyeceği
  // için değişiklik olarak sayılmıyor.
  const pendingChangeCount = items.filter((i) => {
    const baseline = getBaseline(i)
    const paketChanged = i.counted_quantity != null && i.counted_quantity !== baseline.paket
    const flakonChanged = i.counted_quantity_flakon != null && i.counted_quantity_flakon !== baseline.flakon
    return paketChanged || flakonChanged
  }).length

  // "Son stok" = bugün girilen tam sayım varsa o, yoksa taban (önceki sayım)
  // — Sayımı Tamamla sonrası depoya yansıyacak gerçek son değer bu (bkz.
  // completeCount()'taki aynı fark mantığı).
  function productLine(i: StockCountItemWithProduct): { metrik: string; deger: string | number } {
    // CountItemRow'daki gibi canlı stoktan taban alınır (bkz. oradaki yorum) —
    // Günlük Özet'in "Son Stok" sütunu, sayım tamamlandığında gerçekte
    // uygulanacak değerle (completeCount) tutarlı olsun diye.
    const finalPaket = resolveCounted(i.products.current_quantity, i.counted_quantity)
    const finalFlakon = resolveCounted(i.products.flakon_quantity, i.counted_quantity_flakon)
    return {
      metrik: i.products.name,
      deger: finalStockLabel(finalPaket, finalFlakon),
    }
  }
  // "Diğer" (Dermakor/Swiss dışı) ürünler kasıtlı olarak hiçbir yerde
  // gösterilmiyor (kullanıcı isteği, 2026-08-27: "stok ve günlükten diğer
  // kısmını kaldır").
  const dermakorItems = items.filter((i) => i.products.brand_line === 'dermakor')
  const swissItems = items.filter((i) => i.products.brand_line === 'swiss')

  // Sadece ürünler Dermakor/Swiss diye ayrılmış liste — toplam/fark gibi
  // ayrı hesaplanan özet rakamları YOK. Tarih satırı kaldırıldı (kullanıcı
  // isteğiyle, 2026-08-22) — dışa aktarımın kendi başlığında zaten var,
  // burada tekrar yazmak gereksizdi.
  const summaryRows: { metrik: string; deger: string | number }[] = [
    { metrik: '— DERMAKOR —', deger: '' },
    ...dermakorItems.map(productLine),
    { metrik: '— SWISS —', deger: '' },
    ...swissItems.map(productLine),
  ]

  // Bugünün gerçek takvim tarihinin İLERİSİNDE — normalde olmaması gereken,
  // arka arkaya "Sayımı Tamamla" ile hızlıca oluşmuş yanlışlıkla ileri
  // gitmiş bir sayım (kullanıcı isteği, 2026-08-28: "bugünün önüne
  // geçtiysem silebileyim") — Sil butonu zaten her zaman var, burada sadece
  // dikkat çekmek için vurgulanıyor.
  const isFutureCount = activeCount.count_date > todayDate()
  // Nav okları yanındaki tarih ile Sayım tablosundaki yanıp sönen "Bugünkü
  // Stok" başlığı AYNI metni göstermeli (kullanıcı isteği, 2026-08-28) —
  // tek yerden üretilip ikisinde de kullanılıyor.
  const activeDateLabel =
    format(new Date(activeCount.count_date), 'dd.MM.yyyy EEEE', { locale: trLocale }).toLocaleUpperCase('tr-TR') +
    (activeCount.count_date === todayDate() ? ' - GÜNCEL SAYIM' : ' SAYIM')

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base">Günlük Stok</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title="Önceki gün"
              onClick={() => canGoBack && setViewedDate(navDates[navIndex - 1])}
              disabled={!canGoBack}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className={cn('text-sm font-medium', isFutureCount && 'text-destructive')}>
              {activeDateLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title="Sonraki gün"
              onClick={() => canGoForward && setViewedDate(navDates[navIndex + 1])}
              disabled={!canGoForward}
            >
              <ChevronRight className="size-4" />
            </Button>
            {isFutureCount && (
              <Badge variant="destructive" className="ml-1">
                Bugünün ilerisinde
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <ExportMenu<StockCountItemWithProduct>
                title="Başlangıç Sayım Listesi"
                filename={`baslangic-listesi-${activeCount.count_date}`}
                triggerLabel="Başlangıç Listesi"
                rows={items}
                columns={[
                  { header: 'ÜRÜN ADI', value: (i) => i.products.name },
                  { header: 'STOKLAR', value: (i) => i.expected_quantity },
                ]}
              />
            )}
            {items.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download /> Dışa Aktar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => exportDailyCountToExcel(activeCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <FileSpreadsheet className="text-success" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => exportDailyCountToWord(activeCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <FileText className="text-primary" /> Word (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => exportDailyCountToPdf(activeCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <FileType className="text-destructive" /> PDF (.pdf)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => printDailyCount(activeCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <Printer className="text-muted-foreground" /> Yazdır
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isCompleted ? (
              <>
                <Badge variant="success">
                  <CheckCircle2 className="size-3" /> Tamamlandı
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reopenMutation.mutate(activeCount.id)}
                  disabled={reopenMutation.isPending}
                >
                  {reopenMutation.isPending && <Loader2 className="animate-spin" />}
                  Yeniden Aç
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleUndoComplete(activeCount.id)}
                  disabled={undoMutation.isPending}
                  title="Bu sayımın uyguladığı stok değişikliklerini geri alır"
                >
                  {undoMutation.isPending ? <Loader2 className="animate-spin" /> : <Undo2 className="size-3.5" />}
                  Geri Al
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => completeMutation.mutate(activeCount.id)}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending && <Loader2 className="animate-spin" />}
                Sayımı Tamamla ve Stoğu Güncelle
                {pendingChangeCount > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {pendingChangeCount}
                  </Badge>
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Sayımı Sil"
              onClick={handleDeleteTodayCount}
              disabled={deleteCountMutation.isPending}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        {!isCompleted && pendingChangeCount > 0 && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0 animate-alert-glow-red" />
            <p>
              <strong>{pendingChangeCount} üründe</strong> sayım girdiniz ama gerçek stok henüz güncellenmedi.
              Değişikliklerin sisteme yansıması için yukarıdaki <strong>"Sayımı Tamamla ve Stoğu Güncelle"</strong>{' '}
              butonuna basmanız gerekiyor.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {format(new Date(activeCount.count_date), 'dd.MM.yyyy', { locale: trLocale })}
          </CardTitle>
          {!isCompleted && (
            <div className="w-64">
              <ProductCombobox
                value={undefined}
                placeholder="Sayıma ürün ekle..."
                onChange={(product) => {
                  if (items.some((i) => i.product_id === product.id)) {
                    toast.info('Bu ürün zaten sayımda')
                    return
                  }
                  addItemMutation.mutate(product)
                }}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-6 px-0 pt-0 pb-4">
          {(
            [
              ['Dermakor', dermakorItems],
              ['Swiss', swissItems],
            ] as const
          ).map(([groupLabel, groupItems]) =>
            groupItems.length === 0 ? null : (
              <div key={groupLabel} className="min-w-0">
                <h3 className="text-muted-foreground px-3 pb-1 text-sm font-semibold tracking-wide uppercase">
                  {groupLabel}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead className="font-bold text-foreground">
                        {previousCompletedCount
                          ? `Son Sayım (${format(new Date(previousCompletedCount.count_date), 'd MMMM yyyy', { locale: trLocale })})`
                          : 'Sistemdeki Miktar'}
                      </TableHead>
                      <TableHead className="border-l">Paket</TableHead>
                      <TableHead>Flakon</TableHead>
                      <TableHead className="animate-text-blink border-l font-bold text-destructive">{activeDateLabel}</TableHead>
                      {!isCompleted && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupItems.map((item, index) => (
                      <CountItemRow
                        key={item.id}
                        item={item}
                        baseline={getBaseline(item)}
                        readOnly={isCompleted}
                        selected={item.id === selectedItemId}
                        onSelect={setSelectedItemId}
                        onSavePaket={(id, value) => updateItemMutation.mutate({ id, counted_quantity: value })}
                        onSaveFlakon={(id, value) => updateItemFlakonMutation.mutate({ id, counted_quantity_flakon: value })}
                        onDelete={handleDeleteItem}
                        nextItemId={groupItems[index + 1]?.id}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <RecentStockComparison recentCounts={recentCounts} />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Günlük Özet</CardTitle>
          <div className="flex items-center gap-2">
            <ExportMenu<{ metrik: string; deger: string | number }>
              title={`${countDateLabel} — Günlük Özet`}
              filename={`gunluk-ozet-${activeCount.count_date}`}
              triggerLabel="Özeti Dışa Aktar"
              rows={summaryRows}
              columns={[
                { header: 'Ürün', value: (r) => r.metrik },
                { header: 'Son Stok', value: (r) => r.deger },
              ]}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                exportDailySummaryImage(
                  countDateLabel,
                  [],
                  summaryRows.map((r) => ({ label: r.metrik, value: String(r.deger) })),
                )
              }
            >
              <ImageDown /> Görsel (PNG)
            </Button>
          </div>
        </CardHeader>
      </Card>

      <TodaySalesActivity countDate={activeCount.count_date} />

      {pastCounts.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Geçmiş Sayımlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pastCounts
              .filter((c) => c.id !== activeCount.id)
              .map((c) => (
                <PastCountRow
                  key={c.id}
                  count={c}
                  previousCount={pastCounts.find((p) => p.status === 'completed' && p.count_date < c.count_date)}
                />
              ))}
          </CardContent>
        </Card>
      )}
      {dialog}
    </div>
  )
}
