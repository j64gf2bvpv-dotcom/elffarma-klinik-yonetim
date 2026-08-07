import { formatHex } from 'culori'

/**
 * Masaüstündeki `src/features/appSettings/brandThemes.ts`'in BLACK_GOLD_VARS
 * sabitiyle birebir aynı OKLCH değerleri — tek fark, CSS custom property
 * yerine (RN'de CSS değişkeni yok) düz bir JS objesi olarak hesaplanıp
 * ThemeContext üzerinden dağıtılması. Faz 1 kapsamında sadece bu sabit
 * "Siyah / Gold (Premium)" teması kullanılıyor; masaüstündeki 10 temanın
 * tamamının seçilebilir hale gelmesi (brandThemeCssVars'ın hue/chromaScale'e
 * göre prosedürel ürettiği genel formül) Faz 6'ya bırakıldı — bkz. plan.
 */
const BLACK_GOLD_OKLCH = {
  primary: 'oklch(0.78 0.14 85)',
  primaryForeground: 'oklch(0.15 0.01 85)',
  secondary: 'oklch(0.2 0.02 85)',
  secondaryForeground: 'oklch(0.92 0.03 85)',
  muted: 'oklch(0.19 0.008 85)',
  mutedForeground: 'oklch(0.65 0.015 85)',
  accent: 'oklch(0.24 0.035 85)',
  accentForeground: 'oklch(0.94 0.03 85)',
  border: 'oklch(0.26 0.015 85)',
  input: 'oklch(0.26 0.015 85)',
  ring: 'oklch(0.78 0.14 85)',
  gold: 'oklch(0.78 0.14 85)',
  background: 'oklch(0.13 0.004 85)',
  foreground: 'oklch(0.93 0.012 85)',
  card: 'oklch(0.16 0.006 85)',
  cardForeground: 'oklch(0.93 0.012 85)',
  popover: 'oklch(0.16 0.006 85)',
  popoverForeground: 'oklch(0.93 0.012 85)',
  sidebar: 'oklch(0.1 0.006 85)',
  sidebarForeground: 'oklch(0.95 0.015 85)',
  sidebarBorder: 'oklch(0.2 0.012 85)',
  sidebarAccent: 'oklch(0.3 0.06 85)',
  sidebarAccentForeground: 'oklch(0.97 0.02 85)',
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

export const blackGoldTheme: Theme = {
  colors: {
    ...toHexMap(BLACK_GOLD_OKLCH),
    ...toHexMap(STATUS_OKLCH),
  } as ThemeColors,
  radius: { sm: RADIUS_MD - 4, md: RADIUS_MD, lg: RADIUS_MD + 4, xl: RADIUS_MD + 8 },
  spacing: (n: number) => n * 4,
  fontFamily: 'System',
  fontSizes: { xs: 12, sm: 13, base: 15, lg: 17, xl: 20, xxl: 24 },
}
