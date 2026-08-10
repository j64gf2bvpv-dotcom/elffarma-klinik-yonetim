import * as React from 'react'
import { redLightTheme, type Theme } from './theme'

const ThemeContext = React.createContext<Theme>(redLightTheme)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Sabit tema: masaüstünün varsayılan "Kırmızı" temasıyla eşleşen açık/beyaz
  // zemin + kırmızı vurgu. app_settings.brand_theme'e bağlı seçilebilir
  // tema/renk modu senkronizasyonu ileride eklenebilir.
  return <ThemeContext.Provider value={redLightTheme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return React.useContext(ThemeContext)
}
