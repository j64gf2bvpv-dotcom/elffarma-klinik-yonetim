import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, ScanText } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { readBillText } from '@/features/bills/readBill'
import { downloadDocument, isPdfPath } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import type { Personnel, PersonnelDocument } from '@/types/database'
import type { VehicleWithRelations } from '@/features/vehicles/api'
import { savePersonnelDocument, updatePersonnel, uploadPersonnelAttachment } from './api'
import { classifyDocText } from './classifyDoc'
import { docTypeLabel } from './docTypes'
import { ID_FIELDS, ID_FIELD_LABELS, mergeIdInfo, parseIdInfo, type IdInfo } from './idInfo'
import { trDate } from './status'

// Kimlik bilgisinde güvenilirlik sırası: resmi kimlik belgeleri önce, kişinin beyanına dayananlar sonra
const ORDER = ['nufus_cuzdani', 'ehliyet', 'nufus_kayit', 'ikametgah', 'askerlik', 'adli_sicil', 'diploma', 'saglik_raporu', 'sgk_giris', 'is_sozlesmesi', 'banka']
const SKIP_TYPES = new Set(['vesikalik', 'cv', 'kvkk', 'isg_egitim'])

type Change = { key: keyof IdInfo; current: string | null; found: string; source: string; on: boolean }
type TypeFix = { doc: PersonnelDocument; to: string; on: boolean }
/** Araçlar bölümündeki ehliyet fotoğrafı — kişinin evraklarında ehliyet yoksa oraya da kopyalanır */
type LicenseCopy = { paths: string[]; plate: string; on: boolean }

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
/** Bir dosya takılırsa bütün okuma kilitlenmesin — süre dolunca o dosya atlanır */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('zaman aşımı')), ms))])
}
const show = (k: keyof IdInfo, v: string | null) => (v && k === 'birth_date' ? trDate(v) : (v ?? ''))
// Yazım farkı da düzeltilir ("kazan" → "Kazan"), yalnız boşluk farkı sayılmaz
const same = (a: string | null, b: string) => (a ?? '').replace(/\s+/g, ' ').trim() === b

/**
 * Kişinin yüklü evraklarını (kimlik, ehliyet, e-Devlet belgeleri, diploma, sağlık raporu, sözleşme…) okuyup kimlik
 * bilgilerini kartla karşılaştırır; boş ya da belgeyle uyuşmayan alanlar önerilir, onaylananlar karta yazılır
 * (kullanıcı isteği, 2026-11-17: "bu kısımları dosyalarını incele çek, doğru eksiksiz düzenli nizami olsun").
 * Yanlış türde yüklenmiş evrak (ör. "Ehliyet" diye yüklenmiş kimlik kartı) da düzeltilmek üzere önerilir.
 * Okuma bilgisayarda yapılır, hiçbir servise gönderilmez.
 */
