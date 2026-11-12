import { differenceInCalendarDays } from 'date-fns'
import type { Personnel, PersonnelDocument } from '@/types/database'
import { PERSONNEL_DOC_TYPES } from './docTypes'

/** Geçerlilik: süresi geçti / 30 gün içinde doluyor / geçerli */
export function validity(doc: PersonnelDocument): 'expired' | 'soon' | 'ok' {
  if (!doc.valid_until) return 'ok'
  const d = differenceInCalendarDays(new Date(doc.valid_until + 'T00:00:00'), new Date())
  return d < 0 ? 'expired' : d <= 30 ? 'soon' : 'ok'
}

/** Personelin evrak özeti: standart evraklardan kaç tanesi var, eksikler, süresi dolanlar */
export function docSummary(docs: PersonnelDocument[]) {
  const have = new Set(docs.map((d) => d.doc_type))
  const missing = PERSONNEL_DOC_TYPES.filter((t) => !have.has(t.key))
  const expired = docs.filter((d) => validity(d) === 'expired')
  const soon = docs.filter((d) => validity(d) === 'soon')
  return { done: PERSONNEL_DOC_TYPES.length - missing.length, total: PERSONNEL_DOC_TYPES.length, missing, expired, soon }
}

export const isActivePerson = (p: Personnel) => !p.end_date || p.end_date >= new Date().toISOString().slice(0, 10)

export const trDate = (d: string | null | undefined) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('tr-TR') : '')

/** T.C. kimlik no algoritma kontrolü (uyarı için) */
export function isValidTcNo(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false
  const d = [...v].map(Number)
  const odd = d[0] + d[2] + d[4] + d[6] + d[8]
  const even = d[1] + d[3] + d[5] + d[7]
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10]
}

