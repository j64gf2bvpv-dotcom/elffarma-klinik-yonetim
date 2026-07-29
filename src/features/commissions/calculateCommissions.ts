import type { AdjustmentWithRep } from './api'
import type { CommissionRule, Customer, Product, SalesRep } from '@/types/database'
import type { SaleWithRelations } from '@/features/sales/api'
import type { PaymentWithCustomer } from '@/features/payments/api'

function ruleMatchesSale(rule: CommissionRule, sale: SaleWithRelations, productById: Map<string, Product>, customerById: Map<string, Customer>): boolean {
  const product = sale.product_id ? productById.get(sale.product_id) : undefined
  const customer = customerById.get(sale.customer_id)
  switch (rule.scope_type) {
    case 'all':
      return true
    case 'product':
      return sale.product_id === rule.scope_value
    case 'category':
      return !!product && product.category === rule.scope_value
    case 'brand':
      return !!product && product.brand_line === rule.scope_value
    case 'sales_rep':
      return sale.sales_rep_id === rule.scope_value
    case 'clinic':
      return !!customer && customer.clinic_id === rule.scope_value
    case 'customer':
      return sale.customer_id === rule.scope_value
    default:
      return false
  }
}

function ruleMatchesPayment(rule: CommissionRule, payment: PaymentWithCustomer, customerById: Map<string, Customer>): boolean {
  const customer = customerById.get(payment.customer_id)
  switch (rule.scope_type) {
    case 'all':
      return true
    case 'sales_rep':
      return payment.sales_rep_id === rule.scope_value
    case 'clinic':
      return !!customer && customer.clinic_id === rule.scope_value
    case 'customer':
      return payment.customer_id === rule.scope_value
    // 'product'/'category'/'brand' bir tahsilat kaydına uygulanamaz — tahsilat'ta ürün kırılımı yok.
    default:
      return false
  }
}

export interface RuleBreakdownEntry {
  ruleId: string
  ruleName: string
  baseAmount: number
  commissionAmount: number
}

export interface RepCommissionResult {
  salesRepId: string
  salesRepName: string
  breakdown: RuleBreakdownEntry[]
  baseCommissionTotal: number
  bonusTotal: number
  cezaTotal: number
  netTotal: number
}

export function calculateCommissions(
  rules: CommissionRule[],
  sales: SaleWithRelations[],
  payments: PaymentWithCustomer[],
  products: Product[],
  customers: Customer[],
  salesReps: SalesRep[],
  adjustments: AdjustmentWithRep[],
): RepCommissionResult[] {
  const productById = new Map(products.map((p) => [p.id, p]))
  const customerById = new Map(customers.map((c) => [c.id, c]))
  const activeRules = rules.filter((r) => r.is_active)

  const byRep = new Map<string, RepCommissionResult>()

  function getOrCreate(salesRepId: string): RepCommissionResult {
    let entry = byRep.get(salesRepId)
    if (!entry) {
      const rep = salesReps.find((r) => r.id === salesRepId)
      entry = {
        salesRepId,
        salesRepName: rep?.name ?? 'Bilinmeyen Temsilci',
        breakdown: [],
        baseCommissionTotal: 0,
        bonusTotal: 0,
        cezaTotal: 0,
        netTotal: 0,
      }
      byRep.set(salesRepId, entry)
    }
    return entry
  }

  function addToBreakdown(salesRepId: string, rule: CommissionRule, amount: number) {
    const entry = getOrCreate(salesRepId)
    const commissionAmount = amount * (Number(rule.rate_percent) / 100)
    let line = entry.breakdown.find((b) => b.ruleId === rule.id)
    if (!line) {
      line = { ruleId: rule.id, ruleName: rule.name, baseAmount: 0, commissionAmount: 0 }
      entry.breakdown.push(line)
    }
    line.baseAmount += amount
    line.commissionAmount += commissionAmount
    entry.baseCommissionTotal += commissionAmount
  }

  for (const rule of activeRules.filter((r) => r.basis === 'satis')) {
    for (const sale of sales) {
      if (!sale.sales_rep_id) continue
      if (!ruleMatchesSale(rule, sale, productById, customerById)) continue
      const signedAmount = (sale.type === 'return' ? -1 : 1) * Number(sale.quantity) * Number(sale.unit_price)
      addToBreakdown(sale.sales_rep_id, rule, signedAmount)
    }
  }

  for (const rule of activeRules.filter((r) => r.basis === 'tahsilat')) {
    for (const payment of payments) {
      if (!payment.sales_rep_id) continue
      if (!ruleMatchesPayment(rule, payment, customerById)) continue
      addToBreakdown(payment.sales_rep_id, rule, Number(payment.amount))
    }
  }

  for (const adjustment of adjustments) {
    const entry = getOrCreate(adjustment.sales_rep_id)
    if (adjustment.adjustment_type === 'bonus') entry.bonusTotal += Number(adjustment.amount)
    else entry.cezaTotal += Number(adjustment.amount)
  }

  for (const entry of byRep.values()) {
    entry.netTotal = entry.baseCommissionTotal + entry.bonusTotal - entry.cezaTotal
  }

  return Array.from(byRep.values()).sort((a, b) => b.netTotal - a.netTotal)
}
