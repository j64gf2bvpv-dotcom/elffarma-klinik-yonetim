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
