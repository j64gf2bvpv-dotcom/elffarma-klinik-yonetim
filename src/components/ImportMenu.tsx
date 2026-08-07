import * as React from 'react'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { readExcelFile, downloadExcelTemplate, type ImportSummary } from '@/lib/importData'

interface ImportMenuProps {
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportSummary>
  templateFilename: string
  templateHeaders: string[]
  templateSampleRows: Record<string, string | number>[]
  label?: string
}

export function ImportMenu({
  onImport,
  templateFilename,
  templateHeaders,
  templateSampleRows,
  label = 'İçe Aktar',
}: ImportMenuProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [importing, setImporting] = React.useState(false)

  function handleDownloadTemplate() {
    downloadExcelTemplate(templateFilename, templateHeaders, templateSampleRows)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    try {
      const rows = await readExcelFile(file)
      if (rows.length === 0) {
        toast.error('Dosyada veri bulunamadı')
        return
      }
      const summary = await onImport(rows)
      const updatedText = summary.updated ? `, ${summary.updated} güncellendi` : ''
      if (summary.added > 0 || summary.updated) {
        toast.success(
          `${summary.added} kayıt eklendi${updatedText}${summary.skipped > 0 ? `, ${summary.skipped} kayıt zaten vardı (atlandı)` : ''}`,
        )
      } else if (summary.skipped > 0) {
        toast.info(`Yeni kayıt eklenmedi — ${summary.skipped} kayıt zaten mevcuttu`)
      } else if (summary.errors.length === 0) {
        toast.error('Hiçbir kayıt eklenemedi')
      }
      if (summary.errors.length > 0) {
        toast.error(`${summary.errors.length} satırda hata`, {
          description: summary.errors.slice(0, 3).join(' • '),
        })
      }
    } catch (err) {
      toast.error('Dosya okunamadı', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={importing}>
            {importing ? <Loader2 className="animate-spin" /> : <Upload />}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleDownloadTemplate}>
            <FileSpreadsheet className="text-success" /> Örnek Şablonu İndir (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
            <Upload /> Excel Dosyası Seç...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
