import { subDays, format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { createReminder, updateReminder, deleteReminder } from '@/features/reminders/api'
import type { UtilityBill, UtilityBillCategory, UtilityBillTemplate } from '@/types/database'

export const UTILITY_BILL_CATEGORY_LABELS: Record<UtilityBillCategory, string> = {
  elektrik: 'Elektrik',
  dogalgaz: 'Doğalgaz',
  su: 'Su',
  internet: 'İnternet',
  telefon: 'Telefon',
  diger: 'Diğer',
}

export interface UtilityBillInput {
  category: UtilityBillCategory
  /** Tekrarlayan şablona bağlıysa — o ay için sunucu ikinci bir fatura üretmesin diye */
  template_id?: string | null
  contract_number?: string | null
  subscriber_number?: string | null
  amount: number
  due_date: string
  note?: string | null
}

/**
 * Hatırlatma, son ödeme tarihinin KENDİSİNDE değil öncesinde düşsün diye — ödemeye
 * yetişecek zaman kalsın. 2026-08-21: bir hafta önce; 2026-10-21 (kullanıcı isteği:
 * "son ödeme tarihine 5 gün kala hatırlatma gelsin"): 5 gün önce — ana ekrandaki
 * fatura uyarısıyla (BillDueBanner, BILL_WARN_DAYS) aynı gün.
 */
function reminderDueDate(dueDate: string): string {
  return format(subDays(new Date(dueDate), 5), 'yyyy-MM-dd')
}

function reminderTitle(input: UtilityBillInput): string {
  return `${UTILITY_BILL_CATEGORY_LABELS[input.category]} Faturası — Son Ödeme Yaklaşıyor`
}

function reminderNote(input: UtilityBillInput): string {
  const parts = [
    `Son ödeme tarihi: ${format(new Date(input.due_date), 'd MMMM yyyy', { locale: trLocale })}`,
    input.contract_number ? `Sözleşme No: ${input.contract_number}` : null,
    input.subscriber_number ? `Abone No: ${input.subscriber_number}` : null,
    `Tutar: ${input.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`,
    input.note?.trim() || null,
  ]
  return parts.filter(Boolean).join(' — ')
}

export async function fetchUtilityBills(): Promise<UtilityBill[]> {
  const { data, error } = await supabase.from('utility_bills').select('*').order('due_date', { ascending: true })
  if (error) throw error
  return data as UtilityBill[]
}

/** Fatura eklenince son ödeme tarihinde otomatik bir Hatırlatma oluşturulur — ayrı bir bildirim mekanizması kurulmuyor, mevcut zil/Hatırlatmalar/Ajanda bunu otomatik gösterir. */
export async function createUtilityBill(input: UtilityBillInput): Promise<UtilityBill> {
  const reminder = await createReminder({
    title: reminderTitle(input),
    note: reminderNote(input),
    due_date: reminderDueDate(input.due_date),
  })
  const createdBy = await getCurrentUserId()
  return offlineInsert<UtilityBill>(
    'utility_bills',
    { ...input, reminder_id: reminder.id, created_by: createdBy },
    `Fatura: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`,
  )
}

export async function updateUtilityBill(id: string, input: UtilityBillInput, reminderId: string | null): Promise<UtilityBill> {
  if (reminderId) {
    await updateReminder(reminderId, {
      title: reminderTitle(input),
      note: reminderNote(input),
      due_date: reminderDueDate(input.due_date),
    })
  }
  return offlineUpdate<UtilityBill>('utility_bills', id, { ...input }, `Fatura güncelleme: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`)
}

/** Ödendi işaretlenince bağlı hatırlatma da tamamlandı sayılır — ödenmiş bir fatura için zil/Hatırlatmalar artık uyarı vermesin diye. Geri alınırsa hatırlatma da geri açılır. */
export async function updateUtilityBillPaid(id: string, isPaid: boolean, reminderId: string | null): Promise<UtilityBill> {
  if (reminderId) {
    await updateReminder(reminderId, { is_done: isPaid })
  }
  return offlineUpdate<UtilityBill>('utility_bills', id, { is_paid: isPaid }, 'Fatura ödeme durumu güncelleme')
}

export async function deleteUtilityBill(id: string, reminderId: string | null): Promise<void> {
  if (reminderId) {
    await deleteReminder(reminderId)
  }
  return offlineDelete('utility_bills', id, 'Fatura silme')
}

export interface UtilityBillTemplateInput {
  category: UtilityBillCategory
  contract_number?: string | null
  subscriber_number?: string | null
  amount: number
  day_of_month: number
  note?: string | null
}

export async function fetchUtilityBillTemplates(): Promise<UtilityBillTemplate[]> {
  const { data, error } = await supabase.from('utility_bill_templates').select('*').order('day_of_month', { ascending: true })
  if (error) throw error
  return data as UtilityBillTemplate[]
}

export async function createUtilityBillTemplate(input: UtilityBillTemplateInput): Promise<UtilityBillTemplate> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<UtilityBillTemplate>(
    'utility_bill_templates',
    { ...input, created_by: createdBy },
    `Tekrarlayan fatura: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`,
  )
}

export async function updateUtilityBillTemplate(id: string, input: UtilityBillTemplateInput): Promise<UtilityBillTemplate> {
  return offlineUpdate<UtilityBillTemplate>(
    'utility_bill_templates',
    id,
    { ...input },
    `Tekrarlayan fatura güncelleme: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`,
  )
}

export async function updateUtilityBillTemplateActive(id: string, isActive: boolean): Promise<UtilityBillTemplate> {
  return offlineUpdate<UtilityBillTemplate>('utility_bill_templates', id, { is_active: isActive }, 'Tekrarlayan fatura durumu güncelleme')
}

export async function deleteUtilityBillTemplate(id: string): Promise<void> {
  return offlineDelete('utility_bill_templates', id, 'Tekrarlayan fatura şablonu silme')
}

/**
 * Var olan bir faturadan "her ay bu günde" tekrarlayan şablon oluşturur
 * (kullanıcı isteği, 2026-10-21: "faturalarda her ayın o gününde ödenmesi
 * gerekli, o şekilde bildirim olsun"). Şablonun günü faturanın son ödeme günü,
 * tutarı faturanın tutarıdır; sunucu (generate_due_utility_bills, her sabah)
 * her ay o güne faturayı ve 5 gün önceye hatırlatmasını otomatik açar.
 * Bu ayın (ya da sonrasının) faturası şablona bağlanır ki aynı ay için ikinci
 * fatura üretilmesin.
 */
export async function makeBillRecurring(bill: UtilityBill): Promise<UtilityBillTemplate> {
  const template = await createUtilityBillTemplate({
    category: bill.category,
    contract_number: bill.contract_number,
    subscriber_number: bill.subscriber_number,
    amount: Number(bill.amount),
    day_of_month: Number(bill.due_date.slice(8, 10)),
    note: bill.note,
  })
  const monthStart = format(new Date(), 'yyyy-MM-01')
  if (bill.due_date >= monthStart && !bill.template_id) {
    await offlineUpdate<UtilityBill>('utility_bills', bill.id, { template_id: template.id }, 'Faturayı tekrarlayan şablona bağlama')
  }
  return template
}
