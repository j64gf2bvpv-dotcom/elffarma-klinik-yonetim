import * as React from 'react'
import { Check, ChevronLeft, MessageCircle, SkipForward, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useWhatsAppTemplates } from './hooks'
import { buildWhatsAppAppUrl, buildWhatsAppUrl, openWhatsApp, renderTemplate } from './renderTemplate'
import { formatTrPhoneForDisplay, normalizeTrPhone } from './normalizePhone'
import type { Customer } from '@/types/database'

/**
 * Toplu WhatsApp — sıralı, yarı otomatik (kullanıcı isteği ve seçimi,
 * 2026-10-02: "tüm doktorlara tek seferde WhatsApp'a mesaj gönderebilmeliyim",
 * ücretsiz yol). Mesaj bir kez yazılır ({{ad}} kişinin adıyla değişir); program
 * seçilen doktorların sohbetlerini mesaj hazır şekilde SIRAYLA açar, her
 * birinde kullanıcı WhatsApp'ta "Gönder"e basar. WhatsApp'ın resmi olmayan
 * toplu gönderim yolları hesap kapatılmasına yol açtığı için gönderme tuşu
 * bilerek kullanıcıda bırakıldı.
 *
 * Alıcılar Cari Kart'ın o anki filtresinden (arama, il, etiket, fatura) gelir;
 * numara olarak WhatsApp > Cep > Telefon sırasıyla ilk geçerli CEP numarası
 * kullanılır. İlerleme tarayıcıda saklanır — pencere kapansa da kalınan
 * yerden devam edilebilir.
 */

interface Recipient {
  customer: Customer
  waDigits: string | null
  display: string
}

type Status = 'pending' | 'opened' | 'skipped'

const PROGRESS_KEY = 'bulk-whatsapp-progress'

interface SavedProgress {
  message: string
  ids: string[]
  index: number
  statuses: Record<string, Status>
}

function pickNumber(c: Customer): { waDigits: string | null; display: string } {
  for (const raw of [c.whatsapp_phone, c.mobile_phone, c.phone]) {
    if (!raw) continue
    const digits = raw.replace(/\D/g, '')
    const n = normalizeTrPhone(digits.startsWith('00') ? digits.slice(2) : raw)
    if (n?.isMobile) return { waDigits: n.waDigits, display: formatTrPhoneForDisplay(n.canonical) }
  }
  return { waDigits: null, display: c.phone ? formatTrPhoneForDisplay(c.phone) : '—' }
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as SavedProgress) : null
  } catch {
    return null
  }
}

function saveProgress(p: SavedProgress | null) {
  try {
    if (p) localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
    else localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // depolama kapalıysa ilerleme sadece bu oturumda tutulur
  }
}

