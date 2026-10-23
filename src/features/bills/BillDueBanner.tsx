import * as React from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { BellRing, Check, ReceiptText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { UTILITY_BILL_CATEGORY_LABELS } from './api'
import { useCreateUtilityBill, useUpdateUtilityBillPaid, useUtilityBillTemplates, useUtilityBills } from './hooks'
import type { UtilityBill } from '@/types/database'

/** Son ödeme tarihine bu kadar gün (ya da daha az) kalan ödenmemiş faturalar uyarılır. */
const BILL_WARN_DAYS = 5

function daysUntil(dueDate: string): number {
  return differenceInCalendarDays(new Date(`${dueDate}T00:00:00`), new Date())
}

/**
 * Faturalar her ay AYNI GÜNDE ödenir (kullanıcı isteği, 2026-10-21: "son ödeme
 * tarihlerinde yazdığım ay değil, her ayın o tarihinde ödenmesi gerektiği
 * bildirilmeli"). Bu yüzden girilen tarihin AYI değil sadece GÜNÜ esas alınır:
 * her abonelik (kategori + abone no + sözleşme no) için "her ayın X'i" ve bir
 * sonraki ödeme günü hesaplanır; o güne ≤ 5 gün kaldıysa ve o ayın faturası
 * ödendi işaretlenmemişse uyarılır. Aktif tekrarlayan şablon varsa günü/tutarı
 * oradan, yoksa aboneliğin en son faturasından alınır.
 */
export interface BillCycle {
  key: string
  category: UtilityBill['category']
  subscriber_number: string | null
  contract_number: string | null
  dayOfMonth: number
  amount: number
  /** Bir sonraki ödeme günü (yyyy-MM-dd) */
  nextDue: string
  /** O aya ait fatura kaydı (varsa) */
  bill: UtilityBill | null
  /** Ödendi işaretlenirken yeni kayıt açmak için şablon / son fatura bilgisi */
  note: string | null
}

function nextOccurrence(day: number, from = new Date()): Date {
  const y = from.getFullYear()
  const m = from.getMonth()
  const clamp = (yy: number, mm: number) => Math.min(day, new Date(yy, mm + 1, 0).getDate())
  const thisMonth = new Date(y, m, clamp(y, m))
  if (differenceInCalendarDays(thisMonth, from) >= 0) return thisMonth
  return new Date(y, m + 1, clamp(y, m + 1))
}

function useBillCycles(): BillCycle[] {
  const { data: bills = [] } = useUtilityBills()
  const { data: templates = [] } = useUtilityBillTemplates()
  return React.useMemo(() => {
    const keyOf = (x: { category: string; subscriber_number: string | null; contract_number: string | null }) =>
      `${x.category}|${x.subscriber_number ?? ''}|${x.contract_number ?? ''}`
    const groups = new Map<string, UtilityBill[]>()
    for (const b of bills) groups.set(keyOf(b), [...(groups.get(keyOf(b)) ?? []), b])
    const keys = new Set([...groups.keys(), ...templates.filter((t) => t.is_active).map(keyOf)])
    const cycles: BillCycle[] = []
    for (const key of keys) {
      const list = (groups.get(key) ?? []).sort((a, b) => b.due_date.localeCompare(a.due_date))
      const template = templates.find((t) => t.is_active && keyOf(t) === key)
      const latest = list[0]
      const day = template?.day_of_month ?? (latest ? Number(latest.due_date.slice(8, 10)) : null)
      if (!day) continue
      const next = nextOccurrence(day)
      const nextDue = format(next, 'yyyy-MM-dd')
      const month = nextDue.slice(0, 7)
      const bill = list.find((b) => b.due_date.slice(0, 7) === month) ?? null
      const src = template ?? latest!
      cycles.push({
        key,
        category: src.category,
        subscriber_number: src.subscriber_number,
        contract_number: src.contract_number,
        dayOfMonth: day,
        amount: Number(bill?.amount ?? template?.amount ?? latest?.amount ?? 0),
        nextDue,
        bill,
        note: src.note,
      })
    }
    return cycles.sort((a, b) => a.nextDue.localeCompare(b.nextDue))
  }, [bills, templates])
}

/** Bir sonraki ödeme gününe ≤ 5 gün kalmış ve o ayın faturası ödenmemiş abonelikler. */
function useBillsDueSoon(): BillCycle[] {
  const cycles = useBillCycles()
  return React.useMemo(() => cycles.filter((c) => !c.bill?.is_paid && daysUntil(c.nextDue) <= BILL_WARN_DAYS), [cycles])
}

function dueLabel(days: number): string {
  if (days < 0) return `${-days} gün gecikti`
  if (days === 0) return 'son gün bugün'
  if (days === 1) return 'yarın son gün'
  return `${days} gün kaldı`
}

const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })

/** Popup'ı bir kez açan / tekrar açtıran ortak durum (AppShell'deki popup ↔ ana ekrandaki şerit). */
const OPEN_EVENT = 'bill-due-popup:open'
const SHOWN_KEY = 'bill-due-popup-shown-cycles'

function CycleRow({ cycle: c, onPaid, paying }: { cycle: BillCycle; onPaid: () => void; paying: boolean }) {
  const days = daysUntil(c.nextDue)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="font-medium">{UTILITY_BILL_CATEGORY_LABELS[c.category]} faturası</span>
      <span className="tabular-nums">{money(c.amount)}</span>
      <span className="text-muted-foreground">
        Her ayın {c.dayOfMonth}. günü · bu sefer {format(new Date(`${c.nextDue}T00:00:00`), 'd MMMM', { locale: trLocale })}
      </span>
      {c.subscriber_number && <span className="text-muted-foreground">Abone No: {c.subscriber_number}</span>}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold',
          days <= 1 ? 'animate-text-blink bg-destructive text-destructive-foreground' : 'bg-destructive/15 text-destructive',
        )}
      >
        {dueLabel(days)}
      </span>
      <Button size="sm" variant="outline" className="ml-auto h-7" disabled={paying} onClick={onPaid}>
        <Check className="size-3.5" /> Ödendi
      </Button>
    </div>
  )
}

