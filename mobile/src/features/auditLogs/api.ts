import { supabase } from '@/lib/supabaseClient'
import type { AuditLog } from '@shared/types/database'

export interface AuditLogFilters {
  tableName?: string
  staffId?: string
}

export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
  if (filters.tableName) query = query.eq('table_name', filters.tableName)
  if (filters.staffId) query = query.eq('staff_id', filters.staffId)
  const { data, error } = await query
  if (error) throw error
  return data as AuditLog[]
}
