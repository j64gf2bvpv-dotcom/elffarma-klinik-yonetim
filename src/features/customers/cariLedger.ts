import type { Customer, Invoice, Payment, Sale } from '@/types/database'

export interface CariLedgerEntry {
  debit: number
  credit: number
}

/**
 * Tahsilat (credit) + satış/iade (debit/credit) + fatura (debit) hareketlerinden
 * müşteri başına borç/alacak haritası çıkarır. CariHesapListPage ve Dashboard'daki
 * "Toplam Cari" kartı aynı hesaplamayı paylaşır — mantık tek yerde.
 */
export function computeCariLedger(
  payments: Payment[],
  sales: Sale[],
  invoices: Invoice[],
): Map<string, CariLedgerEntry> {
  const map = new Map<string, CariLedgerEntry>()
  function ensure(id: string) {
    if (!map.has(id)) map.set(id, { debit: 0, credit: 0 })
    return map.get(id)!
  }
  for (const p of payments) ensure(p.customer_id).credit += Number(p.amount)
  for (const s of sales) {
    const entry = ensure(s.customer_id)
    const amount = s.quantity * Number(s.unit_price)
    if (s.type === 'sale') entry.debit += amount
    else entry.credit += amount
  }
  for (const inv of invoices) ensure(inv.customer_id).debit += Number(inv.amount)
  return map
}

export function cariBalance(ledger: Map<string, CariLedgerEntry>, customerId: string): number {
  const entry = ledger.get(customerId)
  return entry ? entry.debit - entry.credit : 0
}

export interface CariTotals {
  totalDebit: number
  totalCredit: number
  totalBalance: number
}

export function computeCariTotals(customers: Customer[], ledger: Map<string, CariLedgerEntry>): CariTotals {
  let totalDebit = 0
  let totalCredit = 0
  for (const c of customers) {
    const entry = ledger.get(c.id)
    if (!entry) continue
    totalDebit += entry.debit
    totalCredit += entry.credit
  }
  return { totalDebit, totalCredit, totalBalance: totalDebit - totalCredit }
}
