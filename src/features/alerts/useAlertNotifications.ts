import * as React from 'react'
import { playAlertBeep } from '@/lib/beep'
import { getPaymentDueStatus } from '@/lib/paymentDue'
import type { Customer, Product } from '@/types/database'

const STORAGE_KEY = 'elffarma-notified-alerts'

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveNotified(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

/**
 * Ödeme vadesi yaklaşan/geçen cariler ve kritik stok seviyesindeki ürünler için
 * sesli uyarı + masaüstü bildirimi tetikler, ilgili öğeler görünür kaldığı sürece
 * de görsel "yanıp sönme" durumunu (hasUrgentAlerts) döner. Her öğe için ses/bildirim
 * yalnızca bir kez çalar (localStorage'da izlenir); zil ikonundaki yanıp sönme ise
 * öğe giderilene/kapatılana kadar sürer.
 */
export function useAlertNotifications(paymentDue: Customer[], criticalStock: Product[]) {
  const notifiedRef = React.useRef<Set<string> | null>(null)
  if (notifiedRef.current === null) notifiedRef.current = loadNotified()

  const urgentKey = React.useMemo(
    () =>
      [...paymentDue.map((d) => `paymentDue:${d.id}`), ...criticalStock.map((p) => `criticalStock:${p.id}`)]
        .sort()
        .join(','),
    [paymentDue, criticalStock],
  )

  React.useEffect(() => {
    const notified = notifiedRef.current!
    const fresh: { key: string; title: string; body: string }[] = []

    for (const d of paymentDue) {
      const key = `paymentDue:${d.id}`
      if (notified.has(key)) continue
      const status = getPaymentDueStatus(d.next_payment_due)
      fresh.push({
        key,
        title: 'Ödeme Vadesi',
        body: `${d.full_name} için ödeme vadesi ${status === 'overdue' ? 'geçti' : 'yaklaşıyor'}.`,
      })
    }
    for (const p of criticalStock) {
      const key = `criticalStock:${p.id}`
      if (notified.has(key)) continue
      fresh.push({
        key,
        title: 'Kritik Stok Seviyesi',
        body: `${p.name} kritik stok seviyesinde (${p.current_quantity} ${p.unit}).`,
      })
    }

    if (fresh.length === 0) return
    playAlertBeep()
    for (const a of fresh) {
      notified.add(a.key)
      void window.electronAPI?.notify(a.title, a.body)
    }
    saveNotified(notified)
    // urgentKey içeriği değiştiğinde (yeni/giderilen öğe) yeniden çalışır; paymentDue/
    // criticalStock referansları her render'da değiştiği için doğrudan bağımlılık olarak kullanılmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgentKey])

  return { hasUrgentAlerts: paymentDue.length > 0 || criticalStock.length > 0 }
}
