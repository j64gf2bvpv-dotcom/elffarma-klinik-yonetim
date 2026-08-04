/**
 * Bir emojiyi renkli yuvarlak köşeli bir zemin üzerine yerleştirip data URI
 * (SVG) olarak döndürür — gerçek fotoğraf/görsel yokken (örnek veri, ya da
 * ileride kullanıcı isterse) ağ isteği/harici asset gerektirmeden `<img>`/
 * AvatarImage'a doğrudan verilebilecek geçerli bir görsel kaynağı üretir.
 */
export function emojiImageDataUri(emoji: string, bgColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="28" fill="${bgColor}"/><text x="100" y="118" font-size="110" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
