import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { CompetitorReport, CompetitorStockStatus, CompetitorVisibility } from '@shared/types/database'

export interface CreateCompetitorReportInput {
  customer_id?: string | null
  doctor_name?: string | null
  competitor_name: string
  product_name: string
  stock_status?: CompetitorStockStatus | null
  price?: number | null
  visibility?: CompetitorVisibility | null
  notes?: string | null
}

export async function fetchCompetitorReports(): Promise<CompetitorReport[]> {
  const { data, error } = await supabase
    .from('competitor_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data as CompetitorReport[]
}

export async function createCompetitorReport(input: CreateCompetitorReportInput): Promise<CompetitorReport> {
  const userId = await getCurrentUserId()
  return offlineInsert<CompetitorReport>('competitor_reports', {
    customer_id: input.customer_id ?? null,
    doctor_name: input.doctor_name ?? null,
    competitor_name: input.competitor_name,
    product_name: input.product_name,
    stock_status: input.stock_status ?? null,
    price: input.price ?? null,
    visibility: input.visibility ?? null,
    notes: input.notes ?? null,
    reported_by: userId,
  }, `Rekabet: ${input.competitor_name} - ${input.product_name}`)
}

export async function deleteCompetitorReport(id: string): Promise<void> {
  return offlineDelete('competitor_reports', id, 'Rekabet raporu silme')
}