export function PersonnelFillFromDocsDialog({
  person,
  docs,
  vehicles = [],
}: {
  person: Personnel
  docs: PersonnelDocument[]
  /** Kişiye verilmiş araçlar — araçtaki ehliyet ön/arka yüzü de okunur (kullanıcı isteği, 2026-11-17) */
  vehicles?: VehicleWithRelations[]
}) {
  const [open, setOpen] = React.useState(false)
  const [progress, setProgress] = React.useState<string | null>(null)
  const [changes, setChanges] = React.useState<Change[] | null>(null)
  const [typeFixes, setTypeFixes] = React.useState<TypeFix[]>([])
  const [failed, setFailed] = React.useState<string[]>([])
  const [licenseCopy, setLicenseCopy] = React.useState<LicenseCopy | null>(null)
  const [saving, setSaving] = React.useState(false)
  const qc = useQueryClient()

  const readable = docs
    .filter((d) => d.attachment_paths.length && !SKIP_TYPES.has(d.doc_type))
    .sort((a, b) => (ORDER.indexOf(a.doc_type) + 1 || 99) - (ORDER.indexOf(b.doc_type) + 1 || 99))
  const vehicleLicenses = vehicles
    .map((v) => ({ plate: v.plate_number || v.brand_model, paths: [v.license_front_path, v.license_back_path].filter((p): p is string => !!p) }))
    .filter((v) => v.paths.length)
  // Araçtaki ehliyet sahte bir "ehliyet" evrakı gibi okunur, ehliyet sırasına konur
  const sources: (PersonnelDocument & { vehiclePlate?: string })[] = [
    ...vehicleLicenses.map((v) => ({ ...({} as PersonnelDocument), id: `arac-${v.plate}`, doc_type: 'ehliyet', title: `Ehliyet (araç ${v.plate})`, attachment_paths: v.paths, vehiclePlate: v.plate })),
    ...readable,
  ].sort((a, b) => (ORDER.indexOf(a.doc_type) + 1 || 99) - (ORDER.indexOf(b.doc_type) + 1 || 99))

  async function scan() {
    setOpen(true)
    setChanges(null)
    setTypeFixes([])
    setLicenseCopy(null)
    const found: { info: IdInfo; label: string }[] = []
    const fixes: TypeFix[] = []
    const failed: string[] = []
    const have = new Set(docs.map((d) => d.doc_type))
    try {
      let n = 0
      const total = sources.reduce((s, d) => s + d.attachment_paths.length, 0)
      for (const d of sources) {
        let docText = ''
        for (const path of d.attachment_paths) {
          setProgress(`Evraklar okunuyor… ${++n}/${total} (${docTypeLabel(d.doc_type)})`)
          try {
            docText +=
              '\n' +
              (await withTimeout(
                downloadDocument(path).then((blob) =>
                  readBillText(new File([blob], isPdfPath(path) ? 'belge.pdf' : 'belge.jpg', { type: isPdfPath(path) ? 'application/pdf' : 'image/jpeg' })),
                ),
                90_000,
              ))
          } catch (err) {
            console.warn('[belgelerden doldur]', path, err)
            failed.push(d.title || docTypeLabel(d.doc_type))
          }
        }
        // Evrak yanlış türde yüklenmişse metin asıl türüne göre okunur ve tür düzeltmesi önerilir
        const guessed = classifyDocText(docText)
        if (d.vehiclePlate) {
          found.push({ info: parseIdInfo(docText, 'ehliyet'), label: d.title ?? 'Ehliyet' })
          continue
        }
        const type = guessed && guessed !== d.doc_type && d.doc_type !== 'diger' && !have.has(guessed) ? guessed : d.doc_type
        if (type !== d.doc_type) {
          fixes.push({ doc: d, to: type, on: true })
          have.add(type)
        }
        found.push({ info: parseIdInfo(docText, d.doc_type === 'diger' ? (guessed ?? 'diger') : type), label: d.title || docTypeLabel(type) })
      }
      const merged = mergeIdInfo(found.map((f) => f.info))
      const list: Change[] = []
      for (const k of ID_FIELDS) {
        const v = merged[k]
        if (!v || same(person[k], v)) continue
        // Kartta daha ayrıntılı yazılmışsa ("Adana / Yüreğir") belgedeki kısa hali ("Adana") önerilmez
        if ((k === 'birth_place' || k === 'address') && person[k] && fold(person[k]).includes(fold(v))) continue
        list.push({ key: k, current: person[k], found: v, source: found.find((f) => f.info[k] === v)?.label ?? '', on: true })
      }
      setChanges(list)
      setTypeFixes(fixes)
      setFailed(failed)
      if (!have.has('ehliyet') && vehicleLicenses.length) setLicenseCopy({ ...vehicleLicenses[0], on: true })
    } catch (err) {
      toast.error('Evraklar okunamadı', { description: getErrorMessage(err) })
      setOpen(false)
    } finally {
      setProgress(null)
    }
  }

  async function apply() {
    const patch: IdInfo = {}
    for (const c of changes ?? []) if (c.on) patch[c.key] = c.found
    setSaving(true)
    try {
      if (Object.keys(patch).length) await updatePersonnel(person.id, patch)
      if (licenseCopy?.on) {
        // Dosya kopyalanır (aynı dosya paylaşılmaz — evrak silinince araçtaki fotoğraf gitmesin)
        const paths: string[] = []
        for (const [i, p] of licenseCopy.paths.entries()) {
          const blob = await downloadDocument(p)
          const pdf = isPdfPath(p)
          paths.push(await uploadPersonnelAttachment(person.id, new File([blob], `ehliyet-${i + 1}.${pdf ? 'pdf' : 'jpg'}`, { type: pdf ? 'application/pdf' : 'image/jpeg' })))
        }
        await savePersonnelDocument(undefined, {
          personnel_id: person.id,
          doc_type: 'ehliyet',
          title: null,
          document_date: null,
          valid_until: null,
          attachment_paths: paths,
          note: null,
        })
      }
      for (const f of typeFixes.filter((x) => x.on)) {
        const { id, created_by: _c, created_at: _a, updated_at: _u, ...rest } = f.doc
        await savePersonnelDocument(id, { ...rest, doc_type: f.to })
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['personnel'] }), qc.invalidateQueries({ queryKey: ['personnel_documents'] })])
      toast.success('Bilgiler belgelere göre düzenlendi')
      setOpen(false)
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const count = (changes?.filter((c) => c.on).length ?? 0) + typeFixes.filter((f) => f.on).length + (licenseCopy?.on ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={(o) => !progress && !saving && setOpen(o)}>
      <Button
        size="sm"
        variant="outline"
        disabled={!sources.length}
        onClick={() => void scan()}
        title={sources.length ? 'Yüklü evrakları okuyup kimlik bilgilerini karta işle' : 'Önce kimlik, ehliyet gibi evrakları ekleyin'}
      >
        <ScanText /> Belgelerden Doldur
      </Button>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Belgelerden Bilgi Doldur</DialogTitle>
          <DialogDescription>
            {person.full_name} için yüklü evraklar okundu. Boş ya da belgeyle uyuşmayan bilgiler aşağıda; işaretli olanlar karta yazılır.
          </DialogDescription>
        </DialogHeader>
        {progress || !changes ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> {progress ?? 'Hazırlanıyor…'}
          </div>
        ) : !changes.length && !typeFixes.length && !licenseCopy ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Kart bilgileri belgelerle uyuşuyor, değiştirilecek bir şey yok.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border text-sm">
            <table className="w-full">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 p-2" />
                  <th className="p-2 text-left font-medium">Bilgi</th>
                  <th className="p-2 text-left font-medium">Kartta</th>
                  <th className="p-2 text-left font-medium">Belgede</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={c.key} className="border-t align-top">
                    <td className="p-2">
                      <Checkbox
                        checked={c.on}
                        onCheckedChange={(v) => setChanges((cs) => cs!.map((x, j) => (j === i ? { ...x, on: !!v } : x)))}
                        aria-label={ID_FIELD_LABELS[c.key]}
                      />
                    </td>
                    <td className="p-2 font-medium">{ID_FIELD_LABELS[c.key]}</td>
                    <td className={`p-2 ${c.current ? 'text-muted-foreground line-through decoration-red-500/60' : 'text-muted-foreground'}`}>
                      {show(c.key, c.current) || 'boş'}
                    </td>
                    <td className="p-2">
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">{show(c.key, c.found)}</span>
                      {c.source && <span className="block text-xs text-muted-foreground">{c.source}</span>}
                    </td>
                  </tr>
                ))}
                {typeFixes.map((f, i) => (
                  <tr key={f.doc.id} className="border-t align-top">
                    <td className="p-2">
                      <Checkbox
                        checked={f.on}
                        onCheckedChange={(v) => setTypeFixes((fs) => fs.map((x, j) => (j === i ? { ...x, on: !!v } : x)))}
                        aria-label="Evrak türünü düzelt"
                      />
                    </td>
                    <td className="p-2 font-medium">Evrak türü</td>
                    <td className="p-2 text-muted-foreground line-through decoration-red-500/60">{docTypeLabel(f.doc.doc_type)}</td>
                    <td className="p-2">
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">{docTypeLabel(f.to)}</span>
                      <span className="block text-xs text-muted-foreground">Dosyanın içeriği bu evrak</span>
                    </td>
                  </tr>
                ))}
                {licenseCopy && (
                  <tr className="border-t align-top">
                    <td className="p-2">
                      <Checkbox checked={licenseCopy.on} onCheckedChange={(v) => setLicenseCopy((l) => l && { ...l, on: !!v })} aria-label="Ehliyeti evraklara ekle" />
                    </td>
                    <td className="p-2 font-medium">Ehliyet evrakı</td>
                    <td className="p-2 text-muted-foreground">yok</td>
                    <td className="p-2">
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">Araçtaki ehliyet eklenecek</span>
                      <span className="block text-xs text-muted-foreground">{licenseCopy.plate}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!progress && failed.length > 0 && (
          <p className="text-xs text-amber-600">Okunamayan evrak: {[...new Set(failed)].join(', ')} — tekrar deneyin ya da evrakı yeniden yükleyin.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={!!progress || saving}>
            Kapat
          </Button>
          {!!changes?.length || typeFixes.length || licenseCopy ? (
            <Button onClick={() => void apply()} disabled={saving || !count}>
              {saving && <Loader2 className="animate-spin" />} {count} Değişikliği Kaydet
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
