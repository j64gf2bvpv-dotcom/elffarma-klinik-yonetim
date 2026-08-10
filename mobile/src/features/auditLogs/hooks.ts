import { useQuery } from '@tanstack/react-query'
import { fetchAuditLogs, type AuditLogFilters } from './api'

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({ queryKey: ['audit_logs', filters], queryFn: () => fetchAuditLogs(filters) })
}
