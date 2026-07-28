import * as React from 'react'
import { useAppSetting } from './hooks'
import { brandThemeCssVars, blackGoldTheme, type BrandTheme } from './brandThemes'
import { useColorMode } from './useColorMode'

export type SavedBrandTheme = Pick<BrandTheme, 'hue' | 'chromaScale' | 'special'>

export function useApplyBrandTheme() {
  const { data } = useAppSetting<SavedBrandTheme>('brand_theme')
  const { mode } = useColorMode()

  React.useEffect(() => {
    const root = document.documentElement
    const hue = data?.hue ?? blackGoldTheme.hue
    const chromaScale = data?.chromaScale ?? blackGoldTheme.chromaScale ?? 1
    const special = data ? data.special : blackGoldTheme.special
    const vars = brandThemeCssVars(hue, chromaScale, mode, special)
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
  }, [data, mode])
}
