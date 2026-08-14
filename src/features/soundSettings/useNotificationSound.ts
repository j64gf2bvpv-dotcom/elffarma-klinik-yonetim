import * as React from 'react'
import { playNotificationSound } from '@/lib/sounds'
import { useAlertsSummary } from '@/features/alerts/useAlertsSummary'
import { useSoundSettings } from './useSoundSettings'

/**
 * Açıksa, bildirim zilindeki toplam uyarı sayısı bir öncekinden fazla
 * olduğunda (yeni bir kritik stok/hatırlatma/vade vb. belirdiğinde) kısa bir
 * bildirim sesi çalar. İlk yüklemede (henüz bir "önceki" değer yokken) ses
 * çalınmaz — aksi halde uygulama her açıldığında (zaten var olan uyarılar
 * için) gereksiz yere öter.
 */
export function useNotificationSound() {
  const { settings } = useSoundSettings()
  const { total } = useAlertsSummary()
  const previousTotal = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (previousTotal.current !== null && settings.notification && total > previousTotal.current) {
      playNotificationSound()
    }
    previousTotal.current = total
  }, [total, settings.notification])
}
