import * as React from 'react'
import { toast } from 'sonner'
import { getShortChangelogSummary } from './whatsNew'

const STORAGE_KEY = 'elffarma_last_seen_version'

/**
 * Uygulama bir önceki açılıştan farklı bir sürümle başladıysa (otomatik
 * güncelleme sonrası yeniden başlatma dahil) o sürümün CHANGELOG.md
 * özetini kısa bir bildirimle gösterir. İlk kurulumda (daha önce hiç
 * kaydedilmiş sürüm yoksa) sessizce sadece mevcut sürümü kaydeder —
 * bildirim göstermez.
 */
export function useWhatsNewNotification() {
  React.useEffect(() => {
    const current = __APP_VERSION__
    const lastSeen = localStorage.getItem(STORAGE_KEY)
    if (lastSeen && lastSeen !== current) {
      const summary = getShortChangelogSummary(current)
      if (summary) {
        toast.success(`Güncellendi — v${current}`, { description: summary, duration: 12000 })
      }
    }
    localStorage.setItem(STORAGE_KEY, current)
  }, [])
}
