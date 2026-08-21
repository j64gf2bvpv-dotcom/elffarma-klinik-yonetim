import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Trash2, Pencil, Zap, CheckCircle2, ChevronDown, Repeat, Pause, Play } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ExportMenu } from '@/components/ExportMenu'
import { cn } from '@/lib/utils'
import { UTILITY_BILL_CATEGORY_LABELS } from '@/features/bills/api'
import {
  useCreateUtilityBill,
  useCreateUtilityBillTemplate,
  useDeleteUtilityBill,
  useDeleteUtilityBillTemplate,
  useUpdateUtilityBill,
  useUpdateUtilityBillPaid,
  useUpdateUtilityBillTemplate,
  useUpdateUtilityBillTemplateActive,
  useUtilityBillTemplates,
  useUtilityBills,
} from '@/features/bills/hooks'
import type { UtilityBill, UtilityBillCategory, UtilityBillTemplate } from '@/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

const CATEGORY_ORDER: UtilityBillCategory[] = ['elektrik', 'dogalgaz', 'su', 'internet', 'telefon', 'diger']
const ALL_CATEGORIES = '__all__'

interface BillFormState {
  category: UtilityBillCategory
  contract_number: string
  amount: number
  due_date: string
  note: string
}

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function emptyForm(): BillFormState {
  return { category: 'elektrik', contract_number: '', amount: 0, due_date: todayDate(), note: '' }
}

