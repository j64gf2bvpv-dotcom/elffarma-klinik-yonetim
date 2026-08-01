export interface BrandTheme {
  id: string
  label: string
  hue: number
  chromaScale?: number
  /** Özel, tek-renk formülüyle üretilemeyen sabit paletler için (örn. siyah/gold). */
  special?: 'black_gold'
}

export const blackGoldTheme: BrandTheme = {
  id: 'black_gold',
  label: 'Siyah / Gold (Premium — Varsayılan)',
  hue: 85,
  chromaScale: 1,
  special: 'black_gold',
}

export const brandThemes: BrandTheme[] = [
  blackGoldTheme,
  { id: 'red', label: 'Kırmızı', hue: 23 },
  { id: 'blue', label: 'Mavi', hue: 250 },
  { id: 'sky', label: 'Gök Mavisi', hue: 230 },
  { id: 'teal', label: 'Turkuaz', hue: 195 },
  { id: 'green', label: 'Yeşil', hue: 145 },
  { id: 'purple', label: 'Mor', hue: 300 },
  { id: 'pink', label: 'Pembe', hue: 345 },
  { id: 'amber', label: 'Amber', hue: 70 },
  { id: 'white', label: 'Beyaz / Nötr', hue: 23, chromaScale: 0 },
]

export type ColorMode = 'light' | 'dark'

const BLACK_GOLD_VARS: Record<string, string> = {
  '--primary': 'oklch(0.78 0.14 85)',
  '--primary-foreground': 'oklch(0.15 0.01 85)',
  '--secondary': 'oklch(0.2 0.02 85)',
  '--secondary-foreground': 'oklch(0.92 0.03 85)',
  '--muted': 'oklch(0.19 0.008 85)',
  '--muted-foreground': 'oklch(0.65 0.015 85)',
  '--accent': 'oklch(0.24 0.035 85)',
  '--accent-foreground': 'oklch(0.94 0.03 85)',
  '--border': 'oklch(0.26 0.015 85)',
  '--input': 'oklch(0.26 0.015 85)',
  '--ring': 'oklch(0.78 0.14 85)',
  '--gold': 'oklch(0.78 0.14 85)',
  '--chart-1': 'oklch(0.78 0.14 85)',
  '--sidebar': 'oklch(0.1 0.006 85)',
  '--sidebar-foreground': 'oklch(0.95 0.015 85)',
  '--sidebar-border': 'oklch(0.2 0.012 85)',
  '--sidebar-accent': 'oklch(0.3 0.06 85)',
  '--sidebar-accent-foreground': 'oklch(0.97 0.02 85)',
  '--background': 'oklch(0.13 0.004 85)',
  '--foreground': 'oklch(0.93 0.012 85)',
  '--card': 'oklch(0.16 0.006 85)',
  '--card-foreground': 'oklch(0.93 0.012 85)',
  '--popover': 'oklch(0.16 0.006 85)',
  '--popover-foreground': 'oklch(0.93 0.012 85)',
}

