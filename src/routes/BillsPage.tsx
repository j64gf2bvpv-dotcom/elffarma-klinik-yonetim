import * as React from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Trash2, Pencil, Zap, ChevronDown, Repeat, Pause, Play, FileImage, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { ExportColumn } from '@/lib/exportData'
import { cn } from '@/lib/utils'
import { UTILITY_BILL_CATEGORY_LABELS, syncTemplateSubscriber, uploadBillAttachment } from '@/features/bills/api'
import { BillImageField, type BillAttachment } from '@/features/bills/BillImageField'
import { isPdfPath, openDocument } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import {
  useCreateUtilityBill,
  useCreateUtilityBillTemplate,
  useDeleteUtilityBill,
  useDeleteUtilityBillTemplate,
  useUpdateUtilityBill,
  useUpdateUtilityBillTemplate,
  useUpdateUtilityBillTemplateActive,
  useUtilityBillTemplates,
  useMakeBillRecurring,
  useUtilityBills,
  useUtilitySubscriptions,
} from '@/features/bills/hooks'
import type { UtilityBill, UtilityBillCategory, UtilityBillTemplate } from '@/types/database'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

/** "2026-06" → "Haziran 2026" */
function periodLabel(period: string | null): string {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || '—'
  return format(new Date(`${period}-01T00:00:00`), 'LLLL yyyy', { locale: trLocale }).replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'))
}

/** Faturanın ayı: dönem → fatura tarihi → son ödeme tarihi (sıralama ve Tutarlar tablosu için) */
function billMonth(b: UtilityBill): string {
  return b.period || (b.bill_date ?? b.due_date).slice(0, 7)
}

/** Sıralama anahtarı — aynı ay içinde fatura tarihine göre */
function billSortKey(b: UtilityBill): string {
  return `${billMonth(b)}|${b.bill_date ?? b.due_date}`
}

/** Faturalar Excel/Word/PDF sütunları — genel dışa aktarma ve her abonelik başlığındaki ayrı dışa aktarma */
const BILL_EXPORT_COLUMNS: ExportColumn<UtilityBill>[] = [
  { header: 'Kategori', value: (b) => UTILITY_BILL_CATEGORY_LABELS[b.category] },
  // Son ödeme tarihi yerine faturanın üzerindeki tarih + dönem (kullanıcı isteği, 2026-11-11)
  { header: 'Fatura Tarihi', value: (b) => (b.bill_date ? format(new Date(b.bill_date), 'dd.MM.yyyy') : '') },
  { header: 'Dönem', value: (b) => (b.period ? periodLabel(b.period) : '') },
  { header: 'Sözleşme No', value: (b) => b.contract_number ?? '' },
  { header: 'Abone No', value: (b) => b.subscriber_number ?? '' },
  { header: 'Abone Adı', value: (b) => b.subscriber_name ?? '' },
  { header: 'Tutar', value: (b) => Number(b.amount) },
]

const CATEGORY_ORDER: UtilityBillCategory[] = ['elektrik', 'dogalgaz', 'su', 'internet', 'telefon', 'diger']
const ALL_CATEGORIES = '__all__'

interface BillFormState {
  category: UtilityBillCategory
  contract_number: string
  subscriber_number: string
  subscriber_name: string
  amount: number
  due_date: string
  /** Fatura dönemi YYYY-MM */
  period: string
  /** Faturanın üzerindeki tarih */
  bill_date: string
  note: string
}

function todayDate() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function emptyForm(): BillFormState {
  return { category: 'elektrik', contract_number: '', subscriber_number: '', subscriber_name: '', amount: 0, due_date: todayDate(), period: '', bill_date: '', note: '' }
}

