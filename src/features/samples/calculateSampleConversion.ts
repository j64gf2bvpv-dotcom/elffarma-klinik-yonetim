import type { SampleRequestWithRelations } from './api'
import type { SaleWithRelations } from '@/features/sales/api'

export interface SampleConversionRow {
  sampleRequestId: string
  customerId: string
  customerName: string
  productId: string
  productName: string
  quantity: number
  converted: boolean
}

export interface SampleConversionSummary {
  rows: SampleConversionRow[]
  totalItems: number
  convertedItems: number
  percent: number
}

/**
 * Bir numune, aynı doktora aynı ürünün numune tarihinden sonraki bir satışı varsa
 * "satışa döndü" kabul edilir. Ayrı bir "converted" alanı tutulmaz — sales tablosu
 * güncellendikçe bu her seferinde yeniden (canlı) hesaplanır.
 */
export function calculateSampleConversion(
  requests: SampleRequestWithRelations[],
  sales: SaleWithRelations[],
): SampleConversionSummary {
  const rows: SampleConversionRow[] = []

  for (const request of requests) {
    for (const item of request.sample_items) {
      const converted = sales.some(
        (s) =>
          s.type === 'sale' &&
          s.customer_id === request.customer_id &&
          s.product_id === item.product_id &&
          s.sale_date >= request.request_date,
      )
      rows.push({
        sampleRequestId: request.id,
        customerId: request.customer_id,
        customerName: request.customers?.full_name ?? '',
        productId: item.product_id,
        productName: item.products?.name ?? '',
        quantity: item.quantity,
        converted,
      })
    }
  }

  const totalItems = rows.length
  const convertedItems = rows.filter((r) => r.converted).length
  return {
    rows,
    totalItems,
    convertedItems,
    percent: totalItems > 0 ? (convertedItems / totalItems) * 100 : 0,
  }
}
