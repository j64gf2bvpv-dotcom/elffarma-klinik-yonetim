import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Supabase/PostgREST hataları (`{ message, details, hint, code }`) gerçek
 * `Error` örneği DEĞİL — düz nesne. `error instanceof Error` bunlar için
 * false döner ve `String(error)` "[object Object]" üretir. Bu, hem gerçek
 * `Error`'ları hem düz `{ message }` nesnelerini doğru mesaja çevirir.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error ?? '')
}

/**
 * Tarihi YEREL (Türkiye) takvim gününe göre 'YYYY-MM-DD' yapar.
 * `d.toISOString().slice(0, 10)` UTC'ye çevirdiği için yerel gece yarısı
 * (00:00–03:00 arası) bir önceki güne düşüyordu — tarih anahtarı gereken her
 * yerde bunu kullanın.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