function BillFormDialog({ bill }: { bill?: UtilityBill }) {
  const isEdit = !!bill
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<BillFormState>(
    bill
      ? {
          category: bill.category,
          contract_number: bill.contract_number ?? '',
          amount: Number(bill.amount),
          due_date: bill.due_date,
          note: bill.note ?? '',
        }
      : emptyForm(),
  )
  const createMutation = useCreateUtilityBill()
  const updateMutation = useUpdateUtilityBill()

  async function handleSubmit() {
    if (!form.due_date || form.amount < 0) return
    const input = {
      category: form.category,
      contract_number: form.contract_number.trim() || null,
      amount: form.amount,
      due_date: form.due_date,
      note: form.note.trim() || null,
    }
    if (isEdit) {
      await updateMutation.mutateAsync({ id: bill.id, input, reminderId: bill.reminder_id })
    } else {
      await createMutation.mutateAsync(input)
      setForm(emptyForm())
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" title="Düzenle">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-3.5" /> Fatura Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Faturayı Düzenle' : 'Yeni Fatura'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Kategori</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as UtilityBillCategory }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {UTILITY_BILL_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Sözleşme Numarası (opsiyonel)</Label>
            <Input
              value={form.contract_number}
              onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Tutar</Label>
              <CurrencyInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v ?? 0 }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Son Ödeme Tarihi</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface TemplateFormState {
  category: UtilityBillCategory
  contract_number: string
  amount: number
  day_of_month: number
  note: string
}

function emptyTemplateForm(): TemplateFormState {
  return { category: 'elektrik', contract_number: '', amount: 0, day_of_month: 1, note: '' }
}

/**
 * Tekrarlayan fatura şablonu formu — kullanıcı isteğiyle (2026-08-21): her
 * ay elle girmek yerine "her ayın X'inde" bir şablon tanımlanır, sistem
 * VERİTABANI TARAFINDA (pg_cron, günlük 06:00) o ayın faturasını + 7 gün
 * önceden hatırlatmasını OTOMATİK oluşturur (generate_due_utility_bills()).
 * İstemci tarafında bir kontrol YOK — uygulama hiç açılmasa bile çalışır.
 */
function TemplateFormDialog({ template }: { template?: UtilityBillTemplate }) {
  const isEdit = !!template
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<TemplateFormState>(
    template
      ? {
          category: template.category,
          contract_number: template.contract_number ?? '',
          amount: Number(template.amount),
          day_of_month: template.day_of_month,
          note: template.note ?? '',
        }
      : emptyTemplateForm(),
  )
  const createMutation = useCreateUtilityBillTemplate()
  const updateMutation = useUpdateUtilityBillTemplate()

  async function handleSubmit() {
    if (form.day_of_month < 1 || form.day_of_month > 31 || form.amount < 0) return
    const input = {
      category: form.category,
      contract_number: form.contract_number.trim() || null,
      amount: form.amount,
      day_of_month: form.day_of_month,
      note: form.note.trim() || null,
    }
    if (isEdit) {
      await updateMutation.mutateAsync({ id: template.id, input })
    } else {
      await createMutation.mutateAsync(input)
      setForm(emptyTemplateForm())
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" title="Düzenle">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" /> Yeni Tekrarlayan Fatura
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Tekrarlayan Faturayı Düzenle' : 'Yeni Tekrarlayan Fatura'}</DialogTitle>
          <DialogDescription>
            Her ayın seçtiğiniz gününde fatura kaydı ve 7 gün önceden hatırlatması otomatik oluşturulur.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Kategori</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as UtilityBillCategory }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {UTILITY_BILL_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Sözleşme Numarası (opsiyonel)</Label>
            <Input
              value={form.contract_number}
              onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Tutar</Label>
              <CurrencyInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v ?? 0 }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Her Ayın Kaçıncı Günü</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.day_of_month}
                onChange={(e) => setForm((f) => ({ ...f, day_of_month: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplateRow({ template }: { template: UtilityBillTemplate }) {
  const activeMutation = useUpdateUtilityBillTemplateActive()
  const deleteMutation = useDeleteUtilityBillTemplate()

  function handleDelete() {
    if (!confirm('Bu tekrarlayan fatura şablonu silinsin mi? Daha önce oluşturulmuş faturalar silinmez.')) return
    deleteMutation.mutate(template.id)
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3', !template.is_active && 'opacity-60')}>
      <div>
        <p className="font-medium">
          {UTILITY_BILL_CATEGORY_LABELS[template.category]}
          {template.contract_number ? ` — ${template.contract_number}` : ''}
          {!template.is_active && <span className="text-muted-foreground text-xs"> (duraklatıldı)</span>}
        </p>
        <p className="text-muted-foreground text-xs">
          Her ayın {template.day_of_month}. günü · {currency(Number(template.amount))}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <TemplateFormDialog template={template} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => activeMutation.mutate({ id: template.id, isActive: !template.is_active })}
          title={template.is_active ? 'Duraklat' : 'Etkinleştir'}
        >
          {template.is_active ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDelete} title="Sil">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

function TemplatesManagerDialog() {
  const { data: templates = [] } = useUtilityBillTemplates()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Repeat className="size-3.5" /> Tekrarlayan Faturalar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tekrarlayan Faturalar</DialogTitle>
          <DialogDescription>
            Her ayın belirlediğiniz gününde fatura kaydı ve hatırlatması otomatik oluşturulur — elle girmenize gerek kalmaz.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {templates.length === 0 && <p className="text-muted-foreground text-sm">Henüz tekrarlayan fatura yok.</p>}
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
        </div>
        <div className="flex justify-end">
          <TemplateFormDialog />
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SubscriptionGroup {
  key: string
  contractNumber: string | null
  category: UtilityBillCategory
  bills: UtilityBill[]
  unpaidTotal: number
  unpaidCount: number
}

/**
 * Sözleşme numarasına göre gruplanan bir abonelik satırı — aynı sözleşmeye
 * ait birden fazla borç (geçmiş + güncel) tek başlık altında, kaç tanesinin
 * bekleyen olduğu ve toplam tutarı görünsün diye (kullanıcı isteğiyle,
 * 2026-08-21). Varsayılan açık — kaç borç olduğunu görmek için tıklamaya
 * gerek kalmasın.
 */
function SubscriptionGroupRow({ group }: { group: SubscriptionGroup }) {
  const [open, setOpen] = React.useState(true)
  const deleteMutation = useDeleteUtilityBill()
  const paidMutation = useUpdateUtilityBillPaid()

  function handleDelete(bill: UtilityBill) {
    if (!confirm(`${UTILITY_BILL_CATEGORY_LABELS[bill.category]} faturası silinsin mi? Bağlı hatırlatma da silinir.`)) return
    deleteMutation.mutate({ id: bill.id, reminderId: bill.reminder_id })
  }

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-accent/40"
      >
        <span className="flex items-center gap-2">
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          <span className="font-medium">{UTILITY_BILL_CATEGORY_LABELS[group.category]}</span>
          <span className="text-muted-foreground text-sm">
            {group.contractNumber ? `Sözleşme No: ${group.contractNumber}` : 'Sözleşme numarası yok'}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {group.unpaidCount > 0 ? (
            <Badge variant="outline" className="border-destructive/30 text-destructive">
              {group.unpaidCount} borç · {currency(group.unpaidTotal)}
            </Badge>
          ) : (
            <Badge variant="success">
              <CheckCircle2 className="size-3" /> Hepsi ödendi
            </Badge>
          )}
        </span>
      </button>
      {open && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Son Ödeme Tarihi</TableHead>
              <TableHead>Tutar</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Not</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.bills.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{format(new Date(b.due_date), 'd MMM yyyy', { locale: trLocale })}</TableCell>
                <TableCell className="font-medium">{currency(Number(b.amount))}</TableCell>
                <TableCell>
                  <Badge
                    variant={b.is_paid ? 'success' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => paidMutation.mutate({ id: b.id, isPaid: !b.is_paid, reminderId: b.reminder_id })}
                  >
                    {b.is_paid ? (
                      <>
                        <CheckCircle2 className="size-3" /> Ödendi
                      </>
                    ) : (
                      'Bekliyor'
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-40 truncate" title={b.note ?? undefined}>
                  {b.note ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <BillFormDialog bill={b} />
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(b)} title="Sil">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export function BillsPage() {
  const { data: bills = [], isLoading } = useUtilityBills()
  const [categoryFilter, setCategoryFilter] = React.useState<string>(ALL_CATEGORIES)

  const filtered = categoryFilter === ALL_CATEGORIES ? bills : bills.filter((b) => b.category === categoryFilter)

  const unpaidTotal = bills.filter((b) => !b.is_paid).reduce((sum, b) => sum + Number(b.amount), 0)
  const unpaidCount = bills.filter((b) => !b.is_paid).length
  const monthTotal = bills
    .filter((b) => b.due_date.slice(0, 7) === todayDate().slice(0, 7))
    .reduce((sum, b) => sum + Number(b.amount), 0)

  // Aynı sözleşme numarasına ait faturalar tek grup altında toplanıyor —
  // sözleşme numarası olmayanlar birbirine karışmasın diye HER BİRİ kendi
  // (tek elemanlı) grubunda kalıyor.
  const groups = React.useMemo<SubscriptionGroup[]>(() => {
    const map = new Map<string, SubscriptionGroup>()
    for (const b of filtered) {
      const key = b.contract_number?.trim() ? `c:${b.contract_number.trim()}` : `b:${b.id}`
      let group = map.get(key)
      if (!group) {
        group = { key, contractNumber: b.contract_number, category: b.category, bills: [], unpaidTotal: 0, unpaidCount: 0 }
        map.set(key, group)
      }
      group.bills.push(b)
      if (!b.is_paid) {
        group.unpaidTotal += Number(b.amount)
        group.unpaidCount += 1
      }
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, bills: g.bills.sort((a, b) => a.due_date.localeCompare(b.due_date)) }))
      .sort((a, b) => b.unpaidTotal - a.unpaidTotal)
  }, [filtered])

  return (
    <div>
      <PageHeader
        title="Faturalar"
        description="Elektrik, doğalgaz, su, internet gibi sabit faturaları ve son ödeme tarihlerini takip edin"
        actions={
          <div className="flex gap-2">
            <ExportMenu<UtilityBill>
              title="Faturalar"
              filename="faturalar"
              rows={bills}
              columns={[
                { header: 'Kategori', value: (b) => UTILITY_BILL_CATEGORY_LABELS[b.category] },
                { header: 'Sözleşme No', value: (b) => b.contract_number ?? '' },
                { header: 'Son Ödeme Tarihi', value: (b) => b.due_date },
                { header: 'Tutar', value: (b) => Number(b.amount) },
                { header: 'Durum', value: (b) => (b.is_paid ? 'Ödendi' : 'Bekliyor') },
              ]}
            />
            <TemplatesManagerDialog />
            <BillFormDialog />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <Zap className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Ödenmemiş Toplam</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(unpaidTotal)}</p>
              <p className="text-muted-foreground text-xs">{unpaidCount} fatura</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Zap className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Bu Ay Vadesi Gelen</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(monthTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Kategori Filtresi</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>Tümü</SelectItem>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {UTILITY_BILL_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
          {!isLoading && groups.length === 0 && <p className="text-muted-foreground p-6">Henüz fatura kaydı yok.</p>}
          {groups.map((g) => (
            <SubscriptionGroupRow key={g.key} group={g} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
