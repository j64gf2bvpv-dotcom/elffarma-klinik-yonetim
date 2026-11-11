import * as React from 'react'
import { Pencil, Trash2, FileImage, FileText, FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getErrorMessage } from '@/lib/utils'
import type { ExpenseEntry } from '@/types/database'
import { SECTION_BY_KEY, fetchExpenseEntries, isPdfPath, openExpenseAttachment, type ExpenseEntrySection } from './api'
import { useDeleteExpenseEntry } from './hooks'
import { ExpenseEntryDialog } from './ExpenseEntryDialog'
import { exportAttachmentsPdf } from './exportAttachmentsPdf'
import { entryDate, entryExportColumns } from './columns'

const money = (n: number) => Number(n).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

/** Elektrik / Su / İnternet / Ofis / Mutfak / Ofis Yemek bölümlerinden biri (Giderler sayfası sekmesi). */
export function ExpenseEntriesPanel({
  section,
  entries,
  isLoading,
  from,
  to,
}: {
  section: ExpenseEntrySection
  /** Bu bölümün, sayfadaki tarih aralığına göre süzülmüş kayıtları (yeniden eskiye) */
  entries: ExpenseEntry[]
  isLoading: boolean
  from: string
  to: string
}) {
  const remove = useDeleteExpenseEntry()
  const { confirm, dialog } = useConfirmDialog()
  const total = entries.reduce((s, e) => s + Number(e.amount), 0)
  const withDocs = entries.filter((e) => e.attachment_paths.length).length
  const cols = section.isBill ? 7 : 5

  async function handleDelete(e: ExpenseEntry) {
    if (!(await confirm(`${entryDate(e.entry_date)} tarihli ${money(e.amount)} tutarındaki ${section.label} kaydı silinsin mi?`))) return
    remove.mutate(e)
  }

  async function openDoc(path: string, e: ExpenseEntry, i: number) {
    try {
      await openExpenseAttachment(path, `${section.label} ${section.docLabel} ${e.entry_date} ${i + 1}`)
    } catch (err) {
      toast.error(`${section.docLabel} açılamadı`, { description: getErrorMessage(err) })
    }
  }

  return (
    <div className="grid gap-3">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {entries.length} kayıt · Toplam <b className="text-foreground tabular-nums">{money(total)}</b>
          {entries.length > 0 && ` · ${withDocs} kayıtta ${section.docLabel.toLocaleLowerCase('tr-TR')} görüntüsü var`}
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportMenu<ExpenseEntry>
            title={`${section.label} Giderleri`}
            filename={`${section.key}-giderleri`}
            rows={[...entries].reverse()}
            columns={entryExportColumns(section)}
            triggerLabel="Excel / Dışa Aktar"
          />
          <BulkPdfDialog section={section} from={from} to={to} />
          <ExpenseEntryDialog section={section} lastEntry={entries[0]} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{section.isBill ? 'Ödeme Tarihi' : 'Tarih'}</TableHead>
                {section.isBill && <TableHead>Abone No</TableHead>}
                {section.isBill && <TableHead>Sözleşme No</TableHead>}
                <TableHead className="text-right">{section.isBill ? 'Ödenen Tutar' : 'Tutar'}</TableHead>
                <TableHead>{section.isBill ? 'Not' : 'Açıklama'}</TableHead>
                <TableHead>{section.docLabel}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
                    Bu tarih aralığında {section.label} kaydı yok
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{entryDate(e.entry_date)}</TableCell>
                  {section.isBill && <TableCell className="tabular-nums">{e.subscriber_number ?? '—'}</TableCell>}
                  {section.isBill && <TableCell className="tabular-nums">{e.contract_number ?? '—'}</TableCell>}
                  <TableCell className="text-right font-medium tabular-nums">{money(e.amount)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{e.description ?? '—'}</TableCell>
                  <TableCell>
                    {e.attachment_paths.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {e.attachment_paths.map((p, i) => (
                          <Button
                            key={p}
                            variant="outline"
                            size="icon"
                            className="size-7"
                            title={`${section.docLabel} ${i + 1} — açmak için tıklayın`}
                            onClick={() => void openDoc(p, e, i)}
                          >
                            {isPdfPath(p) ? <FileText className="size-3.5" /> : <FileImage className="size-3.5" />}
                          </Button>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <ExpenseEntryDialog
                      section={section}
                      entry={e}
                      trigger={
                        <Button variant="ghost" size="icon" title="Düzenle">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="icon" title="Sil" onClick={() => void handleDelete(e)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/** Tarih aralığı seçip fatura/fiş görüntülerini tarih sırasıyla tek PDF olarak indir. */
function BulkPdfDialog({ section, from, to }: { section: ExpenseEntrySection; from: string; to: string }) {
  const [open, setOpen] = React.useState(false)
  const [start, setStart] = React.useState(from)
  const [end, setEnd] = React.useState(to)
  const [allSections, setAllSections] = React.useState(false)
  const [progress, setProgress] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setStart(from)
    setEnd(to)
  }, [open, from, to])

  async function run() {
    setProgress('Kayıtlar alınıyor…')
    try {
      const all = await fetchExpenseEntries({ from: start || undefined, to: end || undefined })
      const rows = allSections ? all : all.filter((e) => e.category === section.key)
      const range = [start && entryDate(start), end && entryDate(end)].filter(Boolean).join(' – ') || 'Tüm tarihler'
      const name = allSections ? 'Tüm Fatura ve Fişler' : `${section.label} ${section.docLabel === 'Fiş' ? 'Fişleri' : 'Faturaları'}`
      const { pages, skipped } = await exportAttachmentsPdf(
        rows,
        `${name} (${range})`,
        `${allSections ? 'fatura-fis' : section.key}-goruntuleri${start ? `-${start}` : ''}${end ? `-${end}` : ''}`,
        (d, t) => setProgress(`Görüntüler hazırlanıyor… ${d}/${t}`),
      )
      if (pages === 0) {
        toast.warning('Bu tarih aralığında görüntüsü eklenmiş kayıt yok')
        return
      }
      toast.success(`${pages} sayfalık PDF indirildi`, {
        description: skipped ? `${skipped} kaydın görüntüsü olmadığı için PDF'e girmedi.` : undefined,
      })
      setOpen(false)
    } catch (err) {
      toast.error('PDF hazırlanamadı', { description: getErrorMessage(err) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !progress && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileDown /> {SECTION_BY_KEY[section.key].docLabel === 'Fiş' ? 'Fişleri' : 'Faturaları'} PDF Al
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Toplu PDF — {section.label}</DialogTitle>
          <DialogDescription>
            Seçtiğiniz tarihler arasındaki {section.docLabel.toLocaleLowerCase('tr-TR')} görüntüleri tarih sırasıyla tek PDF dosyasında
            toplanır; her sayfanın üstünde tarih ve tutar yazar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pdf-from">Başlangıç</Label>
            <Input id="pdf-from" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pdf-to">Bitiş</Label>
            <Input id="pdf-to" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={allSections} onCheckedChange={(c) => setAllSections(c === true)} />
            Tüm bölümler (Elektrik, Su, İnternet, Ofis, Mutfak, Ofis Yemek) tek PDF'te
          </label>
          <p className="col-span-2 text-xs text-muted-foreground">Tarih boş bırakılırsa tüm kayıtlar alınır.</p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => void run()} disabled={!!progress}>
            {progress ? <Loader2 className="animate-spin" /> : <FileDown />} {progress ?? 'PDF İndir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