export function BulkWhatsAppDialog({ customers, filterLabel }: { customers: Customer[]; filterLabel: string }) {
  const { data: templates = [] } = useWhatsAppTemplates()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<'compose' | 'send'>('compose')
  const [templateId, setTemplateId] = React.useState('custom')
  const [message, setMessage] = React.useState('Merhaba {{ad}},\n\n')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [queue, setQueue] = React.useState<Recipient[]>([])
  const [index, setIndex] = React.useState(0)
  const [statuses, setStatuses] = React.useState<Record<string, Status>>({})
  const [useApp, setUseApp] = React.useState(true)
  const [autoNext, setAutoNext] = React.useState(true)
  const waitingForReturn = React.useRef(false)

  const recipients = React.useMemo<Recipient[]>(
    () => customers.map((customer) => ({ customer, ...pickNumber(customer) })),
    [customers],
  )
  const withNumber = recipients.filter((r) => r.waDigits)
  const saved = open ? loadProgress() : null
  const canResume = !!saved && saved.index < saved.ids.length

  function openDialog() {
    setStep('compose')
    setSelected(new Set(withNumber.map((r) => r.customer.id)))
    setOpen(true)
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) setMessage(t.body)
  }

  function startSending(resume?: SavedProgress) {
    if (resume) {
      const byId = new Map(recipients.map((r) => [r.customer.id, r]))
      const q = resume.ids.map((id) => byId.get(id)).filter(Boolean) as Recipient[]
      if (q.length === 0) {
        toast.error('Kaydedilen liste bu filtrede bulunamadı', { description: 'Cari Kart filtresini temizleyip tekrar deneyin.' })
        return
      }
      setMessage(resume.message)
      setQueue(q)
      setIndex(Math.min(resume.index, q.length))
      setStatuses(resume.statuses)
    } else {
      const q = withNumber.filter((r) => selected.has(r.customer.id))
      if (q.length === 0 || !message.trim()) return
      setQueue(q)
      setIndex(0)
      setStatuses({})
      saveProgress({ message, ids: q.map((r) => r.customer.id), index: 0, statuses: {} })
    }
    setStep('send')
  }

  const current = queue[index]

  const advance = React.useCallback(
    (status: Status) => {
      if (!current) return
      const nextStatuses = { ...statuses, [current.customer.id]: status }
      const nextIndex = index + 1
      setStatuses(nextStatuses)
      setIndex(nextIndex)
      saveProgress(
        nextIndex >= queue.length
          ? null
          : { message, ids: queue.map((r) => r.customer.id), index: nextIndex, statuses: nextStatuses },
      )
    },
    [current, statuses, index, queue, message],
  )

  const openCurrent = React.useCallback(async () => {
    if (!current?.waDigits) return
    const text = renderTemplate(message, { ad: current.customer.full_name })
    const url = useApp ? buildWhatsAppAppUrl(current.waDigits, text) : buildWhatsAppUrl(current.waDigits, text)
    const ok = await openWhatsApp(url)
    if (!ok) {
      toast.error('WhatsApp açılamadı', { description: useApp ? '"Masaüstü uygulamasında aç" seçeneğini kapatıp tekrar deneyin.' : undefined })
      return
    }
    waitingForReturn.current = true
    advance('opened')
  }, [current, message, useApp, advance])

  // Kullanıcı WhatsApp'ta gönderip programa dönünce sıradakini otomatik aç
  React.useEffect(() => {
    if (!open || step !== 'send' || !autoNext) return
    function onFocus() {
      if (!waitingForReturn.current) return
      waitingForReturn.current = false
      window.setTimeout(() => void openCurrent(), 400)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [open, step, autoNext, openCurrent])

  const openedCount = Object.values(statuses).filter((s) => s === 'opened').length
  const skippedCount = Object.values(statuses).filter((s) => s === 'skipped').length
  const finished = step === 'send' && index >= queue.length
  const preview = renderTemplate(message, { ad: (withNumber.find((r) => selected.has(r.customer.id)) ?? withNumber[0])?.customer.full_name ?? 'Dr. Ayşe Yılmaz' })

  return (
    <>
      <Button variant="outline" onClick={openDialog} disabled={customers.length === 0}>
        <MessageCircle /> Toplu WhatsApp
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) waitingForReturn.current = false
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Toplu WhatsApp Mesajı</DialogTitle>
            <DialogDescription>
              {step === 'compose'
                ? `Alıcılar Cari Kart'ın şu anki listesinden geliyor (${filterLabel}). Mesajı yazın, kişileri seçin; sohbetler mesaj hazır şekilde sırayla açılır, her birinde WhatsApp'ta "Gönder"e siz basarsınız.`
                : 'Her kişide "WhatsApp\'ta Aç"a basın, WhatsApp\'ta mesajı gönderin ve programa dönün.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'compose' && (
            <div className="grid gap-4">
              {canResume && saved && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <span>
                    Yarıda kalmış bir gönderim var: {saved.index}/{saved.ids.length} kişi tamamlanmış.
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveProgress(null)}>
                      Sil
                    </Button>
                    <Button size="sm" onClick={() => startSending(saved)}>
                      Kaldığım Yerden Devam Et
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label>Şablon</Label>
                <Select value={templateId} onValueChange={applyTemplate}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Kendi mesajım</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Mesaj — {'{{ad}}'} her kişide doktorun adıyla değişir</Label>
                <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
                <p className="text-muted-foreground rounded-md bg-muted/50 p-2 text-xs whitespace-pre-wrap">
                  <span className="font-medium">Önizleme:</span> {preview}
                </p>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between border-b pb-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selected.size === withNumber.length && withNumber.length > 0}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(withNumber.map((r) => r.customer.id)) : new Set())}
                    />
                    Tümünü seç ({withNumber.length} kişide cep numarası var
                    {recipients.length > withNumber.length && `, ${recipients.length - withNumber.length} kişide yok`})
                  </label>
                  <span className="text-muted-foreground">{selected.size} kişi seçili</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {recipients.map((r) => (
                    <label
                      key={r.customer.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-1 text-sm',
                        r.waDigits ? 'cursor-pointer hover:bg-accent' : 'opacity-50',
                      )}
                    >
                      <Checkbox
                        checked={selected.has(r.customer.id)}
                        disabled={!r.waDigits}
                        onCheckedChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(r.customer.id)) next.delete(r.customer.id)
                            else next.add(r.customer.id)
                            return next
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{r.customer.full_name}</span>
                      <span className="text-muted-foreground text-xs">{r.waDigits ? r.display : 'Cep numarası yok'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'send' && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {Math.min(index, queue.length)}/{queue.length} tamamlandı
                </Badge>
                <Badge variant="success">{openedCount} açıldı</Badge>
                {skippedCount > 0 && <Badge variant="outline">{skippedCount} atlandı</Badge>}
                <div className="ml-auto flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox checked={useApp} onCheckedChange={(v) => setUseApp(v === true)} />
                    Masaüstü uygulamasında aç
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox checked={autoNext} onCheckedChange={(v) => setAutoNext(v === true)} />
                    Programa dönünce sıradakini aç
                  </label>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-success transition-all" style={{ width: `${queue.length ? (Math.min(index, queue.length) / queue.length) * 100 : 0}%` }} />
              </div>

              {current ? (
                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold">{current.customer.full_name}</span>
                    <span className="text-muted-foreground text-sm">{current.display}</span>
                  </div>
                  <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                    {renderTemplate(message, { ad: current.customer.full_name })}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
                      <ChevronLeft /> Geri
                    </Button>
                    <Button variant="outline" onClick={() => advance('skipped')}>
                      <SkipForward /> Atla
                    </Button>
                    <Button onClick={() => void openCurrent()}>
                      <Send /> WhatsApp'ta Aç
                    </Button>
                  </div>
                </div>
              ) : (
                finished && (
                  <div className="flex flex-col items-center gap-2 rounded-lg border p-6 text-center">
                    <Check className="size-8 text-success" />
                    <p className="font-semibold">Liste bitti</p>
                    <p className="text-muted-foreground text-sm">
                      {openedCount} kişinin sohbeti açıldı{skippedCount > 0 && `, ${skippedCount} kişi atlandı`}.
                    </p>
                  </div>
                )
              )}

              <div className="max-h-40 overflow-y-auto text-sm">
                {queue.map((r, i) => {
                  const st = statuses[r.customer.id]
                  return (
                    <div key={r.customer.id} className={cn('flex items-center gap-2 px-1 py-0.5', i === index && 'font-semibold')}>
                      <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{r.customer.full_name}</span>
                      {st === 'opened' && <span className="text-xs text-success">✓ açıldı</span>}
                      {st === 'skipped' && <span className="text-xs text-muted-foreground">atlandı</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            {step === 'compose' ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Vazgeç
                </Button>
                <Button onClick={() => startSending()} disabled={selected.size === 0 || !message.trim()}>
                  <Send /> {selected.size} Kişiye Göndermeye Başla
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep('compose')}>
                  Mesaja Dön
                </Button>
                <Button onClick={() => setOpen(false)}>{finished ? 'Kapat' : 'Sonra Devam Et'}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
