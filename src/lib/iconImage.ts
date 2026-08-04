export interface IconTone {
  from: string
  to: string
}

/** Uygulamanın Hızlı İşlemler ikonlarıyla (macOS Dock tarzı gradyan + cam
 * parlaklığı) aynı marka paleti — üretilen ikon görsellerinin geri kalan
 * arayüzle tutarlı, "kurumsal" durması için. */
export const iconTones: Record<string, IconTone> = {
  blue: { from: 'oklch(0.72 0.14 250)', to: 'oklch(0.5 0.19 258)' },
  green: { from: 'oklch(0.76 0.16 150)', to: 'oklch(0.54 0.15 155)' },
  purple: { from: 'oklch(0.7 0.15 300)', to: 'oklch(0.5 0.18 300)' },
  orange: { from: 'oklch(0.79 0.15 60)', to: 'oklch(0.62 0.18 45)' },
  red: { from: 'oklch(0.68 0.19 25)', to: 'oklch(0.5 0.2 23)' },
  pink: { from: 'oklch(0.72 0.17 10)', to: 'oklch(0.55 0.19 15)' },
  teal: { from: 'oklch(0.76 0.12 190)', to: 'oklch(0.55 0.12 195)' },
}

export interface IconGlyph {
  tag: 'path' | 'circle' | 'line' | 'rect'
  attrs: Record<string, string>
}

/** Lucide'ın kendi ikon setinden alınmış çizgisel (stroke, dolgu yok, yuvarlak
 * uç/köşe) glif tanımları — 24×24 viewBox uzayında, orijinal Lucide path
 * verisiyle birebir aynı. */
export const icons: Record<string, IconGlyph[]> = {
  user: [
    { tag: 'circle', attrs: { cx: '12', cy: '8', r: '5' } },
    { tag: 'path', attrs: { d: 'M20 21a8 8 0 0 0-16 0' } },
  ],
  syringe: [
    { tag: 'path', attrs: { d: 'm18 2 4 4' } },
    { tag: 'path', attrs: { d: 'm17 7 3-3' } },
    { tag: 'path', attrs: { d: 'M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5' } },
    { tag: 'path', attrs: { d: 'm9 11 4 4' } },
    { tag: 'path', attrs: { d: 'm5 19-3 3' } },
    { tag: 'path', attrs: { d: 'm14 4 6 6' } },
  ],
  droplet: [
    {
      tag: 'path',
      attrs: {
        d: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
      },
    },
  ],
  flaskConical: [
    {
      tag: 'path',
      attrs: {
        d: 'M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2',
      },
    },
    { tag: 'path', attrs: { d: 'M6.453 15h11.094' } },
    { tag: 'path', attrs: { d: 'M8.5 2h7' } },
  ],
  testTube: [
    { tag: 'path', attrs: { d: 'M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2' } },
    { tag: 'path', attrs: { d: 'M8.5 2h7' } },
    { tag: 'path', attrs: { d: 'M14.5 16h-5' } },
  ],
  presentation: [
    { tag: 'path', attrs: { d: 'M2 3h20' } },
    { tag: 'path', attrs: { d: 'M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3' } },
    { tag: 'path', attrs: { d: 'm7 21 5-5 5 5' } },
  ],
}

function glyphToSvg(g: IconGlyph): string {
  const attrStr = Object.entries(g.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  return `<${g.tag} ${attrStr}/>`
}

/**
 * Bir Lucide ikonunu, uygulamanın "premium" ikon diliyle (diyagonal gradyan
 * zemin + üstte ince cam parlaklığı + squircle köşe + hafif kenarlık, ikon
 * beyaz çizgi/stroke — dolgu yok) render edip data URI (SVG) olarak
 * döndürür. Gerçek fotoğraf/görsel yokken (örnek veri) ağ isteği/harici
 * asset gerektirmeden `<img>`/AvatarImage'a doğrudan verilebilir; renkli
 * emoji glifleri yerine geri kalan arayüzle birebir tutarlı çizgisel bir
 * görsel üretir.
 */
export function iconImageDataUri(glyphs: IconGlyph[], tone: IconTone): string {
  const iconSize = 108
  const scale = iconSize / 24
  const offset = (200 - iconSize) / 2
  const inner = glyphs.map(glyphToSvg).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="8%" y1="0%" x2="92%" y2="100%">
      <stop offset="0%" stop-color="${tone.from}"/>
      <stop offset="100%" stop-color="${tone.to}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="46" fill="url(#bg)"/>
  <rect width="200" height="200" rx="46" fill="url(#glass)"/>
  <rect x="1.5" y="1.5" width="197" height="197" rx="45" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
