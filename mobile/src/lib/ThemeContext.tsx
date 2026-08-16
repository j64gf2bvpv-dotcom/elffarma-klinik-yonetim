import * as React from 'react'
import { redDarkTheme, type Theme } from './theme'

const ThemeContext = React.createContext<Theme>(redDarkTheme)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Sabit tema: masaüstünün "Kırmızı" temasının KOYU modda aldığı halle
  // birebir eşleşen renkler (kullanıcı isteği, 2026-08-16 — önceden açık
  // zemin kullanılıyordu). app_settings.brand_theme'e bağlı seçilebilir
  // tema/renk modu senkronizasyonu ileride eklenebilir.
  return <ThemeContext.Provider value={redDarkTheme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return React.useContext(ThemeContext)
}
