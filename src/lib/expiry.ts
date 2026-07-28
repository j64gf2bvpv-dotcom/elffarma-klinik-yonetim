export type ExpiryStatus = 'expired' | 'soon' | 'ok'

export function getExpiryStatus(expiryDate: string | null, withinDays = 60): ExpiryStatus | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'expired'
  if (diffDays <= withinDays) return 'soon'
  return 'ok'
}
