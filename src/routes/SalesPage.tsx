import * as React from 'react'
import { format, startOfMonth, subMonths } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ShoppingCart, Undo2, Trash2, BarChart3, FileText, TrendingUp, TrendingDown, Users, Loader2, Target, Check } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { RevenueChart, type RevenueChartPoint } from '@/components/charts/RevenueChart'
import { SaleForm } from '@/features/sales/SaleForm'
import { useSales, useDeleteSale, useDeleteAllSales } from '@/features/sales/hooks'
import { deleteSale, type SaleWithRelations } from '@/features/sales/api'
import { importSaleRows, SALE_IMPORT_HEADERS, SALE_IMPORT_SAMPLE_ROWS } from '@/features/sales/importSales'
import { InvoiceForm } from '@/features/invoices/InvoiceForm'
import { useInvoices, useDeleteInvoice } from '@/features/invoices/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useExpenses } from '@/features/expenses/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useProducts } from '@/features/stock/hooks'
import { useSalesReps, useUpdateSalesRep } from '@/features/salesReps/hooks'
import { cn, getErrorMessage } from '@/lib/utils'
import type { ImportSummary } from '@/lib/importData'
import { exportToExcelMultiSheet, type ExportColumn } from '@/lib/exportData'
import type { SalesRep } from '@/types/database'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useQueryClient } from '@tanstack/react-query'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function netAmount(s: { type: string; quantity: number; unit_price: number }) {
  return (s.type === 'return' ? -1 : 1) * s.quantity * Number(s.unit_price)
}

const SALE_REPORT_COLUMNS: ExportColumn<SaleWithRelations>[] = [
  { header: 'Tarih', value: (s) => format(new Date(s.sale_date), 'd MMM yyyy', { locale: trLocale }) },
  { header: 'Personel', value: (s) => s.sales_reps?.name ?? '—' },
  { header: 'Doktor', value: (s) => s.customers?.full_name ?? '—' },
  { header: 'Tür', value: (s) => (s.type === 'sale' ? 'Satış' : 'İade') },
  { header: 'Ürün', value: (s) => s.product_name },
  { header: 'Adet', value: (s) => s.quantity },
  { header: 'Birim Fiyat', value: (s) => Number(s.unit_price) },
  { header: 'Tutar', value: (s) => s.quantity * Number(s.unit_price) },
  { header: 'Kongre/Workshop', value: (s) => s.congress_name ?? '—' },
  { header: 'Not', value: (s) => s.note ?? '—' },
]

function filterSalesByDate<T extends { sale_date: string }>(sales: T[], from: string, to: string): T[] {
  return sales.filter((s) => {
    if (from && s.sale_date < from) return false
    if (to && s.sale_date > to) return false
    return true
  })
}

/**
 * Aynı doktora aynı tarihte (aynı tür — satış/iade) eklenen birden fazla ürün
 * artık listede ayrı ayrı doktor adı tekrar eden satırlar yerine TEK grup
 * altında toplanıyor (kullanıcı isteği, 2026-08-26: "ürünleri adetleri tek
 * kişiye eklemeliyim... tek yazmalı"). Sıra, gelen listenin (sale_date desc)
 * sırasını korur — bir grubun ilk göründüğü noktaya yerleşir.
 */
function groupSalesByDoctorDate(sales: SaleWithRelations[]): SaleWithRelations[][] {
  const map = new Map<string, SaleWithRelations[]>()
  const order: string[] = []
  for (const s of sales) {
    const key = `${s.customer_id}|${s.sale_date}|${s.type}`
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(s)
  }
  return order.map((key) => map.get(key)!)
}

/**
 * "Tümünü Sil" (kullanıcı isteği, 2026-08-25) — Stok'taki "Tüm Ürünleri
 * Sıfırla" ile aynı sade Onayla/Vazgeç deseni (useConfirmDialog), gerekçe
 * metni istemez, RPC'ye sabit bir metin otomatik gönderilir.
 */
function DeleteAllSalesButton({ count }: { count: number }) {
  const deleteAllMutation = useDeleteAllSales()
  const { confirm, dialog } = useConfirmDialog()

  async function handleClick() {
    if (
      !(await confirm(`${count} satış/iade kaydının TÜMÜ silinecek ve stok etkileri tersine çevrilecek. Bu işlem geri alınamaz.`, {
        title: 'Tüm Satış/İade Kayıtlarını Sil',
        confirmLabel: 'Onayla',
      }))
    )
      return
    deleteAllMutation.mutate(`Tüm satış/iade kayıtlarını sil (${new Date().toLocaleString('tr-TR')})`)
  }

  return (
    <>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleClick} disabled={count === 0}>
        <Trash2 />
        Tümünü Sil
      </Button>
      {dialog}
    </>
  )
}

