import * as React from 'react'
import { useMyPreferences, useSaveMyPreferences } from '@/features/staffPreferences/hooks'
import type { ColorMode } from './brandThemes'

/**
 * Açık/koyu mod kişisel bir tercih — önceden app_settings'te (admin-write/
 * staff-read) saklanıyordu, yani admin olmayan biri düğmeye bassa da RLS
 * sessizce reddediyordu. Artık staff_preferences'ta (sahibi kendi satırını
 * okur/yazar), her kullanıcı kendi seçimini bağımsız yapabiliyor.
 */
export function useColorMode() {
  const { data } = useMyPreferences()
  const save = useSaveMyPreferences()
  const mode: ColorMode = data?.color_mode === 'dark' ? 'dark' : 'light'

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  const setMode = React.useCallback((next: ColorMode) => save.mutate({ color_mode: next }), [save])
  const toggle = React.useCallback(
    () => save.mutate({ color_mode: mode === 'dark' ? 'light' : 'dark' }),
    [save, mode],
  )

  return { mode, setMode, toggle }
}
