import * as React from 'react'
import { playClickSound } from '@/lib/sounds'
import { useSoundSettings } from './useSoundSettings'

/** Açıksa, uygulama genelinde her tuşa basışta kısa bir tık sesi çalar. */
export function useKeyboardSound() {
  const { settings } = useSoundSettings()

  React.useEffect(() => {
    if (!settings.keyboard) return
    function onKeyDown() {
      playClickSound()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settings.keyboard])
}
