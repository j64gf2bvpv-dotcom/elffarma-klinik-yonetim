import { useQuery } from '@tanstack/react-query'
import { fetchCurrentMonthTarget } from './api'

export function useCurrentMonthTarget() {
  return useQuery({ queryKey: ['budget', 'currentMonthTarget'], queryFn: fetchCurrentMonthTarget })
}
