import { startOfMonth } from 'date-fns'
import { useProducts, useAllProductLots } from '@/features/stock/hooks'
import { useSales } from '@/features/sales/hooks'
import { usePayments, useAllInstallments } from '@/features/payments/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCommissionRules } from '@/features/commissions/hooks'
import { useSampleRequests } from '@/features/samples/hooks'
import { useCrmOpportunities } from '@/features/crm/hooks'
import { useCongresses } from '@/features/congresses/hooks'
import { buildBusinessSnapshot } from './buildBusinessSnapshot'

/** Rapor/öneri/soru-cevap özelliklerinin ihtiyaç duyduğu tüm canlı veriyi toplayıp tek bir özet nesnesine indirger. */
export function useBusinessSnapshot() {
  const { data: products = [] } = useProducts('')
  const { data: productLots = [] } = useAllProductLots()
  const { data: sales = [] } = useSales()
  const { data: monthPayments = [] } = usePayments({ from: startOfMonth(new Date()).toISOString() })
  const { data: customers = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()
  const { data: commissionRules = [] } = useCommissionRules()
  const { data: sampleRequests = [] } = useSampleRequests()
  const { data: installments = [] } = useAllInstallments()
  const { data: opportunities = [] } = useCrmOpportunities()
  const { data: congresses = [] } = useCongresses()

  return buildBusinessSnapshot({
    products,
    productLots,
    sales,
    monthPayments,
    customers,
    salesReps,
    commissionRules,
    sampleRequests,
    installments,
    opportunities,
    congresses,
  })
}
