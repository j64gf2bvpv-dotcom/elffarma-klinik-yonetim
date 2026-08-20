import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
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
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExportMenu } from '@/components/ExportMenu'
import { useSales } from '@/features/sales/hooks'
import { SaleForm } from '@/features/sales/SaleForm'
import {
  useCompleteCount,
  useCountItems,
  usePastCounts,
  useReopenCount,
  useStartTodayCount,
  useTodayCount,
  useUpdateCountItem,
  useUpdateCountItemFlakon,
} from './hooks'
import { exportDailyCountToExcel, exportDailyCountToPdf, exportDailyCountToWord, printDailyCount } from './exportDailyCount'
import { exportDailySummaryImage } from './exportSummaryImage'
import type { StockCountItemWithProduct } from './api'

function TodaySalesActivity({ countDate }: { countDate: string }) {
  const { data: sales = [] } = useSales()
  const todaySales = sales.filter((s) => s.sale_date === countDate)

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
        <SaleForm />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
            <Undo2 className="size-3.5" /> İade Gelenler (Doktora Göre)
          </p>
          <div className="grid gap-2">
            {returns.length === 0 && <p className="text-muted-foreground text-sm">Bugün iade yok</p>}
            {returns.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                <span className="font-medium">{s.customers?.full_name ?? '—'}</span>
                <span className="text-muted-foreground">
                  {s.product_name} × {s.quantity}
                  {s.sales_reps?.name && ` — ${s.sales_reps.name} tarafından alındı`}
                </span>
              </div>
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
              <div key={s.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                <span className="font-medium">{s.customers?.full_name ?? '—'}</span>
                <span className="text-muted-foreground">
                  {s.product_name} × {s.quantity}
                  {s.sales_reps?.name && ` — ${s.sales_reps.name} tarafından elden teslim edildi`}
                </span>
              </div>
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
 * tek tabloda birleştirildi. "Sistemdeki Miktar" artık HER ZAMAN canlı
 * products.current_quantity/flakon_quantity — elle düzenlenemez, sadece
 * referans için gösterilir (bkz. api.ts'teki completeCount açıklaması).
 */
function CountItemRow({
  item,
  readOnly,
  selected,
  onSelect,
  onSavePaket,
  onSaveFlakon,
}: {
  item: StockCountItemWithProduct
  readOnly: boolean
  selected: boolean
  onSelect: (id: string) => void
  onSavePaket: (id: string, value: number | null) => void
  onSaveFlakon: (id: string, value: number | null) => void
}) {
  const [paketValue, setPaketValue] = React.useState(item.counted_quantity?.toString() ?? '')
  const [flakonValue, setFlakonValue] = React.useState(item.counted_quantity_flakon?.toString() ?? '')
  const paketDiff = paketValue === '' ? null : Number(paketValue) - item.products.current_quantity
  const flakonDiff = flakonValue === '' ? null : Number(flakonValue) - item.products.flakon_quantity
  // Son Stok — sayım girilmişse o değer, girilmemişse hâlâ canlı sistem stoğu
  // (Günlük Özet/dışa aktarımdaki aynı "productLine" hesabıyla birebir tutarlı).
  const finalPaket = paketValue === '' ? item.products.current_quantity : Number(paketValue)
  const finalFlakon = flakonValue === '' ? item.products.flakon_quantity : Number(flakonValue)

  React.useEffect(() => {
    setPaketValue(item.counted_quantity?.toString() ?? '')
  }, [item.counted_quantity])

  React.useEffect(() => {
    setFlakonValue(item.counted_quantity_flakon?.toString() ?? '')
  }, [item.counted_quantity_flakon])

  return (
    <TableRow onClick={() => onSelect(item.id)} selected={selected}>
      <TableCell className="font-medium">{item.products.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {item.products.current_quantity} {item.products.unit}, {item.products.flakon_quantity} flakon
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span>
            {item.counted_quantity ?? '—'} {item.products.unit}
          </span>
        ) : (
          <Input
            type="number"
            min="0"
            className="w-20"
            value={paketValue}
            onChange={(e) => setPaketValue(e.target.value)}
            onBlur={() => onSavePaket(item.id, paketValue === '' ? null : Number(paketValue))}
          />
        )}
      </TableCell>
      <TableCell>
        {paketDiff !== null && (
          <Badge variant={paketDiff === 0 ? 'secondary' : paketDiff > 0 ? 'success' : 'destructive'}>
            {paketDiff > 0 ? `+${paketDiff}` : paketDiff}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span>{item.counted_quantity_flakon ?? '—'} flakon</span>
        ) : (
          <Input
            type="number"
            min="0"
            className="w-20"
            value={flakonValue}
            onChange={(e) => setFlakonValue(e.target.value)}
            onBlur={() => onSaveFlakon(item.id, flakonValue === '' ? null : Number(flakonValue))}
          />
        )}
      </TableCell>
      <TableCell>
        {flakonDiff !== null && (
          <Badge variant={flakonDiff === 0 ? 'secondary' : flakonDiff > 0 ? 'success' : 'destructive'}>
            {flakonDiff > 0 ? `+${flakonDiff}` : flakonDiff}
          </Badge>
        )}
      </TableCell>
      <TableCell className="font-medium">
        {finalPaket} {item.products.unit}
        {finalFlakon > 0 && `, ${finalFlakon} flakon`}
      </TableCell>
    </TableRow>
  )
}

export function DailyCountPanel() {
  const { data: todayCount, isLoading: loadingToday } = useTodayCount()
  const { data: pastCounts = [] } = usePastCounts()
  const startMutation = useStartTodayCount()
  const completeMutation = useCompleteCount()
  const reopenMutation = useReopenCount()
  const { data: items = [] } = useCountItems(todayCount?.id)
  const updateItemMutation = useUpdateCountItem(todayCount?.id ?? '')
  const updateItemFlakonMutation = useUpdateCountItemFlakon(todayCount?.id ?? '')
  const { data: allSales = [] } = useSales()
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)

  if (loadingToday) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!todayCount) {
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

  const isCompleted = todayCount.status === 'completed'
  const previousDate =
    pastCounts
      .filter((c) => c.id !== todayCount.id)
      .map((c) => c.count_date)
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  const todayOutgoingSales = allSales.filter((s) => s.sale_date === todayCount.count_date && s.type === 'sale')

  const countDateLabel = format(new Date(todayCount.count_date), 'd MMMM yyyy', { locale: trLocale })
  const countDayLabel = format(new Date(todayCount.count_date), 'EEEE', { locale: trLocale })

  const pendingChangeCount = items.filter(
    (i) =>
      (i.counted_quantity !== null && i.counted_quantity !== i.products.current_quantity) ||
      (i.counted_quantity_flakon !== null && i.counted_quantity_flakon !== i.products.flakon_quantity),
  ).length

  // "Son stok" — sayılmışsa girilen sayım, sayılmamışsa hâlâ canlı sistem
  // stoğu (panelde ne görünüyorsa, Sayımı Tamamla sonrası depoya yansıyacak
  // gerçek son değer bu).
  function productLine(i: StockCountItemWithProduct): { metrik: string; deger: string | number } {
    const finalPaket = i.counted_quantity ?? i.products.current_quantity
    const finalFlakon = i.counted_quantity_flakon ?? i.products.flakon_quantity
    return {
      metrik: i.products.name,
      deger: finalFlakon > 0 ? `${finalPaket} ${i.products.unit}, ${finalFlakon} flakon` : `${finalPaket} ${i.products.unit}`,
    }
  }
  const dermakorItems = items.filter((i) => i.products.brand_line === 'dermakor')
  const swissItems = items.filter((i) => i.products.brand_line === 'swiss')
  const otherItems = items.filter((i) => i.products.brand_line !== 'dermakor' && i.products.brand_line !== 'swiss')

  // Sadece tarih/gün başlığı + ürünler Dermakor/Swiss diye ayrılmış liste —
  // toplam/fark gibi ayrı hesaplanan özet rakamları YOK.
  const summaryRows: { metrik: string; deger: string | number }[] = [
    { metrik: `Tarih: ${countDateLabel} (${countDayLabel})`, deger: '' },
    { metrik: '— DERMAKOR —', deger: '' },
    ...dermakorItems.map(productLine),
    { metrik: '— SWISS —', deger: '' },
    ...swissItems.map(productLine),
    ...(otherItems.length > 0 ? [{ metrik: '— DİĞER —', deger: '' }, ...otherItems.map(productLine)] : []),
  ]

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {format(new Date(todayCount.count_date), 'd MMMM yyyy', { locale: trLocale })} Sayımı
          </CardTitle>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <ExportMenu<StockCountItemWithProduct>
                title="Başlangıç Sayım Listesi"
                filename={`baslangic-listesi-${todayCount.count_date}`}
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
                    onSelect={() => exportDailyCountToExcel(todayCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <FileSpreadsheet className="text-success" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => exportDailyCountToWord(todayCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <FileText className="text-primary" /> Word (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => exportDailyCountToPdf(todayCount.count_date, previousDate, items, todayOutgoingSales)}
                  >
                    <FileType className="text-destructive" /> PDF (.pdf)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => printDailyCount(todayCount.count_date, previousDate, items, todayOutgoingSales)}
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
                  onClick={() => reopenMutation.mutate(todayCount.id)}
                  disabled={reopenMutation.isPending}
                >
                  {reopenMutation.isPending && <Loader2 className="animate-spin" />}
                  Yeniden Aç
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => completeMutation.mutate(todayCount.id)}
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
        <CardHeader>
          <CardTitle className="text-base">Sayım</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Sistemdeki Miktar</TableHead>
                <TableHead>Paket Sayımı</TableHead>
                <TableHead>Paket Fark</TableHead>
                <TableHead>Flakon Sayımı</TableHead>
                <TableHead>Flakon Fark</TableHead>
                <TableHead>Son Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <CountItemRow
                  key={item.id}
                  item={item}
                  readOnly={isCompleted}
                  selected={item.id === selectedItemId}
                  onSelect={setSelectedItemId}
                  onSavePaket={(id, value) => updateItemMutation.mutate({ id, counted_quantity: value })}
                  onSaveFlakon={(id, value) => updateItemFlakonMutation.mutate({ id, counted_quantity_flakon: value })}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Günlük Özet</CardTitle>
          <div className="flex items-center gap-2">
            <ExportMenu<{ metrik: string; deger: string | number }>
              title={`${countDateLabel} — Günlük Özet`}
              filename={`gunluk-ozet-${todayCount.count_date}`}
              triggerLabel="Özeti Dışa Aktar"
              rows={summaryRows}
              columns={[
                { header: 'Ürün', value: (r) => r.metrik },
                { header: 'Adet', value: (r) => r.deger },
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

      <TodaySalesActivity countDate={todayCount.count_date} />

      {pastCounts.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Geçmiş Sayımlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pastCounts
              .filter((c) => c.id !== todayCount.id)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{format(new Date(c.count_date), 'd MMMM yyyy', { locale: trLocale })}</span>
                  <Badge variant={c.status === 'completed' ? 'success' : 'secondary'}>
                    {c.status === 'completed' ? 'Tamamlandı' : 'Açık'}
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
