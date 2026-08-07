import { useQuery } from '@tanstack/react-query'
import { fetchCrmActivities } from './api'

export function useCrmActivities() {
  return useQuery({ queryKey: ['crm_activities'], queryFn: fetchCrmActivities })
}
