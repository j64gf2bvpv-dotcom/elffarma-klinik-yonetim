import { FileSpreadsheet, FileText, Download, FileType, Printer, Mail, ImageDown } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildPlainTextReport, exportToExcel, exportToPdf, exportToWord, printRows, type ExportColumn } from '@/lib/exportData'
import { WEBMAIL_URL } from '@/lib/companyInfo'

interface ExportMenuProps<T> {
  title: string
  filename: string
  columns: ExportColumn<T>[]
  rows: T[]
  /** Tetikleyici butonun metni — varsayılan "Dışa Aktar". Aynı sayfada birden fazla ExportMenu varsa ayırt etmek için kullanılır. */
  triggerLabel?: string
  /** Verilirse menüye "Görsel (PNG)" seçeneği eklenir — satır/sütun verisi
   * değil, bu ref'in gösterdiği DOM alanının kendisi (kartlar, avatarlar,
   * renkler dahil olduğu gibi) html2canvas ile görüntüye dönüştürülüp
   * indirilir. Haftalık Satış Temsilcisi Raporu gibi tablo olarak ifade
   * edilemeyen, kart tabanlı görünümler için (kullanıcı isteği, 2026-08-24). */
  imageTarget?: React.RefObject<HTMLElement | null>
}

export function ExportMenu<T>({ title, filename, columns, rows, triggerLabel = 'Dışa Aktar', imageTarget }: ExportMenuProps<T>) {
  function handleExcel() {
    if (rows.length === 0) {
      toast.error('Dışa aktarılacak veri yok')
      return
    }
    exportToExcel(filename, columns, rows)
  }

  async function handleWord() {
    if (rows.length === 0) {
      toast.error('Dışa aktarılacak veri yok')
      return
    }
    await exportToWord(title, filename, columns, rows)
  }

  function handlePdf() {
    if (rows.length === 0) {
      toast.error('Dışa aktarılacak veri yok')
      return
    }
    exportToPdf(title, filename, columns, rows)
  }

  function handlePrint() {
    if (rows.length === 0) {
      toast.error('Yazdırılacak veri yok')
      return
    }
    printRows(title, columns, rows)
  }

  async function handlePng() {
    const node = imageTarget?.current
    if (!node) return
    const { default: html2canvas } = await import('html2canvas-pro')
    const canvas = await html2canvas(node, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      useCORS: true,
    })
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  function handleMail() {
    if (rows.length === 0) {
      toast.error('Gönderilecek veri yok')
      return
    }
    exportToPdf(title, filename, columns, rows)
    const body = buildPlainTextReport(title, columns, rows)
    // Roundcube tarzı "yeni ileti" derin bağlantısı deneniyor (cPanel/genel hosting webmail'lerinde en yaygın
    // yazılım budur) — webmail farklı bir yazılımsa alanlar boş gelebilir, o durumda gerçek "Yeni İleti" adresini
    // isteyip bu parametreleri güncellemek gerekir.
    const composeUrl = `${WEBMAIL_URL}?_task=mail&_action=compose&_subject=${encodeURIComponent(title)}&_body=${encodeURIComponent(body)}`
    window.open(composeUrl, '_blank', 'noopener,noreferrer')
    toast.info('Rapor PDF olarak indirildi', {
      description: 'Webmail yeni ileti penceresi rapor metniyle açılmaya çalışıldı; tam liste için indirilen PDF\'i de ekleyin.',
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download /> {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleExcel}>
          <FileSpreadsheet className="text-success" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleWord}>
          <FileText className="text-primary" /> Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handlePdf}>
          <FileType className="text-destructive" /> PDF (.pdf)
        </DropdownMenuItem>
        {imageTarget && (
          <DropdownMenuItem onSelect={handlePng}>
            <ImageDown className="text-primary" /> Görsel (PNG)
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handlePrint}>
          <Printer className="text-muted-foreground" /> Yazdır
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleMail}>
          <Mail className="text-primary" /> E-posta ile Gönder (Webmail)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
