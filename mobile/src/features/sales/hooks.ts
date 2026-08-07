import { useQuery } from '@tanstack/react-query'
import { fetchSales } from './api'

export function useSales() {
  return useQuery({ queryKey: ['sales'], queryFn: fetchSales })
}
