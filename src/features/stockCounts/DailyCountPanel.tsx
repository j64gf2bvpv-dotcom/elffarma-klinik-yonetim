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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImportMenu } from '@/components/ImportMenu'
import { SaleForm } from '@/features/sales/SaleForm'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { ResetAllStockDialog } from '@/features/stock/ResetAllStockDialog'
import { useProducts } from '@/features/stock/hooks'
import { importProductRows, PRODUCT_IMPORT_HEADERS, PRODUCT_IMPORT_SAMPLE_ROWS } from '@/features/stock/importProducts'
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
  useUpdateCountItemNote,
  useUpdateCountItemSmallBox,
  useUpdateCountNotes,
} from './hooks'
import { exportDailySummaryImage } from './exportSummaryImage'
import { todayDate, type StockCountItemWithProduct } from './api'
import type { StockCount } from '@/types/database'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

/**
 * Sayım tablolarında her hücrenin etrafında çizgi — tablo görünümü
 * (kullanıcı isteği, 2026-10-14: "aralarda çizgi şeklinde tablo şeklinde yap").
 */
const COUNT_TABLE_GRID =
  'border-collapse border border-border [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border [&_th]:bg-muted/40'


/** "Sistemdeki Miktar" / "Son Sayım" / "O Günkü Stok" gibi taban hücreleri için —
 * paket ve flakon ikisi de 0 ise "—"; sadece biri 0 olan tarafta o taraf hiç
 * yazılmaz (kullanıcı isteğiyle, 2026-08-23 — "0 olanlar hiç yazmasın", önceden
 * paket 0 olduğunda "—, 1 Flakon" gibi gereksiz bir "—" görünüyordu). */
function stockParts(paket: number, flakon: number, kutu: number): string[] {
  return [paket > 0 ? `${paket} Tam Paket` : null, kutu > 0 ? `${kutu} Küçük Kutu` : null, flakon > 0 ? `${flakon} Flakon` : null].filter(
    (x): x is string => !!x,
  )
}

function baselineLabel(paket: number, flakon: number, kutu = 0): string {
  const parts = stockParts(paket, flakon, kutu)
  return parts.length ? parts.join(', ') : '—'
}

/** Son Stok: paket ve flakon ikisi de 0 ise "—"; sadece biri 0 olan tarafta o taraf
 * hiç yazılmaz (kullanıcı isteğiyle, 2026-08-23 — "0 olanlar hiç yazmasın", önceden
 * paket 0 olduğunda tüm hücre "—" oluyor, flakon miktarı hiç görünmüyordu). İkisi
 * de doluysa "6 Paket - 4 Flakon", parantez kullanılmıyor. */
function finalStockLabel(paket: number, flakon: number, kutu = 0): string {
  const parts = stockParts(paket, flakon, kutu)
  return parts.length ? parts.join(' - ') : '—'
}

/** Bugün girilen tam sayım varsa onu, yoksa (henüz sayılmadı) tabanı (önceki
 * sayım / ilk sayımsa canlı stok) döndürür — "adetler aynıysa dünkü sayımla
 * eklemeden yaz" kuralı (kullanıcı isteği, 2026-08-22). */
/**
 * Sayım kutusu boşken (gri ipucu = mevcut adet) yukarı/aşağı ok tuşu tarayıcıda
 * 0'dan başlıyordu (kullanıcı bildirimi, 2026-10-27: "14 varken oka basınca
 * sıfırlıyor") — boşsa ipucu rakamından bir artırıp/azaltır. Kutu doluysa
 * tarayıcının kendi davranışı (değeri ±1) aynen çalışır.
 */
function stepFromHint(e: React.KeyboardEvent<HTMLInputElement>, value: string, hint: number, set: (v: string) => void): boolean {
  if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || value !== '') return false
  e.preventDefault()
  set(String(Math.max(0, hint + (e.key === 'ArrowUp' ? 1 : -1))))
  return true
}

/**
 * Aynısı fareyle: kutu boşken sağdaki küçük ok düğmelerine tıklanırsa önce ipucu
 * rakamı kutuya yazılır, tarayıcı da onu bir artırır/azaltır (kullanıcı
 * bildirimi, 2026-10-27: "oka tıklayıp yükseltip azaltırken sıfırlamasın").
 * Sadece ok düğmelerinin olduğu sağ kenar (son ~22 px) yakalanır; kutunun içine
 * tıklamak kutuyu doldurmaz.
 */
