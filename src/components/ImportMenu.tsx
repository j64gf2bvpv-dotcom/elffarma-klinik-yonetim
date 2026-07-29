import * as React from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { readExcelFile, type ImportSummary } from '@/lib/importData'

interface ImportMenuProps {
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportSummary>
  label?: string
}

export function ImportMenu({ onImport, label = 'İçe Aktar (Excel)' }: ImportMenuProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [importing, setImporting] = React.useState(false)

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
      if (summary.added > 0) {
        toast.success(
          `${summary.added} kayıt eklendi${summary.skipped > 0 ? `, ${summary.skipped} kayıt zaten vardı (atlandı)` : ''}`,
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
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="animate-spin" /> : <Upload />}
        {label}
      </Button>
    </>
  )
}
