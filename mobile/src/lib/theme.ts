import { formatHex } from 'culori'

/**
 * Masaüstündeki `src/features/appSettings/brandThemes.ts`'in `brandThemeCssVars`
 * fonksiyonunun hue=23 (Kırmızı, defaultBrandTheme), chromaScale=1, mode='light'
 * için ürettiği değerlerle birebir aynı OKLCH değerleri — tek fark, CSS custom
 * property yerine (RN'de CSS değişkeni yok) düz bir JS objesi olarak
 * hesaplanıp ThemeContext üzerinden dağıtılması. Mobilin sabit teması
 * masaüstünün varsayılan "Kırmızı" temasıyla (beyaz zemin + kırmızı vurgu)
 * eşleşsin diye Siyah/Gold'dan buna değiştirildi (kullanıcı isteği, 2026-08-10).
 */
const RED_LIGHT_OKLCH = {
  primary: 'oklch(0.5 0.2 23)',
  primaryForeground: 'oklch(0.99 0.003 23)',
  secondary: 'oklch(0.95 0.03 23)',
  secondaryForeground: 'oklch(0.32 0.12 23)',
  muted: 'oklch(0.96 0.008 23)',
  mutedForeground: 'oklch(0.48 0.02 23)',
  accent: 'oklch(0.93 0.05 23)',
  accentForeground: 'oklch(0.3 0.14 23)',
  border: 'oklch(0.9 0.015 23)',
  input: 'oklch(0.9 0.015 23)',
  ring: 'oklch(0.5 0.2 23)',
  gold: 'oklch(0.5 0.2 23)',
  background: 'oklch(0.99 0.002 23)',
  foreground: 'oklch(0.2 0.02 23)',
  card: 'oklch(1 0 0)',
  cardForeground: 'oklch(0.2 0.02 23)',
  popover: 'oklch(1 0 0)',
  popoverForeground: 'oklch(0.2 0.02 23)',
  sidebar: 'oklch(0.32 0.19 23)',
  sidebarForeground: 'oklch(0.99 0.005 23)',
  sidebarBorder: 'oklch(0.4 0.19 23)',
  sidebarAccent: 'oklch(0.42 0.19 23)',
  sidebarAccentForeground: 'oklch(1 0 0)',
} as const

/**
 * Aynı formülün (`brandThemeCssVars`, hue=23, chromaScale=1) mode='dark'
 * dalı için birebir aynı OKLCH değerleri — masaüstünde koyu mod açıkken
 * "Kırmızı" temasının aldığı hali. Kullanıcı isteğiyle (2026-08-16) mobil
 * artık varsayılan olarak bunu kullanıyor (bkz. ThemeContext.tsx).
 */
const RED_DARK_OKLCH = {
  primary: 'oklch(0.62 0.2 23)',
  primaryForeground: 'oklch(0.99 0.003 23)',
  secondary: 'oklch(0.27 0.03 23)',
  secondaryForeground: 'oklch(0.92 0.02 23)',
  muted: 'oklch(0.25 0.015 23)',
  mutedForeground: 'oklch(0.68 0.015 23)',
  accent: 'oklch(0.32 0.07 23)',
  accentForeground: 'oklch(0.93 0.02 23)',
  border: 'oklch(0.32 0.02 23)',
  input: 'oklch(0.32 0.02 23)',
  ring: 'oklch(0.62 0.2 23)',
  gold: 'oklch(0.62 0.2 23)',
  background: 'oklch(0.16 0.015 23)',
  foreground: 'oklch(0.95 0.008 23)',
  card: 'oklch(0.2 0.018 23)',
  cardForeground: 'oklch(0.95 0.008 23)',
  popover: 'oklch(0.2 0.018 23)',
  popoverForeground: 'oklch(0.95 0.008 23)',
  sidebar: 'oklch(0.2 0.04 23)',
  sidebarForeground: 'oklch(0.96 0.008 23)',
  sidebarBorder: 'oklch(0.28 0.05 23)',
  sidebarAccent: 'oklch(0.32 0.1 23)',
  sidebarAccentForeground: 'oklch(1 0 0)',
} as const

// Durum renkleri marka temasından bağımsız (masaüstünde de öyle — index.css'de
// success/warning/destructive her zaman aynı).
const STATUS_OKLCH = {
  destructive: 'oklch(0.62 0.21 25)',
  destructiveForeground: 'oklch(0.98 0.01 25)',
  success: 'oklch(0.6 0.14 155)',
  successForeground: 'oklch(0.98 0.01 155)',
  warning: 'oklch(0.75 0.15 75)',
  warningForeground: 'oklch(0.2 0.03 75)',
} as const

function toHexMap<T extends Record<string, string>>(map: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>
  for (const key in map) out[key] = formatHex(map[key]) ?? '#000000'
  return out
}

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  success: string
  successForeground: string
  warning: string
  warningForeground: string
  border: string
  input: string
  ring: string
  gold: string
  sidebar: string
  sidebarForeground: string
  sidebarBorder: string
  sidebarAccent: string
  sidebarAccentForeground: string
}

export interface Theme {
  colors: ThemeColors
  // --radius: 0.65rem taban (1rem = 16px, masaüstündeki tarayıcı varsayılanıyla
  // aynı kabul) + index.css'deki calc() türevi sm/lg/xl ölçekleri.
  radius: { sm: number; md: number; lg: number; xl: number }
  spacing: (n: number) => number
  fontFamily: string
  fontSizes: { xs: number; sm: number; base: number; lg: number; xl: number; xxl: number }
}

const RADIUS_MD = 0.65 * 16 // 10.4

export const redLightTheme: Theme = {
  colors: {
    ...toHexMap(RED_LIGHT_OKLCH),
    ...toHexMap(STATUS_OKLCH),
  } as ThemeColors,
  radius: { sm: RADIUS_MD - 4, md: RADIUS_MD, lg: RADIUS_MD + 4, xl: RADIUS_MD + 8 },
  spacing: (n: number) => n * 4,
  fontFamily: 'System',
  fontSizes: { xs: 12, sm: 13, base: 15, lg: 17, xl: 20, xxl: 24 },
}

export const redDarkTheme: Theme = {
  colors: {
    ...toHexMap(RED_DARK_OKLCH),
    ...toHexMap(STATUS_OKLCH),
  } as ThemeColors,
  radius: { sm: RADIUS_MD - 4, md: RADIUS_MD, lg: RADIUS_MD + 4, xl: RADIUS_MD + 8 },
  spacing: (n: number) => n * 4,
  fontFamily: 'System',
  fontSizes: { xs: 12, sm: 13, base: 15, lg: 17, xl: 20, xxl: 24 },
}