function BillFormDialog({ bill, defaults }: { bill?: UtilityBill; defaults?: Partial<BillFormState> }) {
  const isEdit = !!bill
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<BillFormState>(
    bill
      ? {
          category: bill.category,
          contract_number: bill.contract_number ?? '',
          subscriber_number: bill.subscriber_number ?? '',
          subscriber_name: bill.subscriber_name ?? '',
          amount: Number(bill.amount),
          due_date: bill.due_date,
          period: bill.period ?? '',
          bill_date: bill.bill_date ?? '',
          note: bill.note ?? '',
        }
      : emptyForm(),
  )
  const createMutation = useCreateUtilityBill()
  const updateMutation = useUpdateUtilityBill()
  const createTemplateMutation = useCreateUtilityBillTemplate()
  // Faturalar her ay aynı günde ödeniyor (kullanıcı isteği, 2026-10-21) — yeni
  // faturada varsayılan açık: kaydedilince tekrarlayan şablon da oluşur, sunucu
  // her ay o güne faturayı ve 5 gün önceye hatırlatmayı kendisi açar.
  const [repeatMonthly, setRepeatMonthly] = React.useState(true)
  // Fatura resmi/PDF'i (2026-11-11) — yeni seçilenler "Kaydet"te yüklenir
  const [attachments, setAttachments] = React.useState<BillAttachment[]>(() => (bill?.attachment_paths ?? []).map((path) => ({ kind: 'saved', path })))
  const [uploading, setUploading] = React.useState(false)
  const queryClient = useQueryClient()

  // Düzenlemede her açılışta faturanın güncel hâli (kaydettikten sonra tekrar açınca eski bilgiler kalmasın)
  function handleOpenChange(next: boolean) {
    if (next && bill) {
      setForm({
        category: bill.category,
        contract_number: bill.contract_number ?? '',
        subscriber_number: bill.subscriber_number ?? '',
        subscriber_name: bill.subscriber_name ?? '',
        amount: Number(bill.amount),
        due_date: bill.due_date,
        period: bill.period ?? '',
        bill_date: bill.bill_date ?? '',
        note: bill.note ?? '',
      })
      setAttachments(bill.attachment_paths.map((path) => ({ kind: 'saved', path })))
    } else if (next && defaults) {
      // Bir abonelik başlığının içinden "+ Fatura": tür ve numaralar hazır gelir
      setForm({ ...emptyForm(), ...defaults })
      setAttachments([])
      // Var olan başlığa eklenen fatura için ayrı bir "her ay" şablonu açılmasın
      setRepeatMonthly(false)
    }
    setOpen(next)
  }

  async function handleSubmit() {
    if (!form.due_date || form.amount < 0) return
    let attachment_paths: string[]
    setUploading(true)
    try {
      attachment_paths = []
      for (const a of attachments) attachment_paths.push(a.kind === 'saved' ? a.path : await uploadBillAttachment(a.file))
    } catch (err) {
      toast.error('Fatura resmi yüklenemedi', { description: getErrorMessage(err) })
      return
    } finally {
      setUploading(false)
    }
    const input = {
      category: form.category,
      contract_number: form.contract_number.trim() || null,
      subscriber_number: form.subscriber_number.trim() || null,
      subscriber_name: form.subscriber_name.trim() || null,
      attachment_paths,
      period: form.period || null,
      bill_date: form.bill_date || null,
      amount: form.amount,
      due_date: form.due_date,
      note: form.note.trim() || null,
    }
    if (isEdit) {
      await updateMutation.mutateAsync({ id: bill.id, input, reminderId: bill.reminder_id })
      // Her ay otomatik açılan faturalar da yeni abone bilgilerini taşısın
      if (bill.template_id) {
        await syncTemplateSubscriber(bill.template_id, {
          contract_number: input.contract_number,
          subscriber_number: input.subscriber_number,
          subscriber_name: input.subscriber_name,
        }).catch(() => {})
        void queryClient.invalidateQueries({ queryKey: ['utility_bill_templates'] })
      }
    } else {
      let templateId: string | null = null
      if (repeatMonthly) {
        const template = await createTemplateMutation.mutateAsync({
          category: input.category,
          contract_number: input.contract_number,
          subscriber_number: input.subscriber_number,
          subscriber_name: input.subscriber_name,
          amount: input.amount,
          day_of_month: Number(input.due_date.slice(8, 10)),
          note: input.note,
        })
        templateId = template.id
      }
      await createMutation.mutateAsync({ ...input, template_id: templateId })
      setForm(emptyForm())
      setAttachments([])
    }
    setOpen(false)
  }

  const submitting = uploading || createMutation.isPending || updateMutation.isPending || createTemplateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" title="Düzenle">
            <Pencil className="size-4" />
          </Button>
        ) : defaults ? (
          <Button variant="outline" size="sm" title="Bu aboneliğe fatura ekle">
            <Plus className="size-3.5" /> Fatura
          </Button>
        ) : (
          <Button>
            <Plus className="size-3.5" /> Fatura Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Sözleşme Numarası (opsiyonel)</Label>
              <Input
                value={form.contract_number}
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Abone Numarası (opsiyonel)</Label>
              <Input
                value={form.subscriber_number}
                onChange={(e) => setForm((f) => ({ ...f, subscriber_number: e.target.value }))}
              />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label>Abone Adı (opsiyonel)</Label>
              <Input
                value={form.subscriber_name}
                placeholder="Faturadaki kişi ya da firma adı"
                onChange={(e) => setForm((f) => ({ ...f, subscriber_name: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Tutar</Label>
              <CurrencyInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v ?? 0 }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Son Ödeme Tarihi (hatırlatma için)</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fatura Tarihi</Label>
              <Input type="date" value={form.bill_date} onChange={(e) => setForm((f) => ({ ...f, bill_date: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Dönem</Label>
              <Input type="month" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Not (opsiyonel)</Label>
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <BillImageField
            value={attachments}
            onChange={setAttachments}
            onRead={(found) =>
              setForm((f) => ({
                ...f,
                // Başlıktan gelen / önceden yazılı numaralar korunur, sadece boşlar doldurulur
                subscriber_number: f.subscriber_number || found.subscriber_number || '',
                contract_number: f.contract_number || found.contract_number || '',
                subscriber_name: f.subscriber_name || found.subscriber_name || '',
                period: found.period ?? f.period,
                bill_date: found.bill_date ?? f.bill_date,
                // Tutar her zaman faturadaki toplam borç (kullanıcı isteği, 2026-11-11); son ödeme sadece yeni faturada
                amount: found.amount ?? f.amount,
                due_date: !isEdit && found.due_date ? found.due_date : f.due_date,
              }))
            }
          />
          {!isEdit && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <Checkbox className="mt-0.5" checked={repeatMonthly} onCheckedChange={(v) => setRepeatMonthly(v === true)} />
              <span>
                <span className="font-medium">
                  Her ay {form.due_date ? `${Number(form.due_date.slice(8, 10))}.` : 'bu'} günde tekrarla
                </span>
                <span className="block text-xs text-muted-foreground">
                  Fatura her ay bu güne otomatik açılır; son ödeme tarihine 5 gün kala ana ekranda hatırlatma çıkar.
                </span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />} Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface TemplateFormState {
  category: UtilityBillCategory
  contract_number: string
  subscriber_number: string
  subscriber_name: string
  amount: number
  day_of_month: number
  note: string
}

function emptyTemplateForm(): TemplateFormState {
  return { category: 'elektrik', contract_number: '', subscriber_number: '', subscriber_name: '', amount: 0, day_of_month: 1, note: '' }
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
          subscriber_number: template.subscriber_number ?? '',
          subscriber_name: template.subscriber_name ?? '',
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
      subscriber_number: form.subscriber_number.trim() || null,
      subscriber_name: form.subscriber_name.trim() || null,
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
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Sözleşme Numarası (opsiyonel)</Label>
              <Input
                value={form.contract_number}
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Abone Numarası (opsiyonel)</Label>
              <Input
                value={form.subscriber_number}
                onChange={(e) => setForm((f) => ({ ...f, subscriber_number: e.target.value }))}
              />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label>Abone Adı (opsiyonel)</Label>
              <Input
                value={form.subscriber_name}
                placeholder="Faturadaki kişi ya da firma adı"
                onChange={(e) => setForm((f) => ({ ...f, subscriber_name: e.target.value }))}
              />
            </div>
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
            {submitting && <Loader2 className="animate-spin" />} Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplateRow({ template }: { template: UtilityBillTemplate }) {
  const activeMutation = useUpdateUtilityBillTemplateActive()
  const deleteMutation = useDeleteUtilityBillTemplate()
  const { confirm, dialog } = useConfirmDialog()

  async function handleDelete() {
    if (!(await confirm('Bu tekrarlayan fatura şablonu silinsin mi? Daha önce oluşturulmuş faturalar silinmez.'))) return
    deleteMutation.mutate(template.id)
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3', !template.is_active && 'opacity-60')}>
      <div>
        <p className="font-medium">
          {UTILITY_BILL_CATEGORY_LABELS[template.category]}
          {template.contract_number ? ` — ${template.contract_number}` : ''}
          {template.subscriber_number ? ` · Abone No: ${template.subscriber_number}` : ''}
          {template.subscriber_name ? ` · ${template.subscriber_name}` : ''}
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
      {dialog}
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
  subscriberNumber: string | null
  subscriberName: string | null
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
/** Bir sonraki "her ayın X'i" günü (bugün dahil). */
function nextMonthlyDue(day: number): Date {
  const now = new Date()
  const clamp = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate())
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), clamp(now.getFullYear(), now.getMonth()))
  if (differenceInCalendarDays(thisMonth, now) >= 0) return thisMonth
  return new Date(now.getFullYear(), now.getMonth() + 1, clamp(now.getFullYear(), now.getMonth() + 1))
}

function SubscriptionGroupRow({ group, templates }: { group: SubscriptionGroup; templates: UtilityBillTemplate[] }) {
  const [open, setOpen] = React.useState(true)
  const makeRecurring = useMakeBillRecurring()
  // Bu abonelik için aktif tekrarlayan şablon var mı (kategori + abone/sözleşme no eşleşmesi)
  const template = templates.find(
    (t) =>
      t.is_active &&
      t.category === group.category &&
      (t.contract_number ?? '') === (group.contractNumber ?? '') &&
      (!t.subscriber_number || !group.subscriberNumber || t.subscriber_number === group.subscriberNumber),
  )
  const latest = [...group.bills].sort((a, b) => b.due_date.localeCompare(a.due_date))[0]
  // Faturalar her ay aynı günde ödenir (2026-10-21) — girilen tarihin ayı değil günü esas
  const day = template?.day_of_month ?? (latest ? Number(latest.due_date.slice(8, 10)) : null)
  const nextDue = day ? nextMonthlyDue(day) : null
  const deleteMutation = useDeleteUtilityBill()
  const { confirm, dialog } = useConfirmDialog()

  async function handleDelete(bill: UtilityBill) {
    if (!(await confirm(`${UTILITY_BILL_CATEGORY_LABELS[bill.category]} faturası silinsin mi? Bağlı hatırlatma da silinir.`)))
      return
    deleteMutation.mutate({ id: bill.id, reminderId: bill.reminder_id, attachmentPaths: bill.attachment_paths })
  }

  return (
    <div className="border-b last:border-0">
      {/* Başlık kalıcıdır, silinemez (2026-11-11) — sadece içindeki faturalar silinir */}
      <div className="flex items-center hover:bg-accent/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          <span className="font-medium">{UTILITY_BILL_CATEGORY_LABELS[group.category]}</span>
          <span className="text-muted-foreground text-sm">
            {group.contractNumber ? `Sözleşme No: ${group.contractNumber}` : 'Sözleşme numarası yok'}
            {group.subscriberNumber ? ` · Abone No: ${group.subscriberNumber}` : ''}
            {group.subscriberName ? ` · ${group.subscriberName}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {day && nextDue && (
            <span className="text-xs text-muted-foreground" title="Faturalar her ay aynı günde ödenir; 5 gün kala ana ekranda hatırlatma çıkar">
              Her ayın {day}. günü · sıradaki {format(nextDue, 'd MMMM', { locale: trLocale })} ({differenceInCalendarDays(nextDue, new Date())} gün)
            </span>
          )}
          {template ? (
            <Badge variant="outline" className="border-primary/30 text-primary" title="Fatura kaydı her ay bu güne otomatik açılır">
              <Repeat className="size-3" /> Otomatik
            </Badge>
          ) : latest ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                makeRecurring.mutate(latest)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  makeRecurring.mutate(latest)
                }
              }}
              title={`Bu faturayı her ayın ${Number(latest.due_date.slice(8, 10))}. günü için tekrarla`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
            >
              <Repeat className="size-3" /> Kaydı her ay otomatik aç
            </span>
          ) : null}
          {/* Durum (ödendi / bekliyor / gecikti) göstergeleri kaldırıldı (kullanıcı istekleri, 2026-10-28) —
              ödendi işareti ana ekrandaki fatura hatırlatma penceresinden verilir */}
        </span>
      </button>
        <div className="flex shrink-0 items-center gap-2 pr-3">
          {/* Her tür ayrı dışa aktarılabilsin (kullanıcı isteği, 2026-11-11) */}
          <ExportMenu<UtilityBill>
            title={`${UTILITY_BILL_CATEGORY_LABELS[group.category]} Faturaları${group.contractNumber ? ` — Sözleşme No: ${group.contractNumber}` : ''}${group.subscriberNumber ? ` · Abone No: ${group.subscriberNumber}` : ''}${group.subscriberName ? ` · ${group.subscriberName}` : ''}`}
            filename={`${group.category}-faturalari${group.contractNumber ? `-${group.contractNumber}` : ''}`}
            rows={group.bills}
            columns={BILL_EXPORT_COLUMNS}
            triggerSize="sm"
          />
          <BillFormDialog
            defaults={{
              category: group.category,
              contract_number: group.contractNumber ?? '',
              subscriber_number: group.subscriberNumber ?? '',
              subscriber_name: group.subscriberName ?? '',
            }}
          />
        </div>
      </div>
      {open && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fatura Tarihi</TableHead>
              <TableHead>Dönem</TableHead>
              {/* Sözleşme no / abone no / ad başlıkta bir kez yazar, satırlarda tekrarlanmaz (kullanıcı isteği, 2026-11-11) */}
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Not</TableHead>
              <TableHead>Fatura</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.bills.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                  Bu abonelikte fatura yok — sağdaki "+ Fatura" ile ekleyin.
                </TableCell>
              </TableRow>
            )}
            {group.bills.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="whitespace-nowrap">{b.bill_date ? format(new Date(b.bill_date), 'd MMM yyyy', { locale: trLocale }) : '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{periodLabel(b.period)}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{currency(Number(b.amount))}</TableCell>
                <TableCell className="text-muted-foreground max-w-40 truncate" title={b.note ?? undefined}>
                  {b.note ?? '—'}
                </TableCell>
                <TableCell>
                  {b.attachment_paths.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="flex gap-1">
                      {b.attachment_paths.map((p, i) => (
                        <Button
                          key={p}
                          variant="outline"
                          size="icon"
                          className="size-7"
                          title={`Fatura ${i + 1} — açmak için tıklayın`}
                          onClick={() =>
                            void openDocument(p, `${UTILITY_BILL_CATEGORY_LABELS[b.category]} Faturasi ${b.due_date} ${i + 1}`).catch((err) =>
                              toast.error('Fatura açılamadı', { description: getErrorMessage(err) }),
                            )
                          }
                        >
                          {isPdfPath(p) ? <FileText className="size-3.5" /> : <FileImage className="size-3.5" />}
                        </Button>
                      ))}
                    </span>
                  )}
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
      {dialog}
    </div>
  )
}

function AmountCard({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: 'destructive' | 'primary' | 'muted' }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            tone === 'destructive' ? 'bg-destructive/15 text-destructive' : tone === 'primary' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Zap className="size-5" />
        </span>
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(value)}</p>
          {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * "Tutarlar" sekmesi: abonelik × ay tutar tablosu (son 12 ay ya da faturaların olduğu
 * aylar); satır, sütun ve genel toplam.
 */
function BillAmountsTable({ groups }: { groups: SubscriptionGroup[] }) {
  const months = React.useMemo(() => {
    const keys = new Set<string>()
    for (const g of groups) for (const b of g.bills) keys.add(billMonth(b))
    return [...keys].sort().slice(-12)
  }, [groups])

  if (groups.length === 0 || months.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6">Henüz fatura tutarı yok.</CardContent>
      </Card>
    )
  }

  const cell = (g: SubscriptionGroup, month: string) => g.bills.filter((b) => billMonth(b) === month)
  const sumOf = (list: UtilityBill[]) => list.reduce((t, b) => t + Number(b.amount), 0)
  const monthTotals = months.map((m) => sumOf(groups.flatMap((g) => cell(g, m))))
  const grand = monthTotals.reduce((a, b) => a + b, 0)

  return (
    <Card>
      <CardContent className="p-0">
        <Table className="[&_td]:border-b [&_td]:border-border [&_th]:border-b [&_th]:border-border">
          <TableHeader>
            <TableRow>
              <TableHead>Fatura</TableHead>
              {months.map((m) => (
                <TableHead key={m} className="text-right whitespace-nowrap">
                  {format(new Date(`${m}-01T00:00:00`), 'MMM yyyy', { locale: trLocale })}
                </TableHead>
              ))}
              <TableHead className="text-right">Toplam</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const rowTotal = sumOf(g.bills.filter((b) => months.includes(billMonth(b))))
              return (
                <TableRow key={g.key}>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium">{UTILITY_BILL_CATEGORY_LABELS[g.category]}</span>
                    {g.contractNumber && <span className="text-muted-foreground block text-xs">Sözleşme No: {g.contractNumber}</span>}
                  </TableCell>
                  {months.map((m) => {
                    const list = cell(g, m)
                    if (list.length === 0)
                      return (
                        <TableCell key={m} className="text-muted-foreground text-right">
                          —
                        </TableCell>
                      )
                    return (
                      <TableCell
                        key={m}
                        className="text-right tabular-nums whitespace-nowrap"
                        title={list.map((b) => `Son ödeme: ${format(new Date(b.due_date), 'd MMMM yyyy', { locale: trLocale })}`).join(' · ')}
                      >
                        {currency(sumOf(list))}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">{currency(rowTotal)}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell>Toplam</TableCell>
              {monthTotals.map((t, i) => (
                <TableCell key={months[i]} className="text-right tabular-nums whitespace-nowrap">
                  {t ? currency(t) : '—'}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums whitespace-nowrap">{currency(grand)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-muted-foreground px-4 py-2 text-xs">Tutarı değiştirmek için Faturalar sekmesinde kalem simgesini kullanın.</p>
      </CardContent>
    </Card>
  )
}


export function BillsPage() {
  const { data: allTemplates = [] } = useUtilityBillTemplates()
  const { data: bills = [], isLoading } = useUtilityBills()
  const { data: subscriptions = [] } = useUtilitySubscriptions()
  const [categoryFilter, setCategoryFilter] = React.useState<string>(ALL_CATEGORIES)

  const filtered = categoryFilter === ALL_CATEGORIES ? bills : bills.filter((b) => b.category === categoryFilter)

  const unpaidTotal = filtered.filter((b) => !b.is_paid).reduce((sum, b) => sum + Number(b.amount), 0)
  const unpaidCount = filtered.filter((b) => !b.is_paid).length
  const monthTotal = filtered
    .filter((b) => b.due_date.slice(0, 7) === todayDate().slice(0, 7))
    .reduce((sum, b) => sum + Number(b.amount), 0)
  const yearTotal = filtered
    .filter((b) => b.due_date.slice(0, 4) === todayDate().slice(0, 4))
    .reduce((sum, b) => sum + Number(b.amount), 0)

  // Gruplar kalıcı abonelik başlıklarından gelir (2026-11-11) — içindeki son fatura silinse
  // de başlık kalır. Faturalar türü + sözleşme numarasıyla başlığına bağlanır; başlığı
  // henüz olmayan faturalar eskisi gibi sözleşme numarasına göre gruplanır.
  const groups = React.useMemo<SubscriptionGroup[]>(() => {
    const norm = (c: string | null | undefined) => (c ?? '').trim()
    const map = new Map<string, SubscriptionGroup>()
    for (const sub of subscriptions) {
      if (categoryFilter !== ALL_CATEGORIES && sub.category !== categoryFilter) continue
      map.set(`s:${sub.category}:${norm(sub.contract_number)}`, {
        key: `s:${sub.id}`,
        contractNumber: norm(sub.contract_number) || null,
        subscriberNumber: sub.subscriber_number,
        subscriberName: sub.subscriber_name,
        category: sub.category,
        bills: [],
        unpaidTotal: 0,
        unpaidCount: 0,
      })
    }
    for (const b of filtered) {
      const subKey = `s:${b.category}:${norm(b.contract_number)}`
      const key = map.has(subKey) ? subKey : norm(b.contract_number) ? `c:${norm(b.contract_number)}` : `b:${b.id}`
      let group = map.get(key)
      if (!group) {
        group = { key, contractNumber: b.contract_number, subscriberNumber: null, subscriberName: null, category: b.category, bills: [], unpaidTotal: 0, unpaidCount: 0 }
        map.set(key, group)
      }
      group.bills.push(b)
      if (!b.is_paid) {
        group.unpaidTotal += Number(b.amount)
        group.unpaidCount += 1
      }
    }
    return Array.from(map.values())
      .map((g) => {
        // Dönem / fatura tarihine göre eskiden yeniye (kullanıcı isteği, 2026-11-11: "faturaları sıraya göre yap")
        const bills = g.bills.sort((a, b) => billSortKey(a).localeCompare(billSortKey(b)))
        // Başlıkta en son faturadaki abone no / adı (yoksa başlıkta kayıtlı olan)
        const latestWith = (k: 'subscriber_number' | 'subscriber_name') => [...bills].reverse().find((b) => b[k])?.[k] ?? null
        return {
          ...g,
          bills,
          subscriberNumber: latestWith('subscriber_number') ?? g.subscriberNumber,
          subscriberName: latestWith('subscriber_name') ?? g.subscriberName,
        }
      })
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
  }, [filtered, subscriptions, categoryFilter])

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
              // Kategori filtresinde seçili tür varsa sadece o tür
              rows={[...filtered].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || billSortKey(a).localeCompare(billSortKey(b)))}
              columns={BILL_EXPORT_COLUMNS}
            />
            <TemplatesManagerDialog />
            <BillFormDialog />
          </div>
        }
      />

      {/* Tutarlar ayrı sekmede (kullanıcı isteği, 2026-10-28: "faturalarda tutar kısmı ayrı bir menüde olsun") */}
      <Tabs defaultValue="bills">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="bills">Faturalar</TabsTrigger>
            <TabsTrigger value="amounts">Tutarlar</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wide whitespace-nowrap uppercase">Kategori</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
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
          </div>
        </div>

        <TabsContent value="bills">
          <Card>
            <CardContent className="p-0">
              {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
              {!isLoading && groups.length === 0 && <p className="text-muted-foreground p-6">Henüz fatura kaydı yok.</p>}
              {groups.map((g) => (
                <SubscriptionGroupRow key={g.key} group={g} templates={allTemplates} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amounts">
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <AmountCard label="Ödenmemiş Toplam" value={unpaidTotal} sub={`${unpaidCount} fatura`} tone="destructive" />
            <AmountCard label="Bu Ay Vadesi Gelen" value={monthTotal} tone="primary" />
            <AmountCard label={`${new Date().getFullYear()} Toplamı`} value={yearTotal} sub="bu yıl vadesi gelen tüm faturalar" tone="muted" />
          </div>
          <BillAmountsTable groups={groups} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