function SalesTab({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  const { data: allSales = [], isLoading } = useSales()
  const deleteMutation = useDeleteSale()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const sales = React.useMemo(() => filterSalesByDate(allSales, from, to), [allSales, from, to])

  // Silme, stoktaki etkiyi de tersine çevirir — bu artık delete_sale RPC'si
  // (sunucu) tarafında guard'sız/kenetlenen bir hareketle yapılıyor, burada
  // ayrıca çağırmaya gerek yok (kullanıcı isteği, 2026-08-25: "satışta iade
  // olan kısmındaki ürünü silmiyor hata veriyor" — önceki ayrı record_stock_movement
  // çağrısı, aradan geçen zamanda stok tükenmişse "yetersiz stok" diye
  // reddedebiliyordu).
  async function handleDelete(sale: SaleWithRelations) {
    if (
      !(await confirm(`${sale.product_name} (${sale.quantity} adet) ${sale.type === 'sale' ? 'satış' : 'iade'} kaydı silinsin mi?`))
    )
      return
    deleteMutation.mutate(sale.id)
  }

  const totalSales = sales.filter((s) => s.type === 'sale').reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
  const totalReturns = sales
    .filter((s) => s.type === 'return')
    .reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:flex sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="sales-from">Başlangıç</Label>
          <Input id="sales-from" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sales-to">Bitiş</Label>
          <Input id="sales-to" type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShoppingCart className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Toplam Satış</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalSales)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <Undo2 className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Toplam İade</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalReturns)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
          {!isLoading && sales.length === 0 && (
            <p className="text-muted-foreground p-6">Henüz satış veya iade kaydı yok.</p>
          )}
          {sales.length > 0 && (
            <div className="divide-y">
              {groupSalesByDoctorDate(sales).map((group) => {
                const first = group[0]
                return (
                  <div key={`${first.customer_id}-${first.sale_date}-${first.type}`} className="p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(first.sale_date), 'd MMM yyyy', { locale: trLocale })}
                      </span>
                      {first.type === 'sale' ? (
                        <Badge variant="secondary">Satış</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          İade
                        </Badge>
                      )}
                      <span className="font-medium">{first.customers?.full_name ?? '—'}</span>
                      {first.congress_name && (
                        <span className="text-warning text-sm font-bold">/ {first.congress_name}</span>
                      )}
                      {first.sales_reps?.name && (
                        <span className="text-primary font-semibold">/ {first.sales_reps.name}</span>
                      )}
                    </div>
                    <div className="grid gap-1">
                      {group.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={cn(
                            'flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm',
                            s.id === selectedId ? 'bg-primary/10' : 'bg-muted/40',
                          )}
                        >
                          <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1">
                            <span className="min-w-32 flex-1">{s.product_name}</span>
                            <span className="text-muted-foreground w-20 text-right">{s.quantity} adet</span>
                            <span className="text-muted-foreground w-24 text-right">
                              {currency(Number(s.unit_price))}
                            </span>
                            <span className="w-28 text-right font-medium">
                              {currency(s.quantity * Number(s.unit_price))}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <SaleForm sale={s} />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(s)
                              }}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  )
}

/**
 * Bir personelin aylık satış hedefi (`sales_reps.sales_target`) ve prim
 * oranını (`sales_reps.commission_rate`) düzenleyen form + o dönem için
 * hesaplanan durum/prim özeti. Bu iki kolon şemada zaten vardı ama hiçbir
 * ekranda kullanılmıyordu (kullanıcı isteği, 2026-08-28: "yüzde kaç prim
 * alacağı... aylık satış belirlensin... ayrı bir bölümde olsun" ile ilk kez
 * buradan kullanılıyor). `key={rep.id}` ile üst bileşenden seçili personel
 * değiştiğinde YENİDEN mount edilecek şekilde render edilir — bu yüzden
 * inputlar başlangıç değerini doğrudan prop'tan alabilir, personel
 * değiştikçe senkronize eden ayrı bir effect'e gerek yok.
 */
function RepTargetEditor({ rep, netTotal }: { rep: SalesRep; netTotal: number }) {
  const updateRepMutation = useUpdateSalesRep()
  const [targetValue, setTargetValue] = React.useState<number | undefined>(rep.sales_target ?? undefined)
  const [rateInput, setRateInput] = React.useState(rep.commission_rate != null ? String(rep.commission_rate) : '')

  function handleSave() {
    updateRepMutation.mutate({
      id: rep.id,
      input: {
        sales_target: targetValue ?? null,
        commission_rate: rateInput.trim() === '' ? null : Number(rateInput),
      },
    })
  }

  // Kaydedilmemiş olsa bile inputlara yazılan anlık değerle hesaplanır —
  // kullanıcı isteği (2026-08-28: "yüzde ve prim miktarını girince sonunda
  // alması gereken primi göstersin"): Kaydet'e basmadan önce de önizleme.
  const liveRate = Number(rateInput || 0)
  const liveCommission = netTotal * (liveRate / 100)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="staff-target">Aylık Satış Hedefi</Label>
          <CurrencyInput id="staff-target" value={targetValue} onChange={setTargetValue} className="w-44" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="staff-rate">Prim Oranı (%)</Label>
          <Input
            id="staff-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            className="w-32"
          />
        </div>
        <Button onClick={handleSave} disabled={updateRepMutation.isPending}>
          {updateRepMutation.isPending && <Loader2 className="animate-spin" />}
          Kaydet
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Dönem Net Cirosu</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{currency(netTotal)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Hedef Durumu</p>
          {targetValue != null ? (
            <Badge variant={netTotal >= targetValue ? 'success' : 'outline'} className="mt-1">
              {currency(netTotal)} / {currency(targetValue)}
            </Badge>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">Hedef belirlenmedi</p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Hak Edilen Prim (%{liveRate})
          </p>
          <p className="text-success mt-1 text-xl font-semibold tabular-nums">{currency(liveCommission)}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * "Tüm Personel" tablosundaki her satır — hedef/prim oranı, o kişiyi ayrıca
 * tek tek seçmeye gerek kalmadan doğrudan satırdan düzenlenebilsin diye
 * (kullanıcı isteği, 2026-08-28: "manuel düzeltilebilsin buradaki
 * ayarlar"). Mantık RepTargetEditor ile aynı (kaydedilene kadar sadece
 * inputlar değişir, rozet/prim hep KAYITLI değere göre hesaplanır) — burada
 * tablo satırı şeklinde.
 */
function RepTargetTableRow({ rep, net }: { rep: SalesRep; net: number }) {
  const updateRepMutation = useUpdateSalesRep()
  const [targetValue, setTargetValue] = React.useState<number | undefined>(rep.sales_target ?? undefined)
  const [rateInput, setRateInput] = React.useState(rep.commission_rate != null ? String(rep.commission_rate) : '')

  function handleSave() {
    updateRepMutation.mutate({
      id: rep.id,
      input: {
        sales_target: targetValue ?? null,
        commission_rate: rateInput.trim() === '' ? null : Number(rateInput),
      },
    })
  }

  // Kaydedilmeden önce de anlık önizleme (bkz. RepTargetEditor'daki aynı not).
  const liveRate = Number(rateInput || 0)
  const liveCommission = net * (liveRate / 100)

  return (
    <TableRow>
      <TableCell className="text-primary font-semibold whitespace-nowrap">{rep.name}</TableCell>
      <TableCell className="text-right">
        <CurrencyInput value={targetValue} onChange={setTargetValue} className="ml-auto w-32" />
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">{currency(net)}</TableCell>
      <TableCell>
        {targetValue != null ? (
          <Badge variant={net >= targetValue ? 'success' : 'outline'}>
            {net >= targetValue ? 'Hedef Aşıldı' : 'Hedef Altında'}
          </Badge>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          className="ml-auto w-20 text-right"
        />
      </TableCell>
      <TableCell className="text-success text-right font-semibold tabular-nums whitespace-nowrap">
        {currency(liveCommission)}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={handleSave} disabled={updateRepMutation.isPending}>
          {updateRepMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </Button>
      </TableCell>
    </TableRow>
  )
}

/**
 * "Personel Satış Raporu" — kullanıcı isteği (2026-08-28): her satış
 * temsilcisinin hangi doktora ne ürün sattığını, ne not yazdığını, hangi
 * tarihte ve ne fiyattan sattığını kişi kişi ayrı görebilmek, Excel'e
 * aktarabilmek, ve aynı ekrandan düzenleyip/silebilmek. `useSales()` ile
 * aynı veri kaynağını (dolayısıyla stokla aynı satış kayıtlarını) kullanır —
 * ayrı bir sorgu/hesaplama katmanı yok, sadece `sales_rep_id`/tarihe göre
 * filtreleme. "Tümünü Sil" burada SADECE o an filtrelenmiş (seçili personel
 * + tarih aralığı) kayıtları siler — `delete_sale` RPC'sini (stok etkisini
 * doğru şekilde tersine çeviren, zaten tek satış silmede kullanılan aynı
 * fonksiyon) her satır için sırayla çağırır; yeni bir toplu-silme SQL
 * fonksiyonu yazmak yerine kanıtlanmış tek-satır mantığını tekrar kullanmak
 * hata riskini azaltıyor.
 */
function StaffSalesReportTab() {
  const { data: allSales = [], isLoading } = useSales()
  const { data: reps = [] } = useSalesReps()
  const deleteMutation = useDeleteSale()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirmDialog()
  const [repId, setRepId] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  const filtered = React.useMemo(() => {
    const byRep = repId ? allSales.filter((s) => s.sales_rep_id === repId) : allSales
    return filterSalesByDate(byRep, from, to)
  }, [allSales, repId, from, to])

  const selectedRep = repId ? reps.find((r) => r.id === repId) : undefined
  const selectedRepName = selectedRep?.name ?? 'Tüm Personel'
  const totalSales = filtered.filter((s) => s.type === 'sale').reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
  const totalReturns = filtered
    .filter((s) => s.type === 'return')
    .reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
  const commissionRate = Number(selectedRep?.commission_rate ?? 0)

  const monthlyTotals = React.useMemo(() => {
    const map = new Map<string, { label: string; sales: number; returns: number }>()
    for (const s of filtered) {
      const key = s.sale_date.slice(0, 7)
      if (!map.has(key)) {
        map.set(key, { label: format(new Date(s.sale_date), 'MMMM yyyy', { locale: trLocale }), sales: 0, returns: 0 })
      }
      const bucket = map.get(key)!
      const amount = s.quantity * Number(s.unit_price)
      if (s.type === 'sale') bucket.sales += amount
      else bucket.returns += amount
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, v]) => ({ key, ...v, net: v.sales - v.returns, commission: (v.sales - v.returns) * (commissionRate / 100) }))
  }, [filtered, commissionRate])

  /**
   * "Tümü" görünümünde her personelin hedef/prim durumu — kullanıcı isteği
   * (2026-08-28: "yüzde kaç prim alacağı... yapması gereken aylık satış
   * belirlensin... ayrı bir bölümde olsun"). `sales_reps.sales_target` /
   * `commission_rate` mevcut ama daha önce hiçbir ekranda kullanılmıyordu —
   * bu, tek/tüm personel görünümüne göre bunları kullanan/düzenleyen ilk yer.
   * Prim, hedef tutturulup tutturulmadığına BAKMAKSIZIN dönemin net cirosunun
   * (satış - iade) prim oranı kadarı olarak hesaplanıyor; hedef sadece
   * karşılaştırma/ilerleme göstergesi.
   */
  const repTargetRows = React.useMemo(() => {
    const dated = filterSalesByDate(allSales, from, to)
    return reps.map((r) => {
      const repSales = dated.filter((s) => s.sales_rep_id === r.id)
      const sales = repSales.filter((s) => s.type === 'sale').reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
      const returns = repSales
        .filter((s) => s.type === 'return')
        .reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
      return { rep: r, net: sales - returns }
    })
  }, [reps, allSales, from, to])

  async function handleDelete(sale: SaleWithRelations) {
    if (
      !(await confirm(`${sale.product_name} (${sale.quantity} adet) ${sale.type === 'sale' ? 'satış' : 'iade'} kaydı silinsin mi?`))
    )
      return
    deleteMutation.mutate(sale.id)
  }

  async function handleDeleteAllFiltered() {
    if (filtered.length === 0) return
    if (
      !(await confirm(
        `${selectedRepName} için listelenen ${filtered.length} satış/iade kaydının TÜMÜ silinecek ve stok etkileri tersine çevrilecek. Bu işlem geri alınamaz.`,
        { title: 'Tümünü Sil', confirmLabel: 'Onayla' },
      ))
    )
      return
    setBulkDeleting(true)
    try {
      for (const s of filtered) {
        await deleteSale(s.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      toast.success(`${filtered.length} kayıt silindi`)
    } catch (error) {
      toast.error('Bazı kayıtlar silinemedi', { description: getErrorMessage(error) })
    } finally {
      setBulkDeleting(false)
    }
  }

  /**
   * "Tüm Personel" seçiliyken tek Excel dosyasında kişi başına ayrı sekme —
   * kullanıcı isteği (2026-08-28: "dışarı aktarırken kişi kişi
   * alabilmeliyim"). Personeli olmayan (sales_rep_id null) satışlar da
   * "Belirtilmemiş" adıyla ayrı bir sekmede toplanıyor, hiçbir satır sessizce
   * atlanmıyor.
   */
  function handleExportPerRep() {
    const byRep = new Map<string, SaleWithRelations[]>()
    for (const s of filtered) {
      const key = s.sales_reps?.name ?? 'Belirtilmemiş'
      if (!byRep.has(key)) byRep.set(key, [])
      byRep.get(key)!.push(s)
    }
    exportToExcelMultiSheet(
      'personel-satis-raporu-kisi-kisi',
      Array.from(byRep.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'tr'))
        .map(([name, rows]) => ({ name, columns: SALE_REPORT_COLUMNS, rows })),
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-48 gap-1.5">
          <Label>Personel</Label>
          <Select value={repId || 'all'} onValueChange={(v) => setRepId(v === 'all' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Tüm Personel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Personel</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="staff-report-from">Başlangıç</Label>
          <Input id="staff-report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="staff-report-to">Bitiş</Label>
          <Input id="staff-report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <ExportMenu<SaleWithRelations>
            title={`Personel Satış Raporu — ${selectedRepName}`}
            filename={`personel-satis-raporu-${selectedRepName}`}
            rows={filtered}
            columns={SALE_REPORT_COLUMNS}
          />
          {!repId && (
            <Button variant="outline" onClick={handleExportPerRep} disabled={filtered.length === 0}>
              <Users className="size-3.5" />
              Kişi Kişi Dışa Aktar
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={handleDeleteAllFiltered}
            disabled={filtered.length === 0 || bulkDeleting}
          >
            {bulkDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Tümünü Sil
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4" /> Hedef ve Prim {selectedRep ? `— ${selectedRepName}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedRep ? (
            <RepTargetEditor key={selectedRep.id} rep={selectedRep} netTotal={totalSales - totalReturns} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead className="text-right">Hedef (₺)</TableHead>
                    <TableHead className="text-right">Dönem Net Cirosu</TableHead>
                    <TableHead>Hedef Durumu</TableHead>
                    <TableHead className="text-right">Prim Oranı (%)</TableHead>
                    <TableHead className="text-right">Hak Edilen Prim</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repTargetRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                        Henüz personel yok
                      </TableCell>
                    </TableRow>
                  )}
                  {repTargetRows.map(({ rep, net }) => (
                    <RepTargetTableRow key={rep.id} rep={rep} net={net} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-muted-foreground p-6">Bu filtreye uyan satış/iade kaydı yok.</p>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Personel</TableHead>
                    <TableHead>Doktor</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Kongre/Workshop</TableHead>
                    <TableHead>Not</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(s.sale_date), 'd MMM yyyy', { locale: trLocale })}
                      </TableCell>
                      <TableCell className="text-primary font-semibold whitespace-nowrap">
                        {s.sales_reps?.name ?? '—'}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{s.customers?.full_name ?? '—'}</TableCell>
                      <TableCell>
                        {s.type === 'sale' ? (
                          <Badge variant="secondary">Satış</Badge>
                        ) : (
                          <Badge variant="outline" className="border-destructive/30 text-destructive">
                            İade
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{s.product_name}</TableCell>
                      <TableCell className="text-right">{s.quantity}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{currency(Number(s.unit_price))}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {currency(s.quantity * Number(s.unit_price))}
                      </TableCell>
                      <TableCell className="text-warning font-bold whitespace-nowrap">
                        {s.congress_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.note ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <SaleForm sale={s} />
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aylık Toplam Ciro — {selectedRepName}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {monthlyTotals.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">Bu filtreye uyan satış/iade kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ay</TableHead>
                  <TableHead className="text-right">Toplam Satış</TableHead>
                  <TableHead className="text-right">Toplam İade</TableHead>
                  <TableHead className="text-right">Net Ciro</TableHead>
                  {selectedRep && <TableHead className="text-right">Hak Edilen Prim</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyTotals.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium capitalize">{m.label}</TableCell>
                    <TableCell className="text-success text-right">{currency(m.sales)}</TableCell>
                    <TableCell className="text-destructive text-right">{currency(m.returns)}</TableCell>
                    <TableCell className="text-right font-semibold">{currency(m.net)}</TableCell>
                    {selectedRep && (
                      <TableCell className="text-success text-right font-semibold">{currency(m.commission)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  )
}

function IncomeExpenseReport() {
  const sixMonthsAgo = React.useMemo(() => startOfMonth(subMonths(new Date(), 5)), [])
  const { data: payments = [] } = usePayments({ from: sixMonthsAgo.toISOString() })
  const { data: expenses = [] } = useExpenses({ from: sixMonthsAgo.toISOString() })
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null)

  const rows = React.useMemo(() => {
    const buckets = new Map<string, { label: string; income: number; expense: number }>()
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const key = format(d, 'yyyy-MM')
      buckets.set(key, { label: format(d, 'MMM yyyy', { locale: trLocale }), income: 0, expense: 0 })
    }
    for (const p of payments) {
      const key = format(new Date(p.paid_at), 'yyyy-MM')
      if (buckets.has(key)) buckets.get(key)!.income += Number(p.amount)
    }
    for (const e of expenses) {
      const key = format(new Date(e.expense_date), 'yyyy-MM')
      if (buckets.has(key)) buckets.get(key)!.expense += Number(e.amount)
    }
    return Array.from(buckets.values())
  }, [payments, expenses])

  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
  const totalExpense = rows.reduce((sum, r) => sum + r.expense, 0)
  const netProfit = totalIncome - totalExpense

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Gelir-Gider Raporu (Son 6 Ay)</CardTitle>
        <ExportMenu
          filename="gelir-gider-raporu"
          title="Gelir-Gider Raporu"
          columns={[
            { header: 'Ay', value: (r) => r.label },
            { header: 'Gelir', value: (r) => r.income },
            { header: 'Gider', value: (r) => r.expense },
            { header: 'Net Kâr', value: (r) => r.income - r.expense },
          ]}
          rows={rows}
        />
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Toplam Gelir</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{currency(totalIncome)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Toplam Gider</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{currency(totalExpense)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Net Kâr</p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums',
                netProfit >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {netProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              {currency(netProfit)}
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ay</TableHead>
              <TableHead>Gelir</TableHead>
              <TableHead>Gider</TableHead>
              <TableHead>Net Kâr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label} onClick={() => setSelectedLabel(r.label)} selected={r.label === selectedLabel}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-success">{currency(r.income)}</TableCell>
                <TableCell className="text-destructive">{currency(r.expense)}</TableCell>
                <TableCell className={cn('font-medium', r.income - r.expense >= 0 ? 'text-success' : 'text-destructive')}>
                  {currency(r.income - r.expense)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ReportsTab() {
  const { data: sales = [] } = useSales()

  const byProduct = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) map.set(s.product_name, (map.get(s.product_name) ?? 0) + netAmount(s))
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8) as RevenueChartPoint[]
  }, [sales])

  const byDoctor = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const name = s.customers?.full_name ?? 'Bilinmeyen'
      map.set(name, (map.get(name) ?? 0) + netAmount(s))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  const byRep = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const name = s.sales_reps?.name ?? 'Belirtilmemiş'
      map.set(name, (map.get(name) ?? 0) + netAmount(s))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  return (
    <div className="grid gap-6">
      <IncomeExpenseReport />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">En Çok Satan / İade Edilen Ürünler</CardTitle>
        </CardHeader>
        <CardContent>
          {byProduct.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz veri yok</p>
          ) : (
            <RevenueChart data={byProduct} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doktor Bazlı Net Satış</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {byDoctor.length === 0 && <p className="text-muted-foreground text-sm">Henüz veri yok</p>}
            {byDoctor.map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{d.name}</span>
                <Badge variant="outline">{currency(d.total)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Satış Temsilcisi Bazlı Net Satış</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {byRep.length === 0 && <p className="text-muted-foreground text-sm">Henüz veri yok</p>}
            {byRep.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <Badge variant="outline">{currency(r.total)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InvoicesTab() {
  const { data: invoices = [], isLoading } = useInvoices()
  const deleteMutation = useDeleteInvoice()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
        {!isLoading && invoices.length === 0 && (
          <p className="text-muted-foreground p-6">Henüz fatura kaydı yok.</p>
        )}
        {invoices.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fatura No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Doktor</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Not</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} onClick={() => setSelectedId(inv.id)} selected={inv.id === selectedId}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{format(new Date(inv.issue_date), 'd MMM yyyy', { locale: trLocale })}</TableCell>
                  <TableCell>{inv.customers?.full_name ?? '—'}</TableCell>
                  <TableCell>{currency(Number(inv.amount))}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.note ?? '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(inv.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function SalesPage() {
  const { data: allSales = [] } = useSales()
  const { data: invoices = [] } = useInvoices()
  const { data: doctors = [] } = useCustomers('')
  const { data: products = [] } = useProducts('')
  const { data: salesReps = [] } = useSalesReps()
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState('sales')
  const [salesFrom, setSalesFrom] = React.useState('')
  const [salesTo, setSalesTo] = React.useState('')

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const summary = await importSaleRows(rows, allSales, doctors, products, salesReps)
    if (summary.added > 0) {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
    return summary
  }

  const sales = React.useMemo(
    () => filterSalesByDate(allSales, salesFrom, salesTo),
    [allSales, salesFrom, salesTo],
  )

  return (
    <div>
      <PageHeader
        title="Satışlar"
        description="Satışlar, iadeler, raporlar ve faturalar tek bölümde"
        actions={
          <div className="flex gap-2">
            {tab === 'sales' && (
              <ExportMenu
                filename="satislar"
                title="Satışlar"
                columns={[
                  { header: 'Tarih', value: (r) => r.sale_date },
                  { header: 'Doktor', value: (r) => r.doctor },
                  { header: 'Ürün', value: (r) => r.product_name },
                  { header: 'Adet', value: (r) => r.quantity },
                  { header: 'Toplam', value: (r) => r.total },
                  { header: 'Satış Temsilcisi', value: (r) => r.sales_rep },
                ]}
                rows={sales.map((s) => ({
                  sale_date: s.sale_date,
                  doctor: s.customers?.full_name ?? '',
                  product_name: s.product_name,
                  quantity: s.quantity,
                  total: s.quantity * Number(s.unit_price),
                  sales_rep: s.sales_reps?.name ?? '',
                }))}
              />
            )}
            {tab === 'invoices' && (
              <ExportMenu
                filename="faturalar"
                title="Faturalar"
                columns={[
                  { header: 'Fatura No', value: (r) => r.invoice_number },
                  { header: 'Tarih', value: (r) => r.issue_date },
                  { header: 'Doktor', value: (r) => r.doctor },
                  { header: 'Tutar', value: (r) => r.amount },
                  { header: 'Not', value: (r) => r.note },
                ]}
                rows={invoices.map((inv) => ({
                  invoice_number: inv.invoice_number,
                  issue_date: inv.issue_date,
                  doctor: inv.customers?.full_name ?? '',
                  amount: Number(inv.amount),
                  note: inv.note ?? '',
                }))}
              />
            )}
            {tab === 'sales' && (
              <ImportMenu
                onImport={handleImport}
                templateFilename="satislar-sablon"
                templateHeaders={SALE_IMPORT_HEADERS}
                templateSampleRows={SALE_IMPORT_SAMPLE_ROWS}
              />
            )}
            {tab === 'sales' && <DeleteAllSalesButton count={allSales.length} />}
            {tab === 'sales' && <SaleForm />}
            {tab === 'invoices' && <InvoiceForm />}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="sales">
            <ShoppingCart className="size-3.5" /> Satışlar
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="size-3.5" /> Raporlar
          </TabsTrigger>
          <TabsTrigger value="staff-report">
            <Users className="size-3.5" /> Personel Satış Raporu
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="size-3.5" /> Faturalar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <SalesTab from={salesFrom} to={salesTo} onFromChange={setSalesFrom} onToChange={setSalesTo} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="staff-report">
          <StaffSalesReportTab />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
