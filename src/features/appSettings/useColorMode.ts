import * as React from 'react'
import { useAppSetting, useSaveAppSetting } from './hooks'
import type { ColorMode } from './brandThemes'

export function useColorMode() {
  const { data } = useAppSetting<ColorMode>('color_mode')
  const save = useSaveAppSetting<ColorMode>('color_mode')
  const mode: ColorMode = data === 'dark' ? 'dark' : 'light'

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  const setMode = React.useCallback((next: ColorMode) => save.mutate(next), [save])
  const toggle = React.useCallback(
    () => save.mutate(mode === 'dark' ? 'light' : 'dark'),
    [save, mode],
  )

  return { mode, setMode, toggle }
}
