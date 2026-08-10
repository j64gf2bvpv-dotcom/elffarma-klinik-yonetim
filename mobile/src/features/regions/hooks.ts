import { useQuery } from '@tanstack/react-query'
import { fetchRegions } from './api'
import type { Region } from '@shared/types/database'

export function useRegions() {
  return useQuery({ queryKey: ['regions'], queryFn: fetchRegions })
}

/** Masaüstündeki regionLabel ile aynı — üst bölgesiyle birlikte gösterir (ör. "İstanbul / Kadıköy"). */
export function regionLabel(region: Region, byId: Map<string, Region>): string {
  const parent = region.parent_region_id ? byId.get(region.parent_region_id) : undefined
  return parent ? `${parent.name} / ${region.name}` : region.name
}
