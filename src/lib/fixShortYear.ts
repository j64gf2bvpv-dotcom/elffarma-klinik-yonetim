/**
 * Tarih kutusuna yıl iki haneli yazılınca ("17.02.28") tarayıcı 0028-02-17
 * üretiyor — ürün yanlışlıkla "son kullanım tarihi doldu" görünüyordu
 * (bulundu: 2026-10-23 program incelemesi). 100'den küçük yıllar 20xx'e çevrilir.
 */
export function fixShortYear(date: string): string
export function fixShortYear(date: string | null): string | null
export function fixShortYear(date: string | null): string | null {
  if (!date) return date
  const m = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m || Number(m[1]) >= 100) return date
  return `${2000 + Number(m[1])}-${m[2]}-${m[3]}`
}
