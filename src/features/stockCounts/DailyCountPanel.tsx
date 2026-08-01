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
  useStartTodayCount,
  useTodayCount,
  useUpdateCountItem,
} from './hooks'
import { exportDailyCountToExcel, exportDailyCountToPdf, exportDailyCountToWord, printDailyCount } from './exportDailyCount'
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

function CountItemRow({
  item,
  readOnly,
  onSave,
}: {
  item: { id: string; expected_quantity: number; counted_quantity: number | null; products: { name: string; unit: string } }
  readOnly: boolean
  onSave: (id: string, value: number | null) => void
}) {
  const [value, setValue] = React.useState(item.counted_quantity?.toString() ?? '')
  const diff = value === '' ? null : Number(value) - item.expected_quantity

  return (
    <TableRow>
      <TableCell className="font-medium">{item.products.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {item.expected_quantity} {item.products.unit}
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
            className="w-24"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onSave(item.id, value === '' ? null : Number(value))}
          />
        )}
      </TableCell>
      <TableCell>
        {diff !== null && (
          <Badge variant={diff === 0 ? 'secondary' : diff > 0 ? 'success' : 'destructive'}>
            {diff > 0 ? `+${diff}` : diff}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  )
}

export function DailyCountPanel() {
  const { data: todayCount, isLoading: loadingToday } = useTodayCount()
  const { data: pastCounts = [] } = usePastCounts()
  const startMutation = useStartTodayCount()
  const completeMutation = useCompleteCount()
  const { data: items = [] } = useCountItems(todayCount?.id)
  const updateItemMutation = useUpdateCountItem(todayCount?.id ?? '')
  const { data: allSales = [] } = useSales()

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
              <Badge variant="success">
                <CheckCircle2 className="size-3" /> Tamamlandı
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => completeMutation.mutate(todayCount.id)}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending && <Loader2 className="animate-spin" />}
                Sayımı Tamamla ve Stoğu Güncelle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Sistemdeki Miktar</TableHead>
                <TableHead>Sayılan</TableHead>
                <TableHead>Fark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <CountItemRow
                  key={item.id}
                  item={item}
                  readOnly={isCompleted}
                  onSave={(id, value) => updateItemMutation.mutate({ id, counted_quantity: value })}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
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
