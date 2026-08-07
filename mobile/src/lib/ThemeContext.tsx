import * as React from 'react'
import { blackGoldTheme, type Theme } from './theme'

const ThemeContext = React.createContext<Theme>(blackGoldTheme)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Faz 1: tek sabit tema (Siyah/Gold). app_settings.brand_theme'e bağlı
  // seçilebilir tema/renk modu senkronizasyonu Faz 6'da eklenecek.
  return <ThemeContext.Provider value={blackGoldTheme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return React.useContext(ThemeContext)
}
