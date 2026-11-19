import type { Product } from '@/types/database'

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
// Sohbetteki yazımlar katalog adına yaklaştırılır ("Mix XO" → mixo, "Elixir" → elisir, "Safir" → sappire)
const canon = (s: string) =>
  fold(s)
    .replace(/mix\s*xo/g, 'mixo')
    .replace(/elixir/g, 'elisir')
    .replace(/safir|sapphire|saphire/g, 'sappire')
    .replace(/filicia/g, 'fillicia')
    .replace(/fillyal/g, 'filyal')

/** Ürün satırını katalogdaki ürünle eşleştirir: ürün adının bütün kelimeleri satırda geçen, en çok kelimeli ürün */
export function matchProduct(text: string, products: Product[]): Product | undefined {
  const t = ` ${canon(text).replace(/[^a-z0-9]+/g, ' ')} `
  let best: { p: Product; score: number } | undefined
  for (const p of products) {
    const words = canon(p.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
    if (!words.length || !words.every((w) => t.includes(` ${w} `))) continue
    if (!best || words.length > best.score) best = { p, score: words.length }
  }
  return best?.p
}

