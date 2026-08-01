import { useQuery } from '@tanstack/react-query'
import { fetchWeather } from './api'

export function useWeather(city: string) {
  return useQuery({
    queryKey: ['weather', city],
    queryFn: () => fetchWeather(city),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  })
}
