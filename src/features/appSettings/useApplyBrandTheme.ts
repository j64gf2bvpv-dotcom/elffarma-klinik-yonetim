import * as React from 'react'
import { useAppSetting } from './hooks'
import { brandThemeCssVars, backgroundCssVars, sidebarCssVars, defaultBrandTheme, type BrandTheme } from './brandThemes'
import { useColorMode } from './useColorMode'

export type SavedBrandTheme = Pick<BrandTheme, 'hue' | 'chromaScale' | 'special'>
export type SavedSurfaceTheme = { hue: number; chromaScale?: number }

export function useApplyBrandTheme() {
  const { data } = useAppSetting<SavedBrandTheme>('brand_theme')
  const { data: backgroundTheme } = useAppSetting<SavedSurfaceTheme>('background_theme')
  const { data: sidebarTheme } = useAppSetting<SavedSurfaceTheme>('sidebar_theme')
  const { mode } = useColorMode()

  React.useEffect(() => {
    const root = document.documentElement
    const hue = data?.hue ?? defaultBrandTheme.hue
    const chromaScale = data?.chromaScale ?? defaultBrandTheme.chromaScale ?? 1
    const special = data ? data.special : defaultBrandTheme.special
    const vars = brandThemeCssVars(hue, chromaScale, mode, special)

    // Arkaplan/kenar çubuğu için kullanıcı özel bir ton seçtiyse (siyah/gold
    // özel temada bile) marka renginden bağımsız olarak üzerine yazılır.
    if (backgroundTheme) {
      Object.assign(vars, backgroundCssVars(backgroundTheme.hue, backgroundTheme.chromaScale ?? 1, mode))
    }
    if (sidebarTheme) {
      Object.assign(vars, sidebarCssVars(sidebarTheme.hue, sidebarTheme.chromaScale ?? 1, mode))
    }

    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
  }, [data, backgroundTheme, sidebarTheme, mode])
}
