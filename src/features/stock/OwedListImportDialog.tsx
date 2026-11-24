import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, GitCompareArrows, Loader2, MessageCircle, Upload, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createCustomer, createPendingProduct } from '@/features/customers/api'
import { cariName } from '@/features/doctorVisits/linkCustomer'
import { readWhatsAppChatFile } from '@/features/doctorVisits/whatsappChat'
import { supabase } from '@/lib/supabaseClient'
import { cn, getErrorMessage } from '@/lib/utils'
import type { Product } from '@/types/database'
import { compareOwedLists, parseOwedExcel, parseOwedWhatsApp, readWorkbookMatrices, type CariLite, type CompareRow, type CompareStatus, type ExistingOwed, type OwedLine } from './owedListImport'

const STATUS: Record<CompareStatus, { label: string; tone: 'ok' | 'warn' | 'info' }> = {
  eslesti: { label: 'İki listede aynı', tone: 'ok' },
  farkli: { label: 'Adet farklı', tone: 'warn' },
  yalniz_wa: { label: 'Yalnız WhatsApp’ta', tone: 'warn' },
  yalniz_xl: { label: 'Yalnız Excel’de', tone: 'warn' },
  tek_kaynak: { label: 'Listeden', tone: 'info' },
}

type Filter = 'tumu' | 'eklenecek' | 'kontrol' | 'programda'

/**
 * Borçlu olduğumuz ürünleri WhatsApp konuşması + Excel listesinden toplu ekleme (kullanıcı isteği, 2026-11-24).
 * İki liste kıyaslanır: iki listede aynı olanlar seçili gelir; adeti farklı olanlar Excel'deki adetle seçili ama
 * işaretli gelir; yalnız tek listede geçenler seçilmeden gelir (kontrol edilip elle seçilsin). Programda zaten açık
 * duran borç düşülür — tamamı zaten varsa satır eklenmez. Doktor Cari Kart'ta yoksa yeni kart açılır.
 */
