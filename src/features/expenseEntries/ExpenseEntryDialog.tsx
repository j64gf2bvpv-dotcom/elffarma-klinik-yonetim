import * as React from 'react'
import { Plus, Loader2, Paperclip, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { IMAGE_ACCEPT, isImageFile } from '@/lib/ensureReadableImage'
import { getErrorMessage } from '@/lib/utils'
import type { ExpenseEntry } from '@/types/database'
import { SECTION_BY_KEY, fetchKnownBillNumbers, getExpenseAttachmentUrl, isPdfPath, uploadExpenseAttachment, type ExpenseEntrySection } from './api'
import { useSaveExpenseEntry } from './hooks'

function todayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** Kayıtlı (yolu olan) ya da yeni seçilmiş (henüz yüklenmemiş) görüntü */
type Attachment = { kind: 'saved'; path: string; url: string | null } | { kind: 'new'; file: File; url: string | null }

/**
 * Giderler bölümüne kayıt ekle/düzenle (2026-11-11). Faturalı bölümlerde (elektrik/su/internet)
 * abone no + sözleşme no da sorulur ve yeni kayıtta son kayıttan otomatik doldurulur.
 */
export function ExpenseEntryDialog({
  section,
  entry,
  lastEntry,
  trigger,
}: {
  section: ExpenseEntrySection
  entry?: ExpenseEntry
  /** Aynı bölümün en son kaydı — abone/sözleşme no buradan önerilir */
  lastEntry?: ExpenseEntry
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const save = useSaveExpenseEntry()
  const [date, setDate] = React.useState(todayLocal())
  const [amount, setAmount] = React.useState<number | undefined>(undefined)
  const [subscriber, setSubscriber] = React.useState('')
  const [contract, setContract] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [saving, setSaving] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  // Faturalar bölümündeki abone/sözleşme numaraları — öneri listesi + yeni kayıtta otomatik doldurma
  const { data: known = [] } = useQuery({
    queryKey: ['bill_numbers', section.key],
    queryFn: () => fetchKnownBillNumbers(section.key),
    enabled: open && section.isBill,
  })
  const subscriberOptions = [...new Set([lastEntry?.subscriber_number, ...known.flatMap((k) => [k.subscriber_number, k.contract_number])].filter((x): x is string => !!x))]
  const contractOptions = [...new Set([lastEntry?.contract_number, ...known.flatMap((k) => [k.contract_number, k.subscriber_number])].filter((x): x is string => !!x))]

  // Yeni kayıtta boş kalan numaralar Faturalar'daki en son kayıttan doldurulur
  React.useEffect(() => {
    if (!open || entry || known.length === 0) return
    setSubscriber((v) => v || known.find((k) => k.subscriber_number)?.subscriber_number || '')
    setContract((v) => v || known.find((k) => k.contract_number)?.contract_number || '')
  }, [open, entry, known])

  React.useEffect(() => {
    if (!open) return
    setDate(entry?.entry_date ?? todayLocal())
    setAmount(entry ? Number(entry.amount) : undefined)
    setSubscriber(entry?.subscriber_number ?? lastEntry?.subscriber_number ?? '')
    setContract(entry?.contract_number ?? lastEntry?.contract_number ?? '')
    setDescription(entry?.description ?? '')
    const saved: Attachment[] = (entry?.attachment_paths ?? []).map((path) => ({ kind: 'saved', path, url: null }))
    setAttachments(saved)
    // Kayıtlı resimlerin küçük önizlemeleri
    for (const a of saved) {
      if (a.kind !== 'saved' || isPdfPath(a.path)) continue
      getExpenseAttachmentUrl(a.path)
        .then((url) => setAttachments((prev) => prev.map((x) => (x.kind === 'saved' && x.path === a.path ? { ...x, url } : x))))
        .catch(() => {})
    }
  }, [open, entry, lastEntry])

  function addFiles(files: Iterable<File>) {
    const list = Array.from(files)
    const ok = list.filter((f) => isImageFile(f) || isPdfFile(f))
    if (ok.length < list.length) toast.warning('Sadece resim ve PDF dosyaları eklenebilir')
    setAttachments((prev) => [...prev, ...ok.map((file): Attachment => ({ kind: 'new', file, url: isPdfFile(file) ? null : URL.createObjectURL(file) }))])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || amount == null) {
      toast.error('Tarih ve tutar girilmeli')
      return
    }
    setSaving(true)
    try {
      const paths: string[] = []
      for (const a of attachments) paths.push(a.kind === 'saved' ? a.path : await uploadExpenseAttachment(a.file))
      await save.mutateAsync({
        id: entry?.id,
        input: {
          category: section.key,
          entry_date: date,
          amount,
          subscriber_number: section.isBill ? subscriber.trim() || null : null,
          contract_number: section.isBill ? contract.trim() || null : null,
          description: description.trim() || null,
          attachment_paths: paths,
        },
      })
      setOpen(false)
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const doc = SECTION_BY_KEY[section.key].docLabel

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> {section.label} Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {section.label} — {entry ? 'Kaydı Düzenle' : 'Yeni Kayıt'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ee-date">{section.isBill ? 'Ödeme Tarihi' : 'Tarih'}</Label>
              <Input id="ee-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ee-amount">{section.isBill ? 'Ödenen Tutar' : 'Tutar'}</Label>
              <CurrencyInput id="ee-amount" value={amount} onChange={setAmount} placeholder="0,00" />
            </div>
            {section.isBill && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="ee-sub">Abone No</Label>
                  <Input id="ee-sub" list="ee-sub-options" value={subscriber} onChange={(e) => setSubscriber(e.target.value)} />
                  <datalist id="ee-sub-options">
                    {subscriberOptions.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ee-contract">Sözleşme No</Label>
                  <Input id="ee-contract" list="ee-contract-options" value={contract} onChange={(e) => setContract(e.target.value)} />
                  <datalist id="ee-contract-options">
                    {contractOptions.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
              </>
            )}
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="ee-desc">{section.isBill ? 'Not' : 'Açıklama'}</Label>
              <Input
                id="ee-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={section.isBill ? 'İsteğe bağlı' : 'Ne alındı? (ör. kırtasiye, çay-kahve, öğle yemeği)'}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{doc} Görüntüleri</Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={`${IMAGE_ACCEPT},application/pdf,.pdf`}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((a, i) => {
                  const pdf = a.kind === 'saved' ? isPdfPath(a.path) : isPdfFile(a.file)
                  return (
                    <div key={a.kind === 'saved' ? a.path : a.url ?? `${a.file.name}-${i}`} className="relative h-24 overflow-hidden rounded-md border bg-background">
                      {pdf || !a.url ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center text-[11px] text-muted-foreground">
                          {pdf ? <FileText className="size-6" /> : <Loader2 className="size-4 animate-spin" />}
                          {pdf && (a.kind === 'new' ? a.file.name : 'PDF')}
                        </div>
                      ) : (
                        <img src={a.url} alt={`${doc} ${i + 1}`} className="h-full w-full object-contain" />
                      )}
                      <button
                        type="button"
                        title="Kaldır"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 rounded-full bg-background/90 p-1 hover:bg-destructive hover:text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              className={`flex items-center justify-center gap-2 rounded-md border border-dashed py-4 text-sm text-muted-foreground hover:bg-accent ${
                dragging ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <Paperclip className="size-4" /> {doc} resmi ya da PDF ekleyin (tıklayın veya sürükleyin)
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
