import { useQuery } from '@tanstack/react-query'
import { fetchExchangeRates } from './api'

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange_rates'],
    queryFn: fetchExchangeRates,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })
}
