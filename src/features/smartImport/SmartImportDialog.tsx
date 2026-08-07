import * as React from 'react'
import { Sparkles, Upload, Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAIService } from '@/features/ai/useAIService'
import { extractFileContent } from './extractFileContent'
import { extractRowsWithAI } from './aiExtractRows'
import type { ImportSummary } from '@/lib/importData'

interface SmartImportDialogProps {
  /** Diyalog başlığı, ör. "Doktorları Akıllı İçe Aktar". */
  title: string
  /** AI'a gönderilecek talimatta hedef kaydın ne olduğunu anlatan kısa isim, ör. "doktor/cari kart". */
  targetLabel: string
  /** AI'ın çıktısında kullanması istenen ALAN ADLARI — mevcut ImportMenu şablonlarıyla aynı Türkçe başlıklar, böylece aynı onImport işleyicisi yeniden kullanılabiliyor. */
  fieldHeaders: string[]
  /** Her alanın ne anlama geldiğine dair kısa bir açıklama (AI'ın doğru eşleştirmesi için) — anahtar fieldHeaders ile aynı olmalı. */
  fieldHints?: Record<string, string>
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportSummary>
}

/**
 * Word/Excel/PDF/resim gibi SERBEST FORMATTAKİ bir dosyayı yükleyip, AI'a
 * hedef alan şemasına göre yapılandırılmış veriye çevirtip, kullanıcı bir
 * ÖNİZLEME'de onaylayana kadar hiçbir kayıt oluşturmayan genel amaçlı bir
 * "akıllı içe aktarma" diyaloğu. Mevcut sıkı-şablonlu ImportMenu'nün aksine
 * kolon başlıklarının tam eşleşmesini gerektirmez — AI serbest metinden/
 * görselden ilgili alanları çıkarır.
 */
export function SmartImportDialog({ title, targetLabel, fieldHeaders, fieldHints, onImport }: SmartImportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [parsing, setParsing] = React.useState(false)
  const [rows, setRows] = React.useState<Record<string, unknown>[] | null>(null)
  const [importing, setImporting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const aiService = useAIService()

  function reset() {
    setFileName(null)
    setRows(null)
    setParsing(false)
    setImporting(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileName(file.name)
    setRows(null)
    setParsing(true)
    try {
      const content = await extractFileContent(file)
      if (content.kind === 'table' && content.sheets.every((s) => s.rows.length === 0)) {
        toast.error('Dosyada satır bulunamadı')
        return
      }
      const parsedRows = await extractRowsWithAI(aiService, content, targetLabel, fieldHeaders, fieldHints)
      setRows(parsedRows)
    } catch (err) {
      toast.error('Dosya işlenemedi', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirm() {
    if (!rows) return
    setImporting(true)
    try {
      const summary = await onImport(rows)
      const updatedText = summary.updated ? `, ${summary.updated} güncellendi` : ''
      toast.success(`${summary.added} kayıt eklendi${updatedText}`, {
        description:
          summary.skipped > 0 || summary.errors.length > 0
            ? `${summary.skipped} atlandı, ${summary.errors.length} hata`
            : undefined,
      })
      setOpen(false)
      reset()
    } catch (err) {
      toast.error('İçe aktarılamadı', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Akıllı İçe Aktar
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Word, Excel, PDF veya resim yükleyin — yapay zeka içeriği ayrıştırıp size bir önizleme sunacak,
            onayladıktan sonra kayıtlar eklenecek.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.xlsx,.xls,.csv,.pdf,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

        {!rows && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="hover:border-primary/50 hover:bg-accent/40 flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors"
          >
            {parsing ? (
              <>
                <Loader2 className="text-muted-foreground size-8 animate-spin" />
                <p className="text-sm font-medium">{fileName} işleniyor...</p>
                <p className="text-muted-foreground text-xs">Yapay zeka belgeyi analiz ediyor, birkaç saniye sürebilir.</p>
              </>
            ) : (
              <>
                <Upload className="text-muted-foreground size-8" />
                <p className="text-sm font-medium">Dosya seçmek için tıklayın</p>
                <p className="text-muted-foreground text-xs">Word, Excel, PDF, resim veya .txt</p>
              </>
            )}
          </button>
        )}

        {rows && (
          <div className="grid gap-3">
            <p className="text-sm font-medium">
              {fileName} — {rows.length} kayıt bulundu, aşağıda önizleyip onaylayın
            </p>
            <div className="max-h-80 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fieldHeaders.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {fieldHeaders.map((h) => (
                        <TableCell key={h} className="max-w-40 truncate whitespace-nowrap">
                          {String(row[h] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={reset}>
              <X className="size-3.5" /> Farklı dosya seç
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!rows || importing}>
            {importing ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
            İçe Aktar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
