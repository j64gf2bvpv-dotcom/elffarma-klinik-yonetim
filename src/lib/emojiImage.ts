export interface EmojiTone {
  from: string
  to: string
}

/** Uygulamanın Hızlı İşlemler ikonlarıyla (macOS Dock tarzı gradyan + cam
 * parlaklığı) aynı marka paleti — emoji görsellerinin geri kalan arayüzle
 * tutarlı, "kurumsal" durması için. */
export const emojiTones: Record<string, EmojiTone> = {
  blue: { from: 'oklch(0.72 0.14 250)', to: 'oklch(0.5 0.19 258)' },
  green: { from: 'oklch(0.76 0.16 150)', to: 'oklch(0.54 0.15 155)' },
  purple: { from: 'oklch(0.7 0.15 300)', to: 'oklch(0.5 0.18 300)' },
  orange: { from: 'oklch(0.79 0.15 60)', to: 'oklch(0.62 0.18 45)' },
  red: { from: 'oklch(0.68 0.19 25)', to: 'oklch(0.5 0.2 23)' },
  pink: { from: 'oklch(0.72 0.17 10)', to: 'oklch(0.55 0.19 15)' },
  teal: { from: 'oklch(0.76 0.12 190)', to: 'oklch(0.55 0.12 195)' },
}

/**
 * Bir emojiyi, uygulamanın "premium" ikon diliyle (diyagonal gradyan zemin +
 * üstte ince cam parlaklığı + squircle köşe + hafif kenarlık) render edip
 * data URI (SVG) olarak döndürür — gerçek fotoğraf/görsel yokken (örnek
 * veri) ağ isteği/harici asset gerektirmeden `<img>`/AvatarImage'a doğrudan
 * verilebilecek, düz tek renkli bir "sticker" yerine geri kalan arayüzle
 * tutarlı bir görsel üretir.
 */
export function emojiImageDataUri(emoji: string, tone: EmojiTone): string {
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
  <text x="100" y="118" font-size="100" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
