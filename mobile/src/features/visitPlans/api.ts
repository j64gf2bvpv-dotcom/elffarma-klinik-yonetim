// "Haftalık Plan" — admin'in personele doktor ataması (supabase/schema.sql
// "49. HAFTALIK ZİYARET PLANI"). Yazma sadece admin, okuma tüm aktif
// personel (RLS bunu zorluyor) — bu yüzden create/update/delete çağrıları
// admin olmayan bir hesapta sunucu tarafında reddedilir.
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { VisitPlan, VisitPlanStatus } from '@shared/types/database'

export interface VisitPlanWithCustomer extends VisitPlan {
  customer_name: string
  staff_name: string | null
}

export async function fetchVisitPlans(from: string, to: string): Promise<VisitPlanWithCustomer[]> {
  const { data, error } = await supabase
    .from('visit_plans')
    .select('*, customers(full_name), staff:assigned_staff_id(full_name)')
    .gte('planned_date', from)
    .lte('planned_date', to)
    .order('planned_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as unknown as VisitPlan & {
      customers?: { full_name: string } | null
      staff?: { full_name: string } | null
    }
    return { ...row, customer_name: row.customers?.full_name ?? 'Bilinmeyen', staff_name: row.staff?.full_name ?? null }
  })
}

export interface CreateVisitPlanInput {
  customer_id: string
  assigned_staff_id: string
  planned_date: string
  note?: string | null
}

export async function createVisitPlan(input: CreateVisitPlanInput): Promise<VisitPlan> {
  const userId = await getCurrentUserId()
  return offlineInsert<VisitPlan>('visit_plans', { ...input, created_by: userId }, `Ziyaret planı: ${input.planned_date}`)
}

export async function updateVisitPlanStatus(id: string, status: VisitPlanStatus): Promise<VisitPlan> {
  return offlineUpdate<VisitPlan>('visit_plans', id, { status }, 'Ziyaret planı durumu')
}

export async function deleteVisitPlan(id: string): Promise<void> {
  return offlineDelete('visit_plans', id, 'Ziyaret planı silme')
}