function fillHintOnSpinner(e: React.MouseEvent<HTMLInputElement>, value: string, hint: number, set: (v: string) => void) {
  if (value !== '') return
  const el = e.currentTarget
  const x = e.clientX - el.getBoundingClientRect().left
  if (x < el.clientWidth - 22) return
  // Tarayıcının kendi adımına bırakmadan biz uygularız: üst yarı = artır, alt yarı = azalt
  e.preventDefault()
  const up = e.clientY - el.getBoundingClientRect().top < el.clientHeight / 2
  set(String(Math.max(0, hint + (up ? 1 : -1))))
  el.focus()
}

function resolveCounted(baseline: number, counted: number | null): number {
  return counted ?? baseline
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
  onSaveKutu,
  onSaveNote,
  onDelete,
  nextItemId,
}: {
  item: StockCountItemWithProduct
  baseline: { paket: number; flakon: number; kutu: number }
  readOnly: boolean
  selected: boolean
  onSelect: (id: string) => void
  onSavePaket: (id: string, value: number | null) => void
  onSaveFlakon: (id: string, value: number | null) => void
  onSaveKutu: (id: string, value: number | null) => void
  onSaveNote: (id: string, note: string | null) => void
  onDelete: (item: StockCountItemWithProduct) => void
  /** Enter'la aşağı satıra geçebilmek için (kullanıcı isteği, 2026-08-22) —
   * Paket→Flakon→bir sonraki satırın Paket'i, StockMovementDialog'daki aynı
   * Enter-ile-ilerleme deseni (bkz. o dosyadaki quantityInputRef). */
  nextItemId?: string
}) {
  // ÖNEMLİ (kullanıcı raporu, 2026-08-29 — gerçek stok verisi bozuldu): bu
  // kutuyu bir önceki sayımın rakamıyla GERÇEKTEN doldurmayı denedik ama bu,
  // aşağıdaki finalPaket/finalFlakon hesabını da (kutu boşken CANLI ürün
  // stoğuna düşmesi gereken) bozup her satırda yanlışlıkla eski/durgun bir
  // sayı göstermeye başladı — bazı ürünlerin gerçek (güncel) stoğu ekranda
  // sıfır/yanlış görünmesine yol açtı. O deneme GERİ ALINDI: kutu yine boş
  // ('') başlıyor, "silinmiş gibi görünme" sorunu bunun yerine aşağıdaki
  // placeholder (hayalet metin) ile çözülüyor — placeholder hiçbir hesaba
  // katılmadığı için finalPaket/finalFlakon etkilenmez.
  const [paketValue, setPaketValue] = React.useState(item.counted_quantity?.toString() ?? '')
  const [flakonValue, setFlakonValue] = React.useState(item.counted_quantity_flakon?.toString() ?? '')
  const [kutuValue, setKutuValue] = React.useState(item.counted_quantity_small_box?.toString() ?? '')
  // "Bugünkü Stok" henüz elle sayılmadıysa geçmiş sayımın (baseline) değil,
  // CANLI ürün stoğunun karşılığı olmalı — aksi halde gün içinde "Günün
  // Satış/İade Hareketleri"nden girilen bir satış/iade burada hiç
  // görünmüyordu (kullanıcı isteği, 2026-08-24: "girilen ya da çıkılan ürün
  // güncel son stoktan düşmüyor/eklenmiyor"). "Son Sayım" sütunu ve aşağıdaki
  // "dünkü sayımdan az" uyarısı bilerek hâlâ baseline (geçmiş sayım) kullanıyor
  // — o, ayrı bir karşılaştırma amacı taşıyor.
  const finalPaket = resolveCounted(item.products.current_quantity, paketValue === '' ? null : Number(paketValue))
  const finalFlakon = resolveCounted(item.products.flakon_quantity, flakonValue === '' ? null : Number(flakonValue))
  const finalKutu = resolveCounted(item.products.small_box_quantity ?? 0, kutuValue === '' ? null : Number(kutuValue))
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

  React.useEffect(() => {
    setKutuValue(item.counted_quantity_small_box?.toString() ?? '')
  }, [item.counted_quantity_small_box])

  async function handleBlurKutu() {
    const next = kutuValue === '' ? null : Number(kutuValue)
    if (next != null && next < baseline.kutu) {
      const ok = await confirmLowCount(
        `${item.products.name} için girilen küçük kutu miktarı (${next}) dünkü sayımdan (${baseline.kutu}) az. Devam edilsin mi?`,
        { title: 'Dikkat', confirmLabel: 'Tamam, Devam Et', variant: 'default' },
      )
      if (!ok) {
        setKutuValue(item.counted_quantity_small_box?.toString() ?? '')
        return
      }
    }
    onSaveKutu(item.id, next)
  }

  return (
    <TableRow onClick={() => onSelect(item.id)} selected={selected}>
      <TableCell className="font-medium break-words whitespace-normal">{item.products.name}</TableCell>
      <TableCell className="font-bold text-foreground">
        {baselineLabel(baseline.paket, baseline.flakon, baseline.kutu)}
      </TableCell>
      <TableCell className="border-l">
        {readOnly ? (
          <span>{item.counted_quantity != null ? `${item.counted_quantity} Tam Paket` : '—'}</span>
        ) : (
          <Input
            id={`count-paket-${item.id}`}
            type="number"
            min="0"
            className="w-20"
            placeholder={String(item.products.current_quantity)}
            value={paketValue}
            onChange={(e) => setPaketValue(e.target.value)}
            onMouseDown={(e) => fillHintOnSpinner(e, paketValue, item.products.current_quantity, setPaketValue)}
            onBlur={handleBlurPaket}
            onKeyDown={(e) => {
              if (stepFromHint(e, paketValue, item.products.current_quantity, setPaketValue)) return
              if (e.key === 'Enter') {
                e.preventDefault()
                document.getElementById(`count-kutu-${item.id}`)?.focus()
              }
            }}
          />
        )}
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span>{item.counted_quantity_small_box != null ? `${item.counted_quantity_small_box} Küçük Kutu` : '—'}</span>
        ) : (
          <Input
            id={`count-kutu-${item.id}`}
            type="number"
            min="0"
            className="w-20"
            placeholder={String(item.products.small_box_quantity ?? 0)}
            value={kutuValue}
            onChange={(e) => setKutuValue(e.target.value)}
            onMouseDown={(e) => fillHintOnSpinner(e, kutuValue, item.products.small_box_quantity ?? 0, setKutuValue)}
            onBlur={handleBlurKutu}
            onKeyDown={(e) => {
              if (stepFromHint(e, kutuValue, item.products.small_box_quantity ?? 0, setKutuValue)) return
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
            onMouseDown={(e) => fillHintOnSpinner(e, flakonValue, item.products.flakon_quantity, setFlakonValue)}
            onBlur={handleBlurFlakon}
            onKeyDown={(e) => {
              if (stepFromHint(e, flakonValue, item.products.flakon_quantity, setFlakonValue)) return
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
          {finalStockLabel(finalPaket, finalFlakon, finalKutu)}
          {(item.counted_quantity != null || item.counted_quantity_flakon != null || item.counted_quantity_small_box != null) &&
            (finalPaket === baseline.paket && finalFlakon === baseline.flakon && finalKutu === baseline.kutu ? (
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
      <TableCell>
        <ItemNoteInput item={item} onSave={onSaveNote} />
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
  const updateItemNoteMutation = useUpdateCountItemNote(count.id)
  const updateItemKutuMutation = useUpdateCountItemSmallBox(count.id)
  const addItemMutation = useAddCountItem(count.id)
  const deleteItemMutation = useDeleteCountItem(count.id)
  const deleteCountMutation = useDeleteStockCount()
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const isOpenCount = count.status === 'open'

  const baselineByProduct = React.useMemo(() => {
    const map = new Map<string, { paket: number; flakon: number; kutu: number }>()
    for (const item of previousItems) {
      map.set(item.product_id, {
        paket: resolveCounted(item.expected_quantity, item.counted_quantity),
        flakon: resolveCounted(item.expected_quantity_flakon, item.counted_quantity_flakon),
        kutu: resolveCounted(item.expected_quantity_small_box ?? 0, item.counted_quantity_small_box),
      })
    }
    return map
  }, [previousItems])
  function getBaseline(item: StockCountItemWithProduct) {
    return (
      baselineByProduct.get(item.product_id) ?? {
        paket: item.products.current_quantity,
        flakon: item.products.flakon_quantity,
        kutu: item.products.small_box_quantity ?? 0,
      }
    )
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
          {format(new Date(count.count_date), 'dd.MM.yyyy', { locale: trLocale })}
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
          <div className="border-b p-3">
            <CountNotesField
              key={count.id}
              countId={count.id}
              initial={count.notes ?? ''}
              dateLabel={format(new Date(count.count_date), 'dd.MM.yyyy', { locale: trLocale })}
            />
          </div>
          {isLoading && <p className="text-muted-foreground p-3 text-sm">Yükleniyor...</p>}
          {!isLoading && items.length === 0 && <p className="text-muted-foreground p-3 text-sm">Kalem yok</p>}
          {/* Açık bir geçmiş sayım, bugünkü sayım paneliyle AYNI şekilde elle
              düzenlenebilir (kullanıcı isteği, 2026-08-25: "önceki günleri
              yeniden açıp düzenlemeler yapabilmeliyim") — sadece bugünün
              sayımı değil, İSTENEN herhangi bir gün tamamlanabilir/güncellenebilir. */}
          {!isLoading && items.length > 0 && isOpenCount && (
            <>
              <Table className={COUNT_TABLE_GRID}>
                <TableHeader>
                  <TableRow className="border-b-2! border-border!">
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">
                      {previousCount ? (
                        <span className="bg-muted text-foreground rounded-md -ml-2 px-2 py-1">
                          {format(new Date(previousCount.count_date), 'dd.MM.yyyy', { locale: trLocale })}
                        </span>
                      ) : (
                        'Sistemdeki Miktar'
                      )}
                    </TableHead>
                    <TableHead className="border-l leading-tight whitespace-normal">
                      Tam Paket
                      <br />
                      (Kutu)
                    </TableHead>
                    <TableHead className="leading-tight whitespace-normal">
                      Küçük
                      <br />
                      Kutu
                    </TableHead>
                    <TableHead>Flakon</TableHead>
                    <TableHead className="border-l text-xs font-bold text-foreground">
                      <span className="bg-primary text-primary-foreground rounded-md -ml-2 px-2 py-1">
                        {format(new Date(count.count_date), 'dd.MM.yyyy', { locale: trLocale })}
                      </span>
                    </TableHead>
                    <TableHead>{format(new Date(count.count_date), 'dd.MM.yyyy', { locale: trLocale })} Notu</TableHead>
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
                      onSaveKutu={(id, value) => updateItemKutuMutation.mutate({ id, counted_quantity_small_box: value })}
                        onSaveNote={(id, note) => updateItemNoteMutation.mutate({ id, note })}
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
            <Table className={COUNT_TABLE_GRID}>
              <TableHeader>
                <TableRow className="border-b-2! border-border!">
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">
                    {previousCount ? (
                      <span className="bg-muted text-foreground rounded-md -ml-2 px-2 py-1">
                        {format(new Date(previousCount.count_date), 'dd.MM.yyyy', { locale: trLocale })}
                      </span>
                    ) : (
                      'O Günkü Stok'
                    )}
                  </TableHead>
                  <TableHead className="border-l text-xs font-bold text-foreground">
                    <span className="bg-primary text-primary-foreground rounded-md -ml-2 px-2 py-1">
                      {format(new Date(count.count_date), 'dd.MM.yyyy', { locale: trLocale })}
                    </span>
                  </TableHead>
                  <TableHead>{format(new Date(count.count_date), 'dd.MM.yyyy', { locale: trLocale })} Notu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.products.name}</TableCell>
                    <TableCell className="font-bold text-foreground">
                      {baselineLabel(i.expected_quantity, i.expected_quantity_flakon, i.expected_quantity_small_box ?? 0)}
                    </TableCell>
                    <TableCell className="border-l font-medium">
                      {finalStockLabel(
                        resolveCounted(i.expected_quantity, i.counted_quantity),
                        resolveCounted(i.expected_quantity_flakon, i.counted_quantity_flakon),
                        resolveCounted(i.expected_quantity_small_box ?? 0, i.counted_quantity_small_box),
                      )}
                    </TableCell>
                    <TableCell>
                      <ItemNoteInput item={i} onSave={(id, note) => updateItemNoteMutation.mutate({ id, note })} />
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

/** Ürün satırı not kutusu — Enter / dışarı tıklayınca kaydeder; geçmiş (tamamlanmış) günlerde de yazılabilir. */
function ItemNoteInput({ item, onSave }: { item: { id: string; note: string | null }; onSave: (id: string, note: string | null) => void }) {
  const [value, setValue] = React.useState(item.note ?? '')
  React.useEffect(() => setValue(item.note ?? ''), [item.note])
  return (
    <Input
      value={value}
      placeholder="Not ekle…"
      className="h-8 text-sm"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim() || null
        if (next !== (item.note ?? null)) onSave(item.id, next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** Günün sayımı için genel not (kullanıcı isteği, 2026-10-26: "günlük sayımda not kısmı da olsun"). */
function CountNotesField({ countId, initial, dateLabel }: { countId: string; initial: string; dateLabel: string }) {
  const [value, setValue] = React.useState(initial)
  const save = useUpdateCountNotes()
  React.useEffect(() => setValue(initial), [initial])
  return (
    <div className="grid w-full max-w-xl gap-1">
      <label htmlFor="count-notes" className="text-xs font-medium text-muted-foreground">
        {dateLabel} sayım notu
      </label>
      <Textarea
        id="count-notes"
        value={value}
        rows={2}
        placeholder={`${dateLabel} günü sayımıyla ilgili not (ör. eksik koli, depoya giden ürünler)…`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const next = value.trim() || null
          if (next !== (initial.trim() || null)) save.mutate({ id: countId, notes: next })
        }}
        className="min-h-14 resize-y text-sm"
      />
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
  const { data: allProductsForImport = [] } = useProducts('')
  const queryClient = useQueryClient()
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)

  const resetAffectedCount = allProductsForImport.filter((p) => p.current_quantity > 0 || p.flakon_quantity > 0).length

  /**
   * Ürün kataloğu içe aktarma — önceden Stok sayfasının en üstündeki genel
   * başlıkta duruyordu; kullanıcı isteğiyle (2026-08-28) oradan kaldırılıp
   * Günlük Özet'e taşındı. Mantık StockPage.tsx'teki eskisiyle birebir aynı.
   */
  async function handleImport(rows: Record<string, unknown>[]) {
    const summary = await importProductRows(rows, allProductsForImport)
    if (summary.added > 0 || (summary.updated ?? 0) > 0) await queryClient.invalidateQueries({ queryKey: ['products'] })
    return summary
  }

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
  const updateItemNoteMutation = useUpdateCountItemNote(activeCount?.id ?? '')
  const updateItemKutuMutation = useUpdateCountItemSmallBox(activeCount?.id ?? '')
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
    const map = new Map<string, { paket: number; flakon: number; kutu: number }>()
    for (const item of previousItems) {
      map.set(item.product_id, {
        paket: resolveCounted(item.expected_quantity, item.counted_quantity),
        flakon: resolveCounted(item.expected_quantity_flakon, item.counted_quantity_flakon),
        kutu: resolveCounted(item.expected_quantity_small_box ?? 0, item.counted_quantity_small_box),
      })
    }
    return map
  }, [previousItems])
  function getBaseline(item: StockCountItemWithProduct) {
    return (
      baselineByProduct.get(item.product_id) ?? {
        paket: item.products.current_quantity,
        flakon: item.products.flakon_quantity,
        kutu: item.products.small_box_quantity ?? 0,
      }
    )
  }

  const { confirm, dialog } = useConfirmDialog()
  const deleteCountMutation = useDeleteStockCount()
  const updateDateMutation = useUpdateCountDate()

  // Nav okları yanındaki tarih artık elle seçilebiliyor (kullanıcı isteği,
  // 2026-09-29: "günlük sayımda tarihi istediğimiz tarih olarak
  // girebilmeliyiz") — görüntülenen sayımın tarihi seçilen güne taşınır.
  // count_date UNIQUE olduğu için o günde zaten sayım varsa taşımak yerine
  // o sayıma gidilir.
  function handleActiveDateChange(nextDate: string) {
    if (!activeCount || !nextDate || nextDate === activeCount.count_date) return
    if (navDates.includes(nextDate)) {
      toast.info('Bu tarihte zaten bir sayım var, o sayım açıldı')
      setViewedDate(nextDate)
      return
    }
    updateDateMutation.mutate(
      { stockCountId: activeCount.id, countDate: nextDate },
      { onSuccess: () => setViewedDate(nextDate) },
    )
  }

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

  const countDateLabel = format(new Date(activeCount.count_date), 'dd.MM.yyyy EEEE', { locale: trLocale })

  // "Değişecek" — bugün girilen sayı taban (önceki sayım) ile FARKLIYSA
  // sayılıyor; aynıysa (kullanıcı isteğiyle) hiçbir hareket kaydedilmeyeceği
  // için değişiklik olarak sayılmıyor.
  const pendingChangeCount = items.filter((i) => {
    const baseline = getBaseline(i)
    const paketChanged = i.counted_quantity != null && i.counted_quantity !== baseline.paket
    const flakonChanged = i.counted_quantity_flakon != null && i.counted_quantity_flakon !== baseline.flakon
    const kutuChanged = i.counted_quantity_small_box != null && i.counted_quantity_small_box !== baseline.kutu
    return paketChanged || flakonChanged || kutuChanged
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
    const finalKutu = resolveCounted(i.products.small_box_quantity ?? 0, i.counted_quantity_small_box)
    return {
      metrik: i.products.name,
      deger: finalStockLabel(finalPaket, finalFlakon, finalKutu),
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
  const activeDateShort = format(new Date(activeCount.count_date), 'dd.MM.yyyy', { locale: trLocale })
  const activeDateLabel =
    format(new Date(activeCount.count_date), 'dd.MM.yyyy', { locale: trLocale }) +
    (activeCount.count_date === todayDate() ? ' - GÜNCEL SAYIM' : '')

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-6">
          <CardTitle className="text-sm">Günlük Özet</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <ImportMenu
              onImport={handleImport}
              templateFilename="stok-sablon"
              templateHeaders={PRODUCT_IMPORT_HEADERS}
              templateSampleRows={PRODUCT_IMPORT_SAMPLE_ROWS}
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
              <ImageDown /> PNG Olarak Dışa Aktar
            </Button>
            <ResetAllStockDialog affectedCount={resetAffectedCount} />
            <SaleForm />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-6">
          <div className="flex items-center gap-1">
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
            <label
              className={cn(
                'relative cursor-pointer rounded px-1 py-0.5 text-sm font-medium hover:bg-accent',
                isFutureCount && 'text-destructive',
              )}
              title="Tarihi değiştirmek için tıklayın"
            >
              {activeDateLabel}
              <input
                type="date"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={activeCount.count_date}
                onClick={(e) => e.currentTarget.showPicker?.()}
                onChange={(e) => handleActiveDateChange(e.target.value)}
                disabled={updateDateMutation.isPending}
              />
            </label>
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
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 pb-6">
          <CountNotesField key={activeCount.id} countId={activeCount.id} initial={activeCount.notes ?? ''} dateLabel={activeDateShort} />
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
                {/* Grup başlığı tam genişlikte şeffaf kırmızı şerit (kullanıcı isteği, 2026-10-14) */}
                <h3 className="border-y border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-bold tracking-wide text-destructive uppercase">
                  {groupLabel}
                </h3>
                <Table className={cn('table-fixed', COUNT_TABLE_GRID)}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-56">Ürün</TableHead>
                      <TableHead className="w-44 font-bold text-foreground">
                        {previousCompletedCount
                          ? `${format(new Date(previousCompletedCount.count_date), 'dd.MM.yyyy', { locale: trLocale })} - SON SAYIM`
                          : 'Sistemdeki Miktar'}
                      </TableHead>
                      <TableHead className="w-28 border-l leading-tight whitespace-normal">
                        Tam Paket
                        <br />
                        (Kutu)
                      </TableHead>
                      <TableHead className="w-28 leading-tight whitespace-normal">
                        Küçük
                        <br />
                        Kutu
                      </TableHead>
                      <TableHead className="w-28">Flakon</TableHead>
                      <TableHead className="w-48 animate-text-blink border-l font-bold text-destructive">
                        {activeDateLabel}
                      </TableHead>
                      <TableHead className="w-56" title={`${activeDateShort} sayımına ait ürün notları`}>
                        {activeDateShort} Notu
                      </TableHead>
                      {!isCompleted && <TableHead className="w-12"></TableHead>}
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
                        onSaveKutu={(id, value) => updateItemKutuMutation.mutate({ id, counted_quantity_small_box: value })}
                        onSaveNote={(id, note) => updateItemNoteMutation.mutate({ id, note })}
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
