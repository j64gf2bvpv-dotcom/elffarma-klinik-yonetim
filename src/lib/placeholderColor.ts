const palette = [
  'oklch(0.55 0.18 250)',
  'oklch(0.55 0.15 155)',
  'oklch(0.6 0.18 55)',
  'oklch(0.55 0.2 300)',
  'oklch(0.6 0.19 15)',
  'oklch(0.55 0.12 195)',
  'oklch(0.65 0.16 85)',
]

/** Gerçek fotoğraf/görsel yoksa, isme göre sabit (rastgele değil, her seferinde
 * aynı) bir renk döndürür — liste boş/tek renkli görünmesin diye. */
export function placeholderColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}
