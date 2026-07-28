import * as React from 'react'
import readXlsxFile from 'read-excel-file'
import { Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface ImportField {
  key: string
  label: string
  required?: boolean
  /** Excel başlığı bu isimlerden biriyle eşleşirse alan otomatik seçilir (küçük/büyük harf duyarsız). */
  aliases: string[]
}

const NO_COLUMN = '__none__'

function normalizeHeader(h: string) {
  return h.trim().toLocaleLowerCase('tr-TR')
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

interface ExcelImportDialogProps {
  title: string
  /** İçe aktarılacak alanların listesi — dosyadaki sütunlar bunlarla eşleştirilir. */
  fields: ImportField[]
  /** Eşleşen sütun değerleriyle oluşturulmuş bir satırı kaydeder; hata durumunda mesajlı bir Error fırlatmalıdır. */
  importRow: (row: Record<string, string>) => Promise<void>
  /** En az bir satır başarıyla aktarıldığında çağrılır (ör. ilgili sorguyu yeniden yükleme). */
  onDone: () => void
  triggerLabel?: string
}

export function ExcelImportDialog({ title, fields, importRow, onDone, triggerLabel = "Excel'den İçe Aktar" }: ExcelImportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<'upload' | 'map' | 'result'>('upload')
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<Record<string, string>[]>([])
  const [mapping, setMapping] = React.useState<Record<string, string>>({})
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<{ success: number; errors: string[] } | null>(null)

  function reset() {
    setStep('upload')
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const sheetRows = await readXlsxFile(file)
      if (sheetRows.length < 2) {
        toast.error('Dosyada veri satırı bulunamadı', { description: 'İlk satır sütun başlığı, sonrası veri olmalıdır.' })
        return
      }
      const detectedHeaders = sheetRows[0].map((h) => cellToString(h))
      const dataRows = sheetRows.slice(1).map((r) => {
        const obj: Record<string, string> = {}
        detectedHeaders.forEach((h, i) => {
          obj[h] = cellToString(r[i])
        })
        return obj
      })

      const autoMapping: Record<string, string> = {}
      for (const field of fields) {
        const match = detectedHeaders.find((h) => {
          const nh = normalizeHeader(h)
          return nh === normalizeHeader(field.label) || field.aliases.some((a) => normalizeHeader(a) === nh)
        })
        if (match) autoMapping[field.key] = match
      }

      setHeaders(detectedHeaders)
      setRows(dataRows)
      setMapping(autoMapping)
      setStep('map')
    } catch {
      toast.error('Dosya okunamadı', { description: 'Geçerli bir .xlsx dosyası seçtiğinizden emin olun.' })
    }
  }

  async function handleImport() {
    const missingRequired = fields.filter((f) => f.required && !mapping[f.key])
    if (missingRequired.length > 0) {
      toast.error('Zorunlu alan eşlenmedi', { description: missingRequired.map((f) => f.label).join(', ') })
      return
    }
    setImporting(true)
    const errors: string[] = []
    let success = 0
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      const mappedRow: Record<string, string> = {}
      for (const field of fields) {
        const col = mapping[field.key]
        mappedRow[field.key] = col ? (raw[col] ?? '') : ''
      }
      try {
        await importRow(mappedRow)
        success++
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
        errors.push(`Satır ${i + 2}: ${message}`)
      }
    }
    setImporting(false)
    setResult({ success, errors })
    setStep('result')
    if (success > 0) onDone()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Excel (.xlsx) dosyası seçin. İlk satır sütun başlığı olmalıdır.'}
            {step === 'map' && `${rows.length} satır bulundu. Sütunları alanlarla eşleştirin.`}
            {step === 'result' && 'İçe aktarma tamamlandı.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="border-input file:bg-primary file:text-primary-foreground block w-full rounded-lg border p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
        )}

        {step === 'map' && (
          <div className="grid gap-4">
            <div className="grid max-h-72 gap-3 overflow-y-auto pr-1">
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-3">
                  <span className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </span>
                  <Select
                    value={mapping[field.key] ?? NO_COLUMN}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field.key]: v === NO_COLUMN ? '' : v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COLUMN}>Yok</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 3).map((r, i) => (
                    <TableRow key={i}>
                      {headers.map((h) => (
                        <TableCell key={h} className="max-w-[140px] truncate text-xs">
                          {r[h]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground text-xs">Toplam {rows.length} satır bulundu (ilk 3 satır önizleniyor).</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="text-success size-4" />
              {result.success} kayıt başarıyla içe aktarıldı.
            </div>
            {result.errors.length > 0 && (
              <div className="grid gap-1">
                <div className="text-destructive flex items-center gap-2 text-sm">
                  <AlertTriangle className="size-4" />
                  {result.errors.length} satır aktarılamadı:
                </div>
                <div className="text-muted-foreground max-h-40 overflow-y-auto rounded-lg border p-2 text-xs">
                  {result.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={reset}>
                Geri
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Loader2 className="animate-spin" />}
                {rows.length} Satırı İçe Aktar
              </Button>
            </>
          )}
          {step === 'result' && <Button onClick={() => setOpen(false)}>Kapat</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
