import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { readExcelSheetAsMatrix, nearestLeftValue, parseFlexibleDate, type ImportSummary } from '@/lib/importData'
import { useProducts } from './hooks'
import { createSale } from '@/features/sales/api'
import { createProduct, recordStockMovement } from './api'
import type { Product } from '@/types/database'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'

function findRowIndex(matrix: unknown[][], pattern: RegExp): number {
  for (let i = 0; i < Math.min(matrix.length, 6); i++) {
    const row = matrix[i] ?? []
    if (row.some((cell) => pattern.test(String(cell).trim()))) return i
  }
  return -1
}

/**
 * Kullanıcının gerçek şablonu iki satırlı bir başlık kullanıyor: "ÜRÜN ADI" ve
 * "kalan stoklar" iki satırı kapsayan (dikey birleştirilmiş) hücreler olduğu
 * için Excel'den okununca bu metinler ÜST satırda, tek başına duran "STOKLAR"
 * ve kişi adları ise ALT satırda kalır. Bu yüzden "kalan stok" metnini değil,
 * ayırt edici olan tek başına "STOKLAR" hücresini arıyoruz — kişi adlarının
 * bulunduğu satırı (ve dolayısıyla bir üstündeki ürün/tarih/kalan-stok
 * satırını) bu şekilde doğru tespit ediyoruz.
 */
function findHeaderRows(matrix: unknown[][]): { labelsRow: unknown[]; namesRowIdx: number; namesRow: string[] } | null {
  const stoklarRowIdx = findRowIndex(matrix, /^stoklar$/i)
  if (stoklarRowIdx !== -1 && stoklarRowIdx > 0) {
    return {
      labelsRow: matrix[stoklarRowIdx - 1] ?? [],
      namesRowIdx: stoklarRowIdx,
      namesRow: (matrix[stoklarRowIdx] ?? []).map((c) => String(c).trim()),
    }
  }
  // Eski/tek satırlı başlık formatı: "kalan stok" ve kişi adları AYNI satırda.
  const kalanRowIdx = findRowIndex(matrix, /kalan\s*stok/i)
  if (kalanRowIdx === -1) return null
  return {
    labelsRow: matrix[kalanRowIdx] ?? [],
    namesRowIdx: kalanRowIdx,
    namesRow: (matrix[kalanRowIdx] ?? []).map((c) => String(c).trim()),
  }
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

    const headerInfo = findHeaderRows(matrix)
    if (!headerInfo) {
      summary.errors.push('"KALAN STOKLAR" başlıklı bir sütun bulunamadı — dosya beklenen formatta değil')
      return summary
    }
    const { labelsRow, namesRowIdx, namesRow } = headerInfo
    const dateRow = labelsRow

    const labelsRowStr = labelsRow.map((c) => String(c))
    const productCol = labelsRowStr.findIndex((h) => /ürün/i.test(h)) === -1 ? 0 : labelsRowStr.findIndex((h) => /ürün/i.test(h))
    const kalanCol = labelsRowStr.findIndex((h) => /kalan\s*stok/i.test(h))
    const stoklarCol =
      namesRow.findIndex((h) => /^stoklar$/i.test(h)) !== -1
        ? namesRow.findIndex((h) => /^stoklar$/i.test(h))
        : namesRow.findIndex((h, idx) => idx !== kalanCol && /stok/i.test(h))
    // Doktor/temsilci sütunu yoksa (sadece ÜRÜN ADI + STOKLAR gibi sade bir
    // liste yüklendiyse) hata verip durmuyoruz — o durumda sadece aşağıdaki
    // STOKLAR eşitleme adımı çalışır, kişi bazlı hareket işlenmez.
    const personCols = namesRow
      .map((h, idx) => ({ name: h, idx }))
      .filter(({ name, idx }) => name && idx !== productCol && idx !== kalanCol && idx !== stoklarCol)

    // Genel stokta henüz olmayan bir ürün adı yüzünden o satırın verisi ATLANMAZ
    // — ürün otomatik olarak (varsayılan birim/kritik eşikle) oluşturulup hareket
    // yine de işlenir; sonradan Stok sayfasından detayları düzenlenebilir.
    const productsList: Product[] = [...products]

    for (let r = namesRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r] ?? []
      const productName = String(row[productCol] ?? '').trim()
      if (!productName) continue

      let product = productsList.find((p) => p.name.toLocaleLowerCase('tr') === productName.toLocaleLowerCase('tr'))
      if (!product) {
        try {
          product = await createProduct({ name: productName, unit: 'Paket', critical_stock_threshold: 5 })
          productsList.push(product)
        } catch (err) {
          summary.errors.push(
            `${productName}: ürün otomatik oluşturulamadı — ${err instanceof Error ? err.message : 'bilinmeyen hata'}`,
          )
          continue
        }
      }

      // Excel'deki "STOKLAR" sütunu (o ürünün o günkü başlangıç stoğu) sistemdeki
      // current_quantity ile uyuşmuyorsa (özellikle az önce otomatik oluşturulan,
      // dolayısıyla 0 stoklu yeni ürünlerde), fark bir düzeltme hareketiyle
      // eşitlenir — kullanıcı "girdiğim liste stoğa yazılmıyor" derken tam olarak
      // bunu kastediyor: dosyadaki miktarların gerçekten sisteme işlenmesi.
      if (stoklarCol !== -1) {
        const stokRaw = row[stoklarCol]
        const stokValue = Number(stokRaw)
        if (stokRaw !== '' && stokRaw != null && !Number.isNaN(stokValue) && stokValue !== product.current_quantity) {
          const diff = stokValue - product.current_quantity
          try {
            await recordStockMovement({
              product_id: product.id,
              movement_type: diff > 0 ? 'in' : 'out',
              quantity: Math.abs(diff),
              reason: 'Excel içe aktarma — başlangıç stok eşitleme',
              note: `Excel'deki STOKLAR değeriyle (${stokValue}) eşitlendi`,
            })
            product.current_quantity = stokValue
            summary.added++
          } catch (err) {
            summary.errors.push(
              `${productName}: başlangıç stok eşitlemesi başarısız — ${err instanceof Error ? err.message : 'bilinmeyen hata'}`,
            )
          }
        }
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
          } else {
            // Doktor değilse (temsilci eşleşse de eşleşmese de) sadece düz bir
            // stok hareketi kaydedilir — sütun başlığı sistemde tanımlı bir
            // doktor/temsilci adıyla eşleşmese bile stok miktarı yine de
            // düşülür/eklenir, satır hata verip atlanmaz (stok doğruluğu önce gelir).
            const movementType = qty > 0 ? 'out' : 'in'
            await recordStockMovement({
              product_id: product.id,
              movement_type: movementType,
              quantity: Math.abs(qty),
              reason: rep ? 'Satış temsilcisine teslim' : 'Excel içe aktarma',
              note: `${rep?.name ?? personName} — Excel içe aktarma (${dateLabel || dateIso})`,
            })
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