/**
 * Fatura hatırlatma popup'ı (kullanıcı istekleri, 2026-10-21: "fatura son ödeme
 * tarihine 5 gün kala ana ekrana hatırlatma bildirimi gelsin", "açılışta ekrana
 * gelsin, sonra kapatılabilsin, popup şeklinde"). AppShell'e bir kez konur:
 * ödenmemiş ve son ödeme tarihine ≤ 5 gün kalmış (ya da geçmiş) fatura varsa
 * program her açıldığında bir kez açılır (oturum boyunca kapatılınca tekrar
 * açılmaz); ana ekrandaki şeritten yeniden açılabilir. Günde bir kez masaüstü
 * bildirimi de gönderilir. "Ödendi" ile fatura kapatılır.
 */
export function BillDuePopup() {
  const due = useBillsDueSoon()
  const markPaid = useUpdateUtilityBillPaid()
  const createBill = useCreateUtilityBill()
  const [open, setOpen] = React.useState(false)

  /** Bu ayın kaydı varsa ödendi yapılır; yoksa bu ay için kayıt açılıp ödendi işaretlenir. */
  async function pay(c: BillCycle) {
    if (c.bill) {
      markPaid.mutate({ id: c.bill.id, isPaid: true, reminderId: c.bill.reminder_id })
      return
    }
    const created = await createBill.mutateAsync({
      category: c.category,
      subscriber_number: c.subscriber_number,
      contract_number: c.contract_number,
      amount: c.amount,
      due_date: c.nextDue,
      note: c.note,
    })
    markPaid.mutate({ id: created.id, isPaid: true, reminderId: created.reminder_id })
  }

  // Her fatura dönemi için YALNIZCA BİR KEZ (kullanıcı isteği, 2026-10-23: "bildirim
  // popup ekrana bir kez gelsin, her açtığımda gelmesin") — gösterilen dönemler
  // (abonelik + o ayki son ödeme günü) hatırlanır; aynı fatura için bir daha
  // açılmaz, yeni bir dönem yaklaşınca yine bir kez açılır. Ana ekrandaki
  // şeritten istenince tekrar açılabilir.
  React.useEffect(() => {
    if (due.length === 0) return
    const ids = due.map((c) => `${c.key}@${c.nextDue}`)
    let seen: string[] = []
    try {
      seen = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]')
    } catch {
      /* bozuk kayıt — sıfırdan */
    }
    if (ids.every((id) => seen.includes(id))) return
    try {
      // geçmiş dönemleri biriktirme: son 50 kayıt yeter
      localStorage.setItem(SHOWN_KEY, JSON.stringify([...new Set([...seen, ...ids])].slice(-50)))
    } catch {
      /* depolama yoksa yine göster */
    }
    setOpen(true)
  }, [due])

  // Ana ekrandaki şeritten tekrar açma
  React.useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  // Günde bir kez masaüstü bildirimi
  React.useEffect(() => {
    if (due.length === 0) return
    const key = `bill-due-notified-${format(new Date(), 'yyyy-MM-dd')}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      /* yine de bildir */
    }
    const first = due[0]
    const title = due.length === 1 ? `${UTILITY_BILL_CATEGORY_LABELS[first.category]} faturası — ${dueLabel(daysUntil(first.nextDue))}` : `${due.length} faturanın son ödeme günü yaklaştı`
    const body = due.map((c) => `${UTILITY_BILL_CATEGORY_LABELS[c.category]}: ${money(c.amount)} · her ayın ${c.dayOfMonth}'i · ${dueLabel(daysUntil(c.nextDue))}`).join('\n')
    void window.electronAPI?.notify?.(title, body)
  }, [due])

  // Hepsi ödenince kendiliğinden kapansın
  React.useEffect(() => {
    if (due.length === 0) setOpen(false)
  }, [due.length])

  return (
    <Dialog open={open && due.length > 0} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <BellRing className="size-5 animate-text-blink" /> Fatura Hatırlatması
          </DialogTitle>
          <DialogDescription>
            {due.length} faturanın bu ayki ödeme gününe {BILL_WARN_DAYS} gün ya da daha az kaldı. Faturalar her ay aynı günde ödenir; ödediklerinizi "Ödendi" ile işaretleyin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[50vh] gap-1.5 overflow-y-auto">
          {due.map((c) => (
            <CycleRow key={c.key} cycle={c} paying={markPaid.isPending || createBill.isPending} onPaid={() => void pay(c)} />
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Link to="/faturalar" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ReceiptText className="size-3.5" /> Faturalara git
          </Link>
          <Button onClick={() => setOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Ana ekranda tek satırlık hatırlatma — popup kapatıldıktan sonra da görünür, tıklayınca popup açılır. */
export function BillDueBanner() {
  const due = useBillsDueSoon()
  if (due.length === 0) return null
  const soonest = due[0]
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="mb-4 flex w-full items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
    >
      <BellRing className="size-4 shrink-0 animate-text-blink" />
      <span className="font-semibold">
        {due.length} faturanın ödeme günü yaklaştı — en yakını {UTILITY_BILL_CATEGORY_LABELS[soonest.category]}, {dueLabel(daysUntil(soonest.nextDue))}
      </span>
      <span className="ml-auto text-xs underline">Göster</span>
    </button>
  )
}
