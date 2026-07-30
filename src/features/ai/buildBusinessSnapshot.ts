import { getExpiryStatus } from '@/lib/expiry'
import { calculateCommissions } from '@/features/commissions/calculateCommissions'
import { calculateSampleConversion } from '@/features/samples/calculateSampleConversion'
import { calculateReceivablesRisk } from '@/features/payments/calculateReceivablesRisk'
import type { InstallmentWithPlan } from '@/features/payments/api'
import type { SaleWithRelations } from '@/features/sales/api'
import type { PaymentWithCustomer } from '@/features/payments/api'
import type { SampleRequestWithRelations } from '@/features/samples/api'
import type { CrmOpportunityWithRelations } from '@/features/crm/api'
import type {
  Congress,
  CommissionRule,
  Customer,
  Product,
  ProductLot,
  SalesRep,
} from '@/types/database'

export interface BusinessSnapshotInput {
  products: Product[]
  productLots: ProductLot[]
  sales: SaleWithRelations[]
  monthPayments: PaymentWithCustomer[]
  customers: Customer[]
  salesReps: SalesRep[]
  commissionRules: CommissionRule[]
  sampleRequests: SampleRequestWithRelations[]
  installments: InstallmentWithPlan[]
  opportunities: CrmOpportunityWithRelations[]
  congresses: Congress[]
}

/**
 * Uygulamanın çeşitli modüllerinden (stok, satış, prim, numune, tahsilat riski,
 * CRM, kongre) zaten hesaplanmış canlı verileri tek, kompakt bir JSON özette
 * toplar. AIService'e gönderilen her istek bu özeti bağlam olarak alır —
 * böylece AI kendi sayı uydurmak yerine gerçek, hesaplanmış verilerle konuşur.
 */
export function buildBusinessSnapshot(input: BusinessSnapshotInput) {
  const criticalStock = input.products
    .filter((p) => p.current_quantity <= p.critical_stock_threshold)
    .map((p) => ({ name: p.name, quantity: p.current_quantity, threshold: p.critical_stock_threshold }))

  const expiringLots = input.productLots
    .filter((lot) => lot.quantity > 0)
    .filter((lot) => {
      const status = getExpiryStatus(lot.expiry_date, 90)
      return status === 'expired' || status === 'soon'
    })
    .map((lot) => {
      const product = input.products.find((p) => p.id === lot.product_id)
      return { product: product?.name ?? lot.product_id, lot_no: lot.lot_no, expiry_date: lot.expiry_date, quantity: lot.quantity }
    })

  const monthRevenue = input.sales.reduce(
    (sum, s) => sum + (s.type === 'return' ? -1 : 1) * Number(s.quantity) * Number(s.unit_price),
    0,
  )
  const monthCollected = input.monthPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const commissionResults = calculateCommissions(
    input.commissionRules,
    input.sales,
    input.monthPayments,
    input.products,
    input.customers,
    input.salesReps,
    [],
  )
  const totalCommission = commissionResults.reduce((sum, r) => sum + r.netTotal, 0)

  const sampleConversion = calculateSampleConversion(input.sampleRequests, input.sales)

  const receivablesRisk = calculateReceivablesRisk(input.installments)

  const openOpportunities = input.opportunities.filter((o) => o.stage !== 'kazanildi' && o.stage !== 'kaybedildi')
  const opportunityPipelineValue = openOpportunities.reduce((sum, o) => sum + Number(o.amount ?? 0), 0)

  const upcomingCongresses = input.congresses.filter(
    (c) => c.start_date && new Date(c.start_date) >= new Date(),
  )

  return {
    tarih: new Date().toISOString().slice(0, 10),
    stok: {
      kritik_urun_sayisi: criticalStock.length,
      kritik_urunler: criticalStock.slice(0, 15),
      skt_riskli_lot_sayisi: expiringLots.length,
      skt_riskli_lotlar: expiringLots.slice(0, 15),
    },
    satis_tahsilat: {
      bu_ay_satis_tutari: Math.round(monthRevenue),
      bu_ay_tahsilat_tutari: Math.round(monthCollected),
    },
    prim: {
      bu_ay_toplam_prim: Math.round(totalCommission),
      temsilci_bazinda: commissionResults.slice(0, 10).map((r) => ({ temsilci: r.salesRepName, net_prim: Math.round(r.netTotal) })),
    },
    numune: {
      toplam_numune_urunu: sampleConversion.totalItems,
      satisa_donen: sampleConversion.convertedItems,
      donusum_orani_yuzde: Math.round(sampleConversion.percent * 10) / 10,
    },
    tahsilat_riski: {
      riskli_doktor_sayisi: receivablesRisk.length,
      riskli_doktorlar: receivablesRisk.slice(0, 15).map((r) => ({
        doktor: r.customerName,
        geciken_tutar: Math.round(r.overdueAmount),
        en_uzun_gecikme_gun: r.maxDaysOverdue,
      })),
    },
    crm: {
      acik_firsat_sayisi: openOpportunities.length,
      acik_firsat_toplam_deger: Math.round(opportunityPipelineValue),
    },
    yaklasan_kongreler: upcomingCongresses.slice(0, 10).map((c) => ({ isim: c.name, tarih: c.start_date })),
  }
}

export type BusinessSnapshot = ReturnType<typeof buildBusinessSnapshot>
