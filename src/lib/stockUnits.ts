import type { Product, StockUnitKind } from '@/types/database'

/**
 * Stok birimleri — Tam Paket (Kutu), Küçük Kutu, Flakon (kullanıcı istekleri,
 * 2026-10-26: "paket yerine tam paket yazsın", "küçük kutu sütunu da olmalı").
 * Üçü birbirinden bağımsız sayılır; her birinin üründe ayrı stok alanı var.
 */
export const STOCK_UNITS: StockUnitKind[] = ['paket', 'kucuk_kutu', 'flakon']

/** Miktarın yanında ("4 Tam Paket") */
export const UNIT_LABEL: Record<StockUnitKind, string> = { paket: 'Tam Paket', kucuk_kutu: 'Küçük Kutu', flakon: 'Flakon' }

/** Seçici / başlık ("Tam Paket (Kutu)") */
export const UNIT_TITLE: Record<StockUnitKind, string> = { paket: 'Tam Paket (Kutu)', kucuk_kutu: 'Küçük Kutu', flakon: 'Flakon' }

export function unitQuantity(product: Pick<Product, 'current_quantity' | 'flakon_quantity' | 'small_box_quantity'>, unit: StockUnitKind): number {
  if (unit === 'flakon') return product.flakon_quantity
  if (unit === 'kucuk_kutu') return product.small_box_quantity ?? 0
  return product.current_quantity
}
