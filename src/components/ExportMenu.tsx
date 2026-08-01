import { FileSpreadsheet, FileText, Download, FileType, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportToExcel, exportToPdf, exportToWord, printRows, type ExportColumn } from '@/lib/exportData'

interface ExportMenuProps<T> {
  title: string
  filename: string
  columns: ExportColumn<T>[]
  rows: T[]
}

export function ExportMenu<T>({ title, filename, columns, rows }: ExportMenuProps<T>) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download /> Dışa Aktar
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handlePrint}>
          <Printer className="text-muted-foreground" /> Yazdır
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