export function OwedListImportDialog({
  open,
  onOpenChange,
  existing,
  products,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  existing: ExistingOwed[]
  products: Product[]
}) {
  const queryClient = useQueryClient()
  const [waText, setWaText] = React.useState('')
  const [waFile, setWaFile] = React.useState<string | null>(null)
  const [xlFile, setXlFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [rows, setRows] = React.useState<CompareRow[] | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [qtyEdit, setQtyEdit] = React.useState<Record<string, string>>({})
  const [counts, setCounts] = React.useState<{ wa: number | null; xl: number | null }>({ wa: null, xl: null })
  const [filter, setFilter] = React.useState<Filter>('tumu')
  const waInput = React.useRef<HTMLInputElement>(null)
  const xlInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setWaText('')
    setWaFile(null)
    setXlFile(null)
    setRows(null)
    setSelected(new Set())
    setQtyEdit({})
    setFilter('tumu')
  }, [open])

  async function pickWhatsApp(file: File | undefined) {
    if (!file) return
    try {
      setWaText(await readWhatsAppChatFile(file))
      setWaFile(file.name)
    } catch (err) {
      toast.error('Sohbet dosyası okunamadı', { description: getErrorMessage(err) })
    }
  }

  async function compare() {
    setBusy(true)
    try {
      let wa: OwedLine[] | null = null
      let xl: OwedLine[] | null = null
      if (waText.trim()) wa = parseOwedWhatsApp(waText, products)
      if (xlFile) xl = parseOwedExcel(await readWorkbookMatrices(xlFile), products)
      if (waText.trim() && !wa?.length) toast.warning('WhatsApp konuşmasında doktor + ürün satırı bulunamadı', { description: 'Satırlar "Dr. Ad Soyad — 2 kutu Ürün" gibi olmalı.' })
      if (xlFile && !xl?.length) toast.warning('Excel listesinde doktor + ürün satırı bulunamadı', { description: 'Sütunlar "Doktor / Ürün / Adet" olmalı.' })
      // Cari Kart'ın tamamı (sayfalı liste değil) — doktor eşleşmesi kaçmasın
      const { data: cari, error } = await supabase.from('customers').select('id, full_name, phone, mobile_phone, whatsapp_phone')
      if (error) throw error
      const result = compareOwedLists(wa, xl, existing, (cari ?? []) as CariLite[], products)
      if (!result.length) return
      const sel = new Set(result.filter((r) => r.addQty > 0 && (r.status === 'eslesti' || r.status === 'farkli' || r.status === 'tek_kaynak')).map((r) => r.key))
      setCounts({ wa: wa ? wa.length : null, xl: xl ? xl.length : null })
      setSelected(sel)
      setQtyEdit({})
      setRows(result)
      setFilter('tumu')
    } catch (err) {
      toast.error('Liste okunamadı', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const qtyFor = (r: CompareRow) => {
    const v = qtyEdit[r.key]
    return v != null ? Number(v) || 0 : r.addQty
  }
  const toggle = (key: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s)
      if (on) n.add(key)
      else n.delete(key)
      return n
    })

  const chosen = (rows ?? []).filter((r) => selected.has(r.key) && qtyFor(r) > 0)
  const newDoctors = new Set(chosen.filter((r) => !r.customer).map((r) => r.doctor.toLocaleLowerCase('tr-TR'))).size
  const summary = rows && {
    eslesti: rows.filter((r) => r.status === 'eslesti').length,
    farkli: rows.filter((r) => r.status === 'farkli').length,
    yalnizWa: rows.filter((r) => r.status === 'yalniz_wa').length,
    yalnizXl: rows.filter((r) => r.status === 'yalniz_xl').length,
    programda: rows.filter((r) => r.existingQty > 0 && r.addQty === 0).length,
  }
  const visible = (rows ?? []).filter((r) =>
    filter === 'tumu' ? true : filter === 'eklenecek' ? selected.has(r.key) : filter === 'kontrol' ? r.status === 'farkli' || r.status === 'yalniz_wa' || r.status === 'yalniz_xl' || r.waRepeated || !r.product : r.existingQty > 0,
  )

  async function save() {
    setBusy(true)
    const created = new Map<string, string>()
    let ok = 0
    try {
      const source = waText.trim() && xlFile ? 'WhatsApp + Excel listesi' : waText.trim() ? 'WhatsApp listesi' : 'Excel listesi'
      for (const r of chosen) {
        let cid = r.customer?.id
        if (!cid) {
          const k = r.doctor.toLocaleLowerCase('tr-TR')
          cid = created.get(k)
          if (!cid) {
            const c = await createCustomer({
              full_name: cariName(r.doctor),
              phone: r.phone?.trim() ?? '',
              tags: [],
              is_invoiced: false,
              doctor_type: 'sahis',
              sales_rep_id: null,
              notes: `Borçlu olduğumuz ürünler — ${source} ile eklendi, ${new Date().toLocaleDateString('tr-TR')}`,
            })
            cid = c.id
            created.set(k, cid)
          }
        }
        const note = [...r.notes, source, r.status === 'farkli' ? `WhatsApp ${r.waQty} / Excel ${r.xlQty} adet` : null, r.existingQty > 0 ? `programda ${r.existingQty} adet vardı` : null].filter(Boolean).join(' · ')
        await createPendingProduct({ customer_id: cid, product_name: r.productName, quantity: qtyFor(r), unit_price: r.unitPrice || 0, note })
        ok++
      }
      toast.success(`${ok} ürün borç listesine eklendi`, { description: created.size ? `${created.size} yeni doktor kartı açıldı.` : undefined })
      void queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
      if (created.size) void queryClient.invalidateQueries({ queryKey: ['customers'] })
      onOpenChange(false)
    } catch (err) {
      toast.error(ok ? `${ok} ürün eklendi, kalanlar eklenemedi` : 'Eklenemedi', { description: getErrorMessage(err) })
      if (ok) void queryClient.invalidateQueries({ queryKey: ['customer_pending_products'] })
    } finally {
      setBusy(false)
    }
  }

  const chip = (k: Filter, label: string, n: number, tone?: 'warn' | 'ok') => (
    <button
      key={k}
      type="button"
      onClick={() => setFilter(k)}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-border',
        filter === k ? 'bg-primary text-primary-foreground ring-primary' : tone === 'warn' && n ? 'bg-warning/10 text-warning' : tone === 'ok' ? 'bg-success/10 text-success' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label} ({n})
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>WhatsApp / Excel listesinden borçlu ürün ekle</DialogTitle>
          <DialogDescription>
            {rows
              ? 'İki liste ve programdaki kayıtlar karşılaştırıldı. Seçili satırlar eklenecek; işaretli olanları kontrol edin.'
              : 'WhatsApp konuşmasını yapıştırın ya da dosyasını seçin, Excel listesini yükleyin. İkisi birlikte verilirse birbiriyle kıyaslanır; tek biri de yeterli.'}
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="size-4 text-success" /> WhatsApp konuşması
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => waInput.current?.click()}>
                  <Upload className="size-4" /> Sohbet dosyası
                </Button>
                <input ref={waInput} type="file" accept=".txt,.zip" className="hidden" onChange={(e) => { void pickWhatsApp(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              {waFile && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {waFile}
                  <button type="button" aria-label="Kaldır" className="hover:text-destructive" onClick={() => { setWaFile(null); setWaText('') }}>
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              <Textarea
                rows={10}
                value={waText}
                onChange={(e) => { setWaText(e.target.value); setWaFile(null) }}
                placeholder={'Konuşmayı buraya yapıştırın, örn.\n\nDr. Ali Kaya\n2 kutu BVRS PL\n1 Fillicia\n\nAyşe Yılmaz 0532 111 22 33 - 3 paket Mixo'}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">WhatsApp’ta sohbet › Sohbeti dışa aktar (.txt/.zip) ya da mesajları kopyalayıp yapıştırın. Selamlaşma ve diğer konuşmalar alınmaz.</p>
            </div>

            <div className="grid content-start gap-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FileSpreadsheet className="size-4 text-success" /> Excel listesi
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => xlInput.current?.click()}>
                  <Upload className="size-4" /> Excel seç
                </Button>
                <input ref={xlInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { setXlFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
              </div>
              {xlFile ? (
                <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <FileSpreadsheet className="size-4 shrink-0" /> <span className="min-w-0 flex-1 truncate">{xlFile.name}</span>
                  <button type="button" aria-label="Kaldır" className="text-muted-foreground hover:text-destructive" onClick={() => setXlFile(null)}>
                    <X className="size-4" />
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => xlInput.current?.click()} className="grid place-items-center gap-1 rounded-lg border border-dashed px-3 py-10 text-sm text-muted-foreground hover:bg-muted/50">
                  <FileSpreadsheet className="size-6" /> Excel dosyası seçin
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Sütunlar <b>Doktor · Ürün · Adet</b> (isteğe bağlı Fiyat, Telefon) olabilir; doktor hücresi boş satırlar üstteki doktora yazılır. Satırda doktor, sütun başlığında ürün adları olan tablolar da okunur.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {counts.wa != null && <span>WhatsApp’tan {counts.wa} satır</span>}
              {counts.xl != null && <span>Excel’den {counts.xl} satır</span>}
              {summary && counts.wa != null && counts.xl != null && (
                <span>
                  {summary.eslesti} aynı · {summary.farkli} adet farklı · {summary.yalnizWa} yalnız WhatsApp · {summary.yalnizXl} yalnız Excel
                </span>
              )}
              {summary && summary.programda > 0 && <span>{summary.programda} kalem zaten programda</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chip('tumu', 'Tümü', rows.length)}
              {chip('eklenecek', 'Eklenecek', chosen.length, 'ok')}
              {chip('kontrol', 'Kontrol edilmeli', rows.filter((r) => r.status === 'farkli' || r.status === 'yalniz_wa' || r.status === 'yalniz_xl' || r.waRepeated || !r.product).length, 'warn')}
              {chip('programda', 'Programda olan', rows.filter((r) => r.existingQty > 0).length)}
            </div>

            <div className="divide-y rounded-xl border">
              <div className="hidden grid-cols-[1.5rem_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_5rem] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                <span />
                <span>Doktor</span>
                <span>Ürün</span>
                <span>Kıyaslama</span>
                <span className="text-right">Eklenecek</span>
              </div>
              {visible.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">Bu filtrede satır yok.</p>}
              {visible.map((r) => {
                const st = STATUS[r.status]
                const on = selected.has(r.key)
                return (
                  <label
                    key={r.key}
                    title={r.raws.join('\n')}
                    className={cn('grid cursor-pointer grid-cols-[1.5rem_minmax(0,1fr)_5rem] items-start gap-x-3 gap-y-1 px-3 py-2.5 md:grid-cols-[1.5rem_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_5rem]', !on && 'opacity-60')}
                  >
                    <input type="checkbox" className="mt-1 size-4 accent-primary" checked={on} onChange={(e) => toggle(r.key, e.target.checked)} />
                    <span className="min-w-0 md:col-auto">
                      <span className="block font-medium break-words">{r.doctor}</span>
                      {r.customer ? (
                        <span className="text-xs text-muted-foreground">Cari Kart’ta var</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <UserPlus className="size-3" /> Yeni kart açılacak
                        </span>
                      )}
                      {/* Dar ekranda ürün ve kıyaslama doktorun altına iner */}
                      <span className="mt-1 block md:hidden">
                        <span className="block text-sm break-words">{r.productName}</span>
                        <Compare r={r} st={st} />
                      </span>
                    </span>
                    <span className="hidden min-w-0 md:block">
                      <span className="block break-words">{r.productName}</span>
                      {!r.product && <span className="text-xs text-warning">Katalogda eşleşmedi</span>}
                    </span>
                    <span className="hidden min-w-0 md:block">
                      <Compare r={r} st={st} />
                    </span>
                    <span className="flex justify-end">
                      <Input
                        inputMode="numeric"
                        aria-label="Eklenecek adet"
                        className="h-8 w-16 text-right"
                        value={qtyEdit[r.key] ?? String(r.addQty)}
                        onClick={(e) => e.preventDefault()}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d]/g, '')
                          setQtyEdit((q) => ({ ...q, [r.key]: v }))
                          if (Number(v) > 0) toggle(r.key, true)
                        }}
                      />
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              İki listede aynı olanlar seçili gelir. Adeti farklı olanlarda Excel’deki adet önerilir. Yalnız tek listede geçenler kontrol için seçilmeden gelir. Programda zaten olan adet düşülür. Satırın üstünde durunca nereden okunduğu görünür.
            </p>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {rows ? (
            <>
              <Button variant="ghost" onClick={() => setRows(null)} disabled={busy}>
                <ArrowLeft className="size-4" /> Listeleri değiştir
              </Button>
              <Button onClick={() => void save()} disabled={busy || chosen.length === 0}>
                {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-4" />} {chosen.length} ürünü ekle{newDoctors ? ` (${newDoctors} yeni doktor)` : ''}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Vazgeç
              </Button>
              <Button onClick={() => void compare()} disabled={busy || (!waText.trim() && !xlFile)}>
                {busy ? <Loader2 className="animate-spin" /> : <GitCompareArrows className="size-4" />} {waText.trim() && xlFile ? 'Kıyasla' : 'Listeyi oku'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Compare({ r, st }: { r: CompareRow; st: { label: string; tone: 'ok' | 'warn' | 'info' } }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
          st.tone === 'ok' && 'bg-success/12 text-success',
          st.tone === 'warn' && 'bg-warning/15 text-warning',
          st.tone === 'info' && 'bg-muted text-muted-foreground',
        )}
      >
        {st.tone === 'warn' ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />} {st.label}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {r.waQty != null && `WA ${r.waQty}`}
        {r.waQty != null && r.xlQty != null && ' · '}
        {r.xlQty != null && `Excel ${r.xlQty}`}
        {r.existingQty > 0 && ` · programda ${r.existingQty}`}
      </span>
      {r.waRepeated && <span className="text-warning">WhatsApp’ta farklı adetlerle tekrar geçiyor</span>}
      {r.notes.length > 0 && <span className={cn('basis-full', /incelen/i.test(r.notes.join(' ')) ? 'font-medium text-warning' : 'text-muted-foreground')}>{r.notes.join(' · ')}</span>}
      {r.existingQty > 0 && r.addQty === 0 && <span className="text-muted-foreground">Zaten programda</span>}
    </span>
  )
}
