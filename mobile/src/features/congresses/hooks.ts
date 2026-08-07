import { useQuery } from '@tanstack/react-query'
import { fetchCongresses, fetchCongress } from './api'

export function useCongresses() {
  return useQuery({ queryKey: ['congresses'], queryFn: fetchCongresses })
}

export function useCongress(id: string | undefined) {
  return useQuery({
    queryKey: ['congresses', 'detail', id],
    queryFn: () => fetchCongress(id as string),
    enabled: !!id,
  })
}