export function brandThemeCssVars(
  hue: number,
  chromaScale = 1,
  mode: ColorMode = 'light',
  special?: 'black_gold',
): Record<string, string> {
  const c = (base: number) => (base * chromaScale).toFixed(4)

  if (special === 'black_gold') {
    return BLACK_GOLD_VARS
  }

  if (mode === 'dark') {
    return {
      '--primary': `oklch(0.62 ${c(0.2)} ${hue})`,
      '--primary-foreground': `oklch(0.99 ${c(0.003)} ${hue})`,
      '--secondary': `oklch(0.27 ${c(0.03)} ${hue})`,
      '--secondary-foreground': `oklch(0.92 ${c(0.02)} ${hue})`,
      '--muted': `oklch(0.25 ${c(0.015)} ${hue})`,
      '--muted-foreground': `oklch(0.68 ${c(0.015)} ${hue})`,
      '--accent': `oklch(0.32 ${c(0.07)} ${hue})`,
      '--accent-foreground': `oklch(0.93 ${c(0.02)} ${hue})`,
      '--border': `oklch(0.32 ${c(0.02)} ${hue})`,
      '--input': `oklch(0.32 ${c(0.02)} ${hue})`,
      '--ring': `oklch(0.62 ${c(0.2)} ${hue})`,
      '--gold': `oklch(0.62 ${c(0.2)} ${hue})`,
      '--chart-1': `oklch(0.62 ${c(0.2)} ${hue})`,
      '--sidebar': `oklch(0.2 ${c(0.04)} ${hue})`,
      '--sidebar-foreground': `oklch(0.96 ${c(0.008)} ${hue})`,
      '--sidebar-border': `oklch(0.28 ${c(0.05)} ${hue})`,
      '--sidebar-accent': `oklch(0.32 ${c(0.1)} ${hue})`,
      '--sidebar-accent-foreground': `oklch(1 0 0)`,
      '--background': `oklch(0.16 ${c(0.015)} ${hue})`,
      '--foreground': `oklch(0.95 ${c(0.008)} ${hue})`,
      '--card': `oklch(0.2 ${c(0.018)} ${hue})`,
      '--card-foreground': `oklch(0.95 ${c(0.008)} ${hue})`,
      '--popover': `oklch(0.2 ${c(0.018)} ${hue})`,
      '--popover-foreground': `oklch(0.95 ${c(0.008)} ${hue})`,
    }
  }

  return {
    '--primary': `oklch(0.5 ${c(0.2)} ${hue})`,
    '--primary-foreground': `oklch(0.99 ${c(0.003)} ${hue})`,
    '--secondary': `oklch(0.95 ${c(0.03)} ${hue})`,
    '--secondary-foreground': `oklch(0.32 ${c(0.12)} ${hue})`,
    '--muted': `oklch(0.96 ${c(0.008)} ${hue})`,
    '--muted-foreground': `oklch(0.48 ${c(0.02)} ${hue})`,
    '--accent': `oklch(0.93 ${c(0.05)} ${hue})`,
    '--accent-foreground': `oklch(0.3 ${c(0.14)} ${hue})`,
    '--border': `oklch(0.9 ${c(0.015)} ${hue})`,
    '--input': `oklch(0.9 ${c(0.015)} ${hue})`,
    '--ring': `oklch(0.5 ${c(0.2)} ${hue})`,
    '--gold': `oklch(0.5 ${c(0.2)} ${hue})`,
    '--chart-1': `oklch(0.5 ${c(0.2)} ${hue})`,
    '--sidebar': `oklch(0.32 ${c(0.19)} ${hue})`,
    '--sidebar-foreground': `oklch(0.99 ${c(0.005)} ${hue})`,
    '--sidebar-border': `oklch(0.4 ${c(0.19)} ${hue})`,
    '--sidebar-accent': `oklch(0.42 ${c(0.19)} ${hue})`,
    '--sidebar-accent-foreground': `oklch(1 0 0)`,
    '--background': `oklch(0.99 ${c(0.002)} ${hue})`,
    '--foreground': `oklch(0.2 ${c(0.02)} ${hue})`,
    '--card': `oklch(1 0 0)`,
    '--card-foreground': `oklch(0.2 ${c(0.02)} ${hue})`,
    '--popover': `oklch(1 0 0)`,
    '--popover-foreground': `oklch(0.2 ${c(0.02)} ${hue})`,
  }
}

/**
 * Marka renginden BAĞIMSIZ, sadece ana içerik arkaplanını (ve kart/popover
 * yüzeylerini) hedefleyen renk paleti — kullanıcı "Arkaplan Rengi" panelinden
 * özel bir ton seçtiğinde brandThemeCssVars'ın ürettiği değerlerin ÜZERİNE
 * yazılır.
 */
export function backgroundCssVars(hue: number, chromaScale = 1, mode: ColorMode = 'light'): Record<string, string> {
  const c = (base: number) => (base * chromaScale).toFixed(4)
  if (mode === 'dark') {
    return {
      '--background': `oklch(0.16 ${c(0.015)} ${hue})`,
      '--card': `oklch(0.2 ${c(0.018)} ${hue})`,
      '--popover': `oklch(0.2 ${c(0.018)} ${hue})`,
    }
  }
  return {
    '--background': `oklch(0.99 ${c(0.006)} ${hue})`,
    '--card': `oklch(1 0 0)`,
    '--popover': `oklch(1 0 0)`,
  }
}

/**
 * Marka renginden BAĞIMSIZ, sadece sol kenar çubuğunu (yan panel) hedefleyen
 * renk paleti — kullanıcı "Kenar Çubuğu Rengi" panelinden özel bir ton
 * seçtiğinde brandThemeCssVars'ın ürettiği değerlerin ÜZERİNE yazılır.
 */
export function sidebarCssVars(hue: number, chromaScale = 1, mode: ColorMode = 'light'): Record<string, string> {
  const c = (base: number) => (base * chromaScale).toFixed(4)

  // "Beyaz / Nötr" (chromaScale 0) seçildiğinde kenar çubuğu koyu-ama-gri
  // kalmak yerine GERÇEKTEN beyaz/açık olsun — metin de buna göre koyu
  // renge dönsün (aksi halde beyaz zemin üzerinde beyaz yazı okunmaz olur).
  if (chromaScale === 0) {
    return {
      '--sidebar': 'oklch(0.99 0.002 0)',
      '--sidebar-foreground': 'oklch(0.2 0.01 0)',
      '--sidebar-border': 'oklch(0.9 0.008 0)',
      '--sidebar-accent': 'oklch(0.94 0.006 0)',
      '--sidebar-accent-foreground': 'oklch(0.2 0.01 0)',
    }
  }

  if (mode === 'dark') {
    return {
      '--sidebar': `oklch(0.2 ${c(0.04)} ${hue})`,
      '--sidebar-border': `oklch(0.28 ${c(0.05)} ${hue})`,
      '--sidebar-accent': `oklch(0.32 ${c(0.1)} ${hue})`,
    }
  }
  return {
    '--sidebar': `oklch(0.32 ${c(0.19)} ${hue})`,
    '--sidebar-border': `oklch(0.4 ${c(0.19)} ${hue})`,
    '--sidebar-accent': `oklch(0.42 ${c(0.19)} ${hue})`,
  }
}
