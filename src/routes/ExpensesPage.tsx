import * as React from 'react'
import {
  Trash2,
  Pencil,
  Wrench,
  Receipt as ReceiptIcon,
  Zap,
  FileSpreadsheet,
  Droplets,
  Flame,
  Wifi,
  Phone,
  Building2,
  CookingPot,
  UtensilsCrossed,
  Utensils,
  Fuel,
  Truck,
  Handshake,
  House,
  Megaphone,
  BedDouble,
  Car,
  Briefcase,
  Shapes,
  Wallet,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { BulkDeleteBar } from '@/components/BulkDeleteBar'
import { deleteExpense } from '@/features/expenses/api'
import { useQueryClient } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { useDeleteExpense, useExpenses } from '@/features/expenses/hooks'
import { ExportMenu } from '@/components/ExportMenu'
import { tr } from '@/i18n/tr'
import type { Expense } from '@/types/database'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { exportToExcelMultiSheet } from '@/lib/exportData'
import { EXPENSE_ENTRY_SECTIONS } from '@/features/expenseEntries/api'
import { useExpenseEntries } from '@/features/expenseEntries/hooks'
import { ExpenseEntriesPanel } from '@/features/expenseEntries/ExpenseEntriesPanel'
import { entryExportColumns } from '@/features/expenseEntries/columns'
import { confirmAction } from '@/hooks/useConfirmDialog'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'react-router-dom'
import { BillsPage } from '@/routes/BillsPage'
import { useUtilityBills } from '@/features/bills/hooks'
import type { UtilityBillCategory } from '@/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}
const currency0 = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

/** Kategori simgeleri ve grupları (kullanıcı isteği, 2026-11-19: "giderler premium olmalı, kategori şeklinde, bakkal hesabı gibi değil") */
const SECTION_ICON: Record<string, LucideIcon> = {
  genel: ReceiptIcon,
  fatura_takibi: CalendarClock,
  elektrik: Zap,
  su: Droplets,
  dogalgaz: Flame,
  internet: Wifi,
  haberlesme: Phone,
  ofis: Building2,
  mutfak: CookingPot,
  ofis_yemek: UtensilsCrossed,
  yemek_mutfak: Utensils,
  akaryakit: Fuel,
  kargo: Truck,
  hizmet: Handshake,
  kira: House,
  reklam: Megaphone,
  konaklama: BedDouble,
  arac_kiralama: Car,
  arac_bakim: Wrench,
  danismanlik: Briefcase,
  diger: Shapes,
}
/** Gider bölümü → fatura türü: Elektrik faturaları Elektrik'in içinde, Su faturaları Su'yun içinde… (2026-11-19) */
const BILL_CATEGORY_OF: Record<string, UtilityBillCategory | undefined> = {
  elektrik: 'elektrik',
  su: 'su',
  dogalgaz: 'dogalgaz',
  internet: 'internet',
  haberlesme: 'telefon',
  // "Diğer" türündeki faturalar da kaybolmasın
  diger: 'diger',
}
const SECTION_GROUPS: { label: string; tone: string; keys: string[] }[] = [
  { label: 'Faturalar', tone: 'bg-sky-500', keys: ['elektrik', 'su', 'dogalgaz', 'internet', 'haberlesme'] },
  { label: 'Ofis ve Yemek', tone: 'bg-amber-500', keys: ['ofis', 'mutfak', 'ofis_yemek', 'yemek_mutfak'] },
  { label: 'Araç ve Ulaşım', tone: 'bg-emerald-500', keys: ['akaryakit', 'arac_kiralama', 'arac_bakim', 'kargo', 'konaklama'] },
  { label: 'Hizmet ve Diğer', tone: 'bg-violet-500', keys: ['hizmet', 'kira', 'reklam', 'danismanlik', 'diger'] },
]

export function ExpensesPage() {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { data: expenses = [], isLoading } = useExpenses({
    from: from ? new Date(from + 'T00:00:00').toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  })
  const deleteMutation = useDeleteExpense()
  // Genel giderlerde toplu silme (2026-11-19)
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = React.useState(false)
  const queryClient = useQueryClient()
  const pickedList = expenses.filter((e) => picked.has(e.id))
  async function bulkDeleteExpenses() {
    if (!pickedList.length || !(await confirmAction(`Seçili ${pickedList.length} gider kaydı (${currency(pickedList.reduce((s, e) => s + Number(e.amount), 0))}) silinsin mi? Bu işlem geri alınamaz.`))) return
    setBulkBusy(true)
    let ok = 0
    for (const e of pickedList) {
      try {
        await deleteExpense(e.id)
        ok++
      } catch (err) {
        toast.error('Bir kayıt silinemedi', { description: err instanceof Error ? err.message : String(err) })
      }
    }
    setBulkBusy(false)
    setPicked(new Set())
    void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    if (ok) toast.success(`${ok} gider silindi`)
  }
  // Fatura, ofis ve muhasebe gider bölümleri (kullanıcı isteği, 2026-11-11 / 2026-11-12)
  // ?bolum=fatura_takibi gibi doğrudan bağlantı (eski /faturalar sayfası buraya yönlenir)
  const [searchParams] = useSearchParams()
  const bolum = searchParams.get('bolum')
  const [tab, setTab] = React.useState(bolum === 'fatura_takibi' ? 'elektrik' : bolum || 'genel')
  const { data: utilityBills = [] } = useUtilityBills()
  const unpaidBills = utilityBills.filter((b) => !b.is_paid)
  const unpaidBillsTotal = unpaidBills.reduce((sum, b) => sum + Number(b.amount), 0)
  const { data: entries = [], isLoading: entriesLoading } = useExpenseEntries({ from: from || undefined, to: to || undefined })
  const entriesTotal = entries.reduce((sum, e) => sum + Number(e.amount), 0)

  function exportAllSections() {
    if (entries.length === 0) {
      toast.error('Dışa aktarılacak veri yok')
      return
    }
    // Her bölüm Excel'de ayrı sayfa (eskiden yeniye)
    exportToExcelMultiSheet(
      'bolum-giderleri',
      EXPENSE_ENTRY_SECTIONS.map((section) => ({
        name: section.label.replace(/[()]/g, ''),
        columns: entryExportColumns(section),
        rows: entries.filter((e) => e.category === section.key).reverse(),
      })),
    )
  }

  const serviceTotal = expenses
    .filter((e) => e.category === 'hizmet_gideri')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const otherTotal = expenses.filter((e) => e.category === 'diger').reduce((sum, e) => sum + Number(e.amount), 0)
  const grandTotal = serviceTotal + otherTotal + entriesTotal
  const groupTotals = SECTION_GROUPS.map((g) => ({
    label: g.label,
    tone: g.tone,
    total: entries.filter((e) => g.keys.includes(e.category)).reduce((sum, e) => sum + Number(e.amount), 0),
  }))

  return (
    <div>
      <PageHeader
        title="Giderler"
        description="Fatura, ofis, akaryakıt, kargo, konaklama, kira ve diğer giderleri bölüm bölüm kaydedin ve takip edin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAllSections} title="Her bölüm ayrı sayfada">
              <FileSpreadsheet /> Tüm Bölümler Excel
            </Button>
            <ExportMenu<Expense>
              title="Gider Listesi"
              filename="giderler"
              rows={expenses}
              columns={[
                { header: 'Tarih', value: (e) => format(new Date(e.expense_date), 'd.MM.yyyy HH:mm') },
                { header: 'Kategori', value: (e) => tr.expenseCategory[e.category] },
                { header: 'Tutar', value: (e) => Number(e.amount) },
                { header: 'Açıklama', value: (e) => e.description ?? '' },
              ]}
            />
            <ExpenseForm />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:flex sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="from">Başlangıç</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Bitiş</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/* Özet: toplam + grupların payı */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/15">
                <Wallet className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">TOPLAM GİDER</p>
                <p className="text-[clamp(1.5rem,2.6vw,2.25rem)] leading-tight font-semibold tracking-tight tabular-nums break-words">{currency(grandTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  {from || to ? `${from ? format(new Date(from), 'd MMM yyyy', { locale: trLocale }) : 'Başlangıç'} – ${to ? format(new Date(to), 'd MMM yyyy', { locale: trLocale }) : 'bugün'}` : 'Tüm zamanlar'}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6 gap-y-2 sm:flex-1 sm:max-w-3xl">
              {[...groupTotals, { label: 'Genel', tone: 'bg-rose-500', total: serviceTotal + otherTotal }].map((g) => (
                <div key={g.label} className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('size-2 shrink-0 rounded-full', g.tone)} /> {g.label}
                  </p>
                  <p className="truncate text-sm font-semibold tabular-nums" title={currency(g.total)}>{currency0(g.total)}</p>
                </div>
              ))}
            </div>
          </div>
          {grandTotal > 0 && (
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {[...groupTotals, { label: 'Genel', tone: 'bg-rose-500', total: serviceTotal + otherTotal }].map((g) =>
                g.total > 0 ? <div key={g.label} className={cn('h-full', g.tone)} style={{ width: `${(g.total / grandTotal) * 100}%` }} title={`${g.label}: ${currency(g.total)}`} /> : null,
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
      <div className="grid gap-5 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        {/* Kategori menüsü — gruplu, simgeli, dönem tutarıyla */}
        <Card className="h-fit gap-0 p-2 lg:sticky lg:top-4">
          <CategoryButton icon={SECTION_ICON.genel} label="Genel Giderler" total={serviceTotal + otherTotal} count={expenses.length} active={tab === 'genel'} onClick={() => setTab('genel')} />
          {SECTION_GROUPS.map((g) => (
            <div key={g.label} className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-0.5 lg:block">
              {/* Grup başlığı: şeffaf kırmızı buzlu cam zemin (kullanıcı isteği, 2026-11-19) */}
              <p className="col-span-full mx-0.5 mb-1 flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md">
                <span className={cn('size-1.5 rounded-full', g.tone)} /> {g.label.toLocaleUpperCase('tr-TR')}
              </p>
              {g.keys.map((k) => {
                const section = EXPENSE_ENTRY_SECTIONS.find((x) => x.key === k)
                if (!section) return null
                const list = entries.filter((e) => e.category === k)
                return (
                  <CategoryButton
                    key={k}
                    icon={SECTION_ICON[k] ?? Shapes}
                    label={section.label}
                    total={list.reduce((sum, e) => sum + Number(e.amount), 0)}
                    count={list.length}
                    alert={BILL_CATEGORY_OF[k] ? unpaidBills.filter((b) => b.category === BILL_CATEGORY_OF[k]).length : 0}
                    active={tab === k}
                    onClick={() => setTab(k)}
                  />
                )
              })}
            </div>
          ))}
        </Card>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {(() => {
              const Icon = SECTION_ICON[tab] ?? Shapes
              const label = tab === 'genel' ? 'Genel Giderler' : tab === 'fatura_takibi' ? 'Fatura Takibi' : (EXPENSE_ENTRY_SECTIONS.find((x) => x.key === tab)?.label ?? '')
              const total =
                tab === 'genel'
                  ? serviceTotal + otherTotal
                  : tab === 'fatura_takibi'
                    ? unpaidBillsTotal
                    : entries.filter((e) => e.category === tab).reduce((sum, e) => sum + Number(e.amount), 0)
              return (
                <>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg leading-tight font-semibold">{label}</h2>
                    <p className="text-sm text-muted-foreground tabular-nums">{tab === 'fatura_takibi' ? `Ödenmemiş: ${currency(total)}` : currency(total)}</p>
                  </div>
                  {tab === 'genel' && (
                    <div className="ml-auto flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-2.5 py-1">Hizmet gideri: <b className="tabular-nums">{currency0(serviceTotal)}</b></span>
                      <span className="rounded-full border px-2.5 py-1">Diğer: <b className="tabular-nums">{currency0(otherTotal)}</b></span>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        <TabsContent value="genel">
        <div className="mb-3">
          <BulkDeleteBar
            count={pickedList.length}
            total={currency(pickedList.reduce((s, e) => s + Number(e.amount), 0))}
            busy={bulkBusy}
            onDelete={() => void bulkDeleteExpenses()}
            onClear={() => setPicked(new Set())}
          />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={expenses.length > 0 && pickedList.length === expenses.length}
                      onCheckedChange={(c) => setPicked(c === true ? new Set(expenses.map((e) => e.id)) : new Set())}
                      aria-label="Tümünü seç"
                    />
                  </TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Gider bulunamadı
                    </TableCell>
                  </TableRow>
                )}
                {expenses.map((expense) => (
                  <TableRow
                    key={expense.id}
                    onClick={() => setSelectedId(expense.id)}
                    selected={expense.id === selectedId || picked.has(expense.id)}
                  >
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox
                        checked={picked.has(expense.id)}
                        onCheckedChange={() => setPicked((s) => { const n = new Set(s); if (n.has(expense.id)) n.delete(expense.id); else n.add(expense.id); return n })}
                        aria-label="Seç"
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(expense.expense_date), 'd MMM yyyy HH:mm', { locale: trLocale })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tr.expenseCategory[expense.category]}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{currency(Number(expense.amount))}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {expense.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <ExpenseForm
                        expense={expense}
                        trigger={
                          <Button variant="ghost" size="icon" title="Düzenle">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button variant="ghost" size="icon" title="Sil" onClick={async () => {
  if (await confirmAction('Bu gider kaydı silinsin mi?')) deleteMutation.mutate(expense.id)
}}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </TabsContent>
        {EXPENSE_ENTRY_SECTIONS.map((section) => (
          <TabsContent key={section.key} value={section.key}>
            {BILL_CATEGORY_OF[section.key] ? (
              <BillSectionView
                billCategory={BILL_CATEGORY_OF[section.key]!}
                unpaid={unpaidBills.filter((b) => b.category === BILL_CATEGORY_OF[section.key]).length}
                payments={
                  <ExpenseEntriesPanel
                    section={section}
                    entries={entries.filter((e) => e.category === section.key)}
                    isLoading={entriesLoading}
                    from={from}
                    to={to}
                  />
                }
              />
            ) : (
              <ExpenseEntriesPanel
                section={section}
                entries={entries.filter((e) => e.category === section.key)}
                isLoading={entriesLoading}
                from={from}
                to={to}
              />
            )}
          </TabsContent>
        ))}
        </div>
      </div>
      </Tabs>
    </div>
  )
}

function CategoryButton({
  icon: Icon,
  label,
  total,
  count,
  subtitle,
  alert = 0,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  total: number
  count: number
  subtitle?: string
  /** Ödenmemiş fatura sayısı — kırmızı rozet */
  alert?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1',
          active ? 'bg-white/15 ring-white/20' : 'bg-muted text-muted-foreground ring-border/60 group-hover:text-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className={cn('block text-xs tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {subtitle ?? (
            <>
              {total > 0 ? currency0(total) : 'Kayıt yok'}
              {count > 0 && ` · ${count}`}
            </>
          )}
        </span>
      </span>
      {alert > 0 && (
        <span
          className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', active ? 'bg-white/20 text-white' : 'bg-destructive/12 text-destructive')}
          title={`${alert} ödenmemiş fatura`}
        >
          {alert}
        </span>
      )}
    </button>
  )
}

/** Fatura türündeki bölüm (Elektrik, Su…): o türün fatura takibi + ödeme kayıtları, iki sekmede */
function BillSectionView({ billCategory, unpaid, payments }: { billCategory: UtilityBillCategory; unpaid: number; payments: React.ReactNode }) {
  const [view, setView] = React.useState<'bills' | 'payments'>('bills')
  return (
    <div className="grid gap-3">
      <div className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ['bills', 'Faturalar', unpaid ? `${unpaid} ödenmemiş` : null],
            ['payments', 'Ödeme Kayıtları', null],
          ] as const
        ).map(([key, label, badge]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors', view === key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
            {badge && <span className="rounded-full bg-destructive/12 px-1.5 text-[10px] font-semibold text-destructive">{badge}</span>}
          </button>
        ))}
      </div>
      {view === 'bills' ? <BillsPage embedded category={billCategory} /> : payments}
    </div>
  )
}
