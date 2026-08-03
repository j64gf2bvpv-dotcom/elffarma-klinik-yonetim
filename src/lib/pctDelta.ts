export function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
