import { useQuery } from '@tanstack/react-query'
import { fetchSalesReps } from './api'

export function useSalesReps() {
  return useQuery({ queryKey: ['sales_reps'], queryFn: fetchSalesReps })
}
