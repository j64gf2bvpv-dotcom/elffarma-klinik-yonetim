import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import { downloadDocument, getDocumentUrl, isPdfPath, openDocument, removeDocuments, uploadDocumentAttachment } from '@/lib/documentAttachments'
import type { ExpenseEntry, ExpenseEntryCategory } from '@/types/database'

export interface ExpenseEntrySection {
  key: ExpenseEntryCategory
  label: string
  /** Abone no + sözleşme no sütunları olan faturalı gider mi (elektrik/su/internet) */
  isBill: boolean
  /** Ek belgenin adı — "Fatura" ya da "Fiş" */
  docLabel: string
}

export const EXPENSE_ENTRY_SECTIONS: ExpenseEntrySection[] = [
  { key: 'elektrik', label: 'Elektrik', isBill: true, docLabel: 'Fatura' },
  { key: 'su', label: 'Su', isBill: true, docLabel: 'Fatura' },
  { key: 'internet', label: 'İnternet (Türksat)', isBill: true, docLabel: 'Fatura' },
  { key: 'ofis', label: 'Ofis', isBill: false, docLabel: 'Fiş' },
  { key: 'mutfak', label: 'Mutfak', isBill: false, docLabel: 'Fiş' },
  { key: 'ofis_yemek', label: 'Ofis Yemek', isBill: false, docLabel: 'Fiş' },
]

export const SECTION_BY_KEY = Object.fromEntries(EXPENSE_ENTRY_SECTIONS.map((s) => [s.key, s])) as Record<
  ExpenseEntryCategory,
  ExpenseEntrySection
>

export interface ExpenseEntryInput {
  category: ExpenseEntryCategory
  entry_date: string
  amount: number
  subscriber_number: string | null
  contract_number: string | null
  description: string | null
  attachment_paths: string[]
}

export interface ExpenseEntryFilters {
  /** yyyy-MM-dd */
  from?: string
  to?: string
}

export async function fetchExpenseEntries(filters: ExpenseEntryFilters): Promise<ExpenseEntry[]> {
  let query = supabase.from('expense_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false })
  if (filters.from) query = query.gte('entry_date', filters.from)
  if (filters.to) query = query.lte('entry_date', filters.to)
  const { data, error } = await query
  if (error) throw error
  return data as ExpenseEntry[]
}

export async function createExpenseEntry(input: ExpenseEntryInput): Promise<ExpenseEntry> {
  return offlineInsert<ExpenseEntry>('expense_entries', { ...input }, `${SECTION_BY_KEY[input.category].label} gideri: ${input.amount} TL`)
}

export async function updateExpenseEntry(id: string, input: ExpenseEntryInput): Promise<ExpenseEntry> {
  return offlineUpdate<ExpenseEntry>('expense_entries', id, { ...input }, `${SECTION_BY_KEY[input.category].label} gideri güncelleme`)
}

export async function deleteExpenseEntry(entry: ExpenseEntry): Promise<void> {
  await offlineDelete('expense_entries', entry.id, `${SECTION_BY_KEY[entry.category].label} gideri silme`)
  await removeDocuments(entry.attachment_paths)
}

/** Fatura/fiş görüntüsünü yükler — resimler okunur boyutta JPEG'e, PDF'ler olduğu gibi. */
export const uploadExpenseAttachment = (file: File) => uploadDocumentAttachment(file, 'expense-entries')
export const downloadExpenseAttachment = downloadDocument
export const getExpenseAttachmentUrl = getDocumentUrl
export const openExpenseAttachment = openDocument
export { isPdfPath }

export interface KnownBillNumber {
  subscriber_number: string | null
  contract_number: string | null
}

/**
 * Faturalar bölümünde (utility_bills + tekrarlayan fatura şablonları) bu tür için kayıtlı
 * abone/sözleşme numaraları, en yeniden eskiye (kullanıcı isteği, 2026-11-11: "abone
 * numaraları faturalar kısmında var, oradan çek").
 */
export async function fetchKnownBillNumbers(category: ExpenseEntryCategory): Promise<KnownBillNumber[]> {
  const [bills, templates] = await Promise.all([
    supabase.from('utility_bills').select('subscriber_number, contract_number').eq('category', category).order('due_date', { ascending: false }),
    supabase.from('utility_bill_templates').select('subscriber_number, contract_number').eq('category', category).order('created_at', { ascending: false }),
  ])
  if (bills.error) throw bills.error
  if (templates.error) throw templates.error
  const seen = new Set<string>()
  const out: KnownBillNumber[] = []
  for (const r of [...(bills.data ?? []), ...(templates.data ?? [])] as KnownBillNumber[]) {
    const s = r.subscriber_number?.trim() || null
    const c = r.contract_number?.trim() || null
    const key = `${s}|${c}`
    if ((!s && !c) || seen.has(key)) continue
    seen.add(key)
    out.push({ subscriber_number: s, contract_number: c })
  }
  return out
}
