import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { readExcelSheetAsMatrix, nearestLeftValue, parseFlexibleDate, type ImportSummary } from '@/lib/importData'
import { useProducts } from './hooks'
import { createSale } from '@/features/sales/api'
import { recordStockMovement } from './api'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'

function findHeaderRowIndex(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 6); i++) {
    const row = matrix[i] ?? []
    if (row.some((cell) => /kalan\s*stok/i.test(String(cell)))) return i
  }
  return -1
}

/**
 * Günlük stok hareket tablosunu (ürün adı × ürünün önceki stoğu × doktor/temsilci
 * bazlı çıkış-iade sütunları × kalan stok) okuyup her hücreyi gerçek bir satış/iade
 * kaydına veya (doktora bağlı değilse) düz bir stok hareketine dönüştürür.
 */
export function DailyMovementImportButton() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [importing, setImporting] = React.useState(false)
  const queryClient = useQueryClient()
  const { data: products = [] } = useProducts('')
  const { data: doctors = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()

  async function processFile(file: File): Promise<ImportSummary> {
    const matrix = await readExcelSheetAsMatrix(file)
    const summary: ImportSummary = { added: 0, skipped: 0, errors: [] }

    const headerIdx = findHeaderRowIndex(matrix)
    if (headerIdx === -1) {
      summary.errors.push('"KALAN STOKLAR" başlıklı bir sütun bulunamadı — dosya beklenen formatta değil')
      return summary
    }
    const dateRow = matrix[headerIdx - 1] ?? []
    const headerRow = (matrix[headerIdx] ?? []).map((c) => String(c).trim())

    const productCol = headerRow.findIndex((h) => /ürün/i.test(h)) === -1 ? 0 : headerRow.findIndex((h) => /ürün/i.test(h))
    const kalanCol = headerRow.findIndex((h) => /kalan\s*stok/i.test(h))
    const stoklarCol = headerRow.findIndex((h, idx) => idx !== kalanCol && /stok/i.test(h))
    const personCols = headerRow
      .map((h, idx) => ({ name: h, idx }))
      .filter(({ name, idx }) => name && idx !== productCol && idx !== kalanCol && idx !== stoklarCol)

    if (personCols.length === 0) {
      summary.errors.push('Doktor/temsilci sütunu bulunamadı')
      return summary
    }

    for (let r = headerIdx + 1; r < matrix.length; r++) {
      const row = matrix[r] ?? []
      const productName = String(row[productCol] ?? '').trim()
      if (!productName) continue

      const product = products.find((p) => p.name.toLocaleLowerCase('tr') === productName.toLocaleLowerCase('tr'))
      if (!product) {
        summary.errors.push(`${productName}: Stok'ta bu isimde ürün bulunamadı`)
        continue
      }

      let movedForProduct = 0

      for (const { name: personName, idx } of personCols) {
        const raw = row[idx]
        const qty = Number(raw)
        if (raw === '' || raw == null || Number.isNaN(qty) || qty === 0) continue

        const dateLabel = nearestLeftValue(dateRow, idx)
        const parsedDate = dateLabel ? parseFlexibleDate(dateLabel) : null
        const dateIso = (parsedDate ?? new Date()).toISOString().slice(0, 10)

        const doctor = doctors.find((d) => d.full_name.toLocaleLowerCase('tr') === personName.toLocaleLowerCase('tr'))
        const rep = salesReps.find((s) => s.name.toLocaleLowerCase('tr') === personName.toLocaleLowerCase('tr'))

        try {
          if (doctor) {
            const type = qty > 0 ? 'sale' : 'return'
            await createSale({
              type,
              customer_id: doctor.id,
              product_id: product.id,
              product_name: product.name,
              quantity: Math.abs(qty),
              unit_price: Number(product.unit_price ?? 0),
              sale_date: dateIso,
              note: 'Günlük stok hareket tablosu içe aktarma',
            })
            await recordStockMovement({
              product_id: product.id,
              movement_type: type === 'sale' ? 'out' : 'in',
              quantity: Math.abs(qty),
              reason: type === 'sale' ? 'Satış' : 'İade',
              customer_id: doctor.id,
              note: `${doctor.full_name} — Excel içe aktarma (${dateLabel || dateIso})`,
            })
          } else if (rep) {
            const movementType = qty > 0 ? 'out' : 'in'
            await recordStockMovement({
              product_id: product.id,
              movement_type: movementType,
              quantity: Math.abs(qty),
              reason: 'Satış temsilcisine teslim',
              note: `${rep.name} — Excel içe aktarma (${dateLabel || dateIso})`,
            })
          } else {
            summary.errors.push(`${productName} / ${personName}: doktor ya da satış temsilcisi olarak bulunamadı`)
            continue
          }
          movedForProduct += qty
          summary.added++
        } catch (err) {
          summary.errors.push(
            `${productName} / ${personName}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`,
          )
        }
      }

      if (kalanCol !== -1 && movedForProduct !== 0) {
        const kalanValue = Number(row[kalanCol])
        const expected = product.current_quantity - movedForProduct
        if (!Number.isNaN(kalanValue) && kalanValue !== expected) {
          summary.errors.push(
            `${productName}: dosyadaki "Kalan Stoklar" (${kalanValue}) ile hesaplanan (${expected}) uyuşmuyor — kontrol edin`,
          )
        }
      }
    }

    if (summary.added > 0) {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
    }

    return summary
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    try {
      const summary = await processFile(file)
      if (summary.added > 0) {
        toast.success(`${summary.added} stok hareketi işlendi`)
      } else if (summary.errors.length === 0) {
        toast.error('İşlenecek hareket bulunamadı')
      }
      if (summary.errors.length > 0) {
        toast.error(`${summary.errors.length} satırda sorun`, {
          description: summary.errors.slice(0, 4).join(' • '),
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
        Günlük Hareket Yükle (Excel)
      </Button>
    </>
  )
}
