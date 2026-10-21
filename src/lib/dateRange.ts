import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

/**
 * Tarih aralığını kısa Türkçe biçimde yazar (kullanıcı isteği, 2026-10-21:
 * "5-8 Kasım 2026 şeklinde yazsın"):
 *  - aynı ay:      "5–8 Kasım 2026"
 *  - aynı yıl:     "28 Ekim – 2 Kasım 2026"
 *  - farklı yıl:   "30 Aralık 2026 – 2 Ocak 2027"
 *  - tek gün / bitiş yok: "5 Kasım 2026"
 */
export function formatDateRange(start: string | null | undefined, end?: string | null): string {
  if (!start) return ''
  const s = new Date(start)
  const full = (d: Date) => format(d, 'd MMMM yyyy', { locale: trLocale })
  if (!end) return full(s)
  const e = new Date(end)
  if (format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd')) return full(s)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, 'd')}–${full(e)}`
  }
  if (s.getFullYear() === e.getFullYear()) return `${format(s, 'd MMMM', { locale: trLocale })} – ${full(e)}`
  return `${full(s)} – ${full(e)}`
}
