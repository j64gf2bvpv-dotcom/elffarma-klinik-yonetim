import * as React from 'react'

/** Bir uyarı, ertelendikten sonra kaç ms boyunca zilde gizli kalır. */
export const ALERT_SNOOZE_DURATION_MS = 5 * 60 * 1000

/**
 * Bildirim zili açık kalınca (bkz. AppShell TopBar) o an görünen uyarıları
 * GEÇİCİ olarak gizlemek için — `useDismissedAlerts`'ten farklı olarak
 * kalıcı değil: bellekte tutulur (sayfa yenilenince sıfırlanır) ve süre
 * dolunca kendiliğinden geri gelir, böylece sorun (ör. hâlâ düşük stok)
 * devam ediyorsa zil bir süre sonra tekrar dolar.
 */
export function useSnoozedAlerts() {
  const [expiryByKey, setExpiryByKey] = React.useState<Map<string, number>>(new Map())

  const isSnoozed = React.useCallback(
    (key: string) => {
      const expiry = expiryByKey.get(key)
      return expiry != null && expiry > Date.now()
    },
    [expiryByKey],
  )

  const snoozeMany = React.useCallback((keys: string[], durationMs: number = ALERT_SNOOZE_DURATION_MS) => {
    if (keys.length === 0) return
    const expiry = Date.now() + durationMs
    setExpiryByKey((prev) => {
      const next = new Map(prev)
      for (const key of keys) next.set(key, expiry)
      return next
    })
  }, [])

  return { isSnoozed, snoozeMany }
}
