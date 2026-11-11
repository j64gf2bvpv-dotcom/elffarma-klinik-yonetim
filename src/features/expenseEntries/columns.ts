import type { ExportColumn } from '@/lib/exportData'
import type { ExpenseEntry } from '@/types/database'
import type { ExpenseEntrySection } from './api'

export const entryDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Bölümün Excel/Word/PDF sütunları — faturalılarda abone + sözleşme no da var */
export function entryExportColumns(section: ExpenseEntrySection): ExportColumn<ExpenseEntry>[] {
  return [
    { header: section.isBill ? 'Ödeme Tarihi' : 'Tarih', value: (e) => entryDate(e.entry_date) },
    ...(section.isBill
      ? [
          { header: 'Abone No', value: (e: ExpenseEntry) => e.subscriber_number ?? '' },
          { header: 'Sözleşme No', value: (e: ExpenseEntry) => e.contract_number ?? '' },
        ]
      : []),
    { header: section.isBill ? 'Ödenen Tutar' : 'Tutar', value: (e) => Number(e.amount) },
    { header: section.isBill ? 'Not' : 'Açıklama', value: (e) => e.description ?? '' },
    { header: `${section.docLabel} Görüntüsü`, value: (e) => (e.attachment_paths.length ? `${e.attachment_paths.length} adet` : 'Yok') },
  ]
}

