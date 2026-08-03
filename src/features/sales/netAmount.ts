export function netAmount(sale: { type: string; quantity: number; unit_price: number | string }): number {
  return (sale.type === 'return' ? -1 : 1) * sale.quantity * Number(sale.unit_price)
}
