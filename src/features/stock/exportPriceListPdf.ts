import { jsPDF } from 'jspdf'
import { saveAs } from 'file-saver'

import { registerTurkishFont } from '@/lib/exportData'
import logoWhite from '@/assets/brand/elffarma-logo-white.png'
import type { Product } from '@/types/database'

/**
 * Stok > "Fiyat Listesi PDF" — kullanıcının kendi hazırladığı 2026 fiyat
 * listesi PDF'inin düzeninde (kullanıcı isteği, 2026-10-02: "stok kısmında
 * dışarı aktar olsun, PDF olarak tüm ekran A4 sayfasına sığacak şekilde benim
 * sana attığım PDF gibi çıktı versin"):
 *  - her marka grubu (Dermakor, Swiss) kendi A4 sayfasında, tek sayfaya sığar
 *    (satır yüksekliği ürün sayısına göre küçülür)
 *  - başlık "… ÜRÜNLERİ <yıl> FİYAT LİSTESİ (FATURASIZ)" — parantez kırmızı
 *  - sütunlar: GÖRSEL | ÜRÜN (ad + boyut) | KDV DAHİL fiyat | KAMPANYA
 *  - altta kırmızı Elffarma logosu
 * Görseller CORS'suz sitelerde olabildiği için Electron ana sürecinden
 * (electronAPI.fetchImageDataUrl) indirilir; alınamayan görselin hücresi boş kalır.
 */

export type PriceListKind = 'uninvoiced' | 'invoiced'

const RED: [number, number, number] = [200, 30, 36]
const GRID: [number, number, number] = [40, 40, 44]
const HEAD_BG: [number, number, number] = [218, 218, 222]

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (res.ok) {
      const blob = await res.blob()
      return await new Promise((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result as string)
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(blob)
      })
    }
  } catch {
    // CORS yok — ana süreç üzerinden dene
  }
  return (await window.electronAPI?.fetchImageDataUrl?.(url)) ?? null
}

/** Görseli beyaz zeminli JPEG'e çevirir (PNG şeffaflığı + jsPDF uyumu) ve boyutlarını döner. */
async function loadImage(url: string | null): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null
  const src = await toDataUrl(url)
  if (!src) return null
  const img = new Image()
  img.src = src
  try {
    await img.decode()
  } catch {
    return null
  }
  const max = 600
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { data: canvas.toDataURL('image/jpeg', 0.9), w: canvas.width, h: canvas.height }
}

/** Beyaz logoyu kırmızıya boyar (beyaz kâğıt üzerinde görünsün diye). */
async function redLogo(): Promise<{ data: string; w: number; h: number } | null> {
  const img = new Image()
  img.src = logoWhite
  try {
    await img.decode()
  } catch {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = `rgb(${RED.join(',')})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return { data: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
}

function formatTl(value: number | null): string {
  if (value == null) return '—'
  return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`
}

interface Group {
  title: string
  products: Product[]
}

function fitImage(doc: jsPDF, img: { data: string; w: number; h: number }, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / img.w, h / img.h)
  const dw = img.w * r
  const dh = img.h * r
  doc.addImage(img.data, 'JPEG', x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/** Metni verilen genişliğe sığacak şekilde satırlara böler ve gerekiyorsa yazı boyutunu küçültür. */
function fitLines(doc: jsPDF, lines: string[], maxW: number, maxH: number, start: number, min: number) {
  let size = start
  for (; size >= min; size -= 0.5) {
    doc.setFontSize(size)
    const wrapped = lines.flatMap((l) => doc.splitTextToSize(l, maxW) as string[])
    if (wrapped.length * size * 1.25 <= maxH) return { size, wrapped }
  }
  doc.setFontSize(min)
  return { size: min, wrapped: lines.flatMap((l) => doc.splitTextToSize(l, maxW) as string[]) }
}

export async function exportPriceListPdf(products: Product[], kind: PriceListKind) {
  const year = new Date().getFullYear()
  // Fiyatı girilmemiş ürün listeye hiç alınmaz (faturasızda satış fiyatına düşmek yanıltıcıydı)
  const priceOf = (p: Product) => (kind === 'uninvoiced' ? p.unit_price_uninvoiced : p.unit_price)
  const active = [...products]
    .filter((p) => p.is_active !== false && priceOf(p) != null && Number(priceOf(p)) > 0)
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'tr'))
  const groups: Group[] = [
    { title: `DERMAKOR ÜRÜNLERİ ${year} FİYAT LİSTESİ`, products: active.filter((p) => p.brand_line === 'dermakor') },
    { title: `SWISS (İSVİÇRE) ÜRÜNLERİ ${year} FİYAT LİSTESİ`, products: active.filter((p) => p.brand_line === 'swiss') },
  ].filter((g) => g.products.length > 0)
  if (groups.length === 0) throw new Error('Dermakor ya da Swiss grubunda ürün yok')

  const suffix = kind === 'uninvoiced' ? '(FATURASIZ)' : '(FATURALI)'

  const [logo, ...images] = await Promise.all([redLogo(), ...groups.flatMap((g) => g.products.map((p) => loadImage(p.image_url)))])
  const imageById = new Map<string, { data: string; w: number; h: number } | null>()
  groups.flatMap((g) => g.products).forEach((p, i) => imageById.set(p.id, images[i]))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  registerTurkishFont(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 36
  const tableW = pageW - margin * 2
  const cols = [0.15, 0.4, 0.2, 0.25].map((f) => f * tableW)
  const xs = cols.reduce<number[]>((acc, w, i) => [...acc, acc[i] + w], [margin])

  groups.forEach((group, gi) => {
    if (gi > 0) doc.addPage()

    // Başlık: metin siyah, "(FATURASIZ)" kırmızı, ortalı
    doc.setFont('NotoSans', 'bold')
    let titleSize = 17
    doc.setFontSize(titleSize)
    while (doc.getTextWidth(`${group.title} ${suffix}`) > tableW && titleSize > 11) doc.setFontSize(--titleSize)
    const wTitle = doc.getTextWidth(group.title + ' ')
    const wSuffix = doc.getTextWidth(suffix)
    const tx = (pageW - wTitle - wSuffix) / 2
    doc.setTextColor(15)
    doc.text(group.title + ' ', tx, 62)
    doc.setTextColor(...RED)
    doc.text(suffix, tx + wTitle, 62)

    // Tablo
    const top = 86
    const headH = 22
    const bottomReserve = logo ? 90 : 40
    const n = group.products.length
    const rowH = Math.min(92, (pageH - top - headH - bottomReserve) / n)

    doc.setFillColor(...HEAD_BG)
    doc.rect(margin, top, tableW, headH, 'F')
    doc.setTextColor(20)
    doc.setFontSize(8.5)
    ;['GÖRSEL', 'ÜRÜN', 'KDV DAHİL', 'KAMPANYA'].forEach((h, i) => {
      doc.text(h, xs[i] + cols[i] / 2, top + headH / 2 + 3, { align: 'center' })
    })

    group.products.forEach((p, ri) => {
      const y = top + headH + ri * rowH
      const img = imageById.get(p.id)
      if (img) fitImage(doc, img, xs[0] + 4, y + 4, cols[0] - 8, rowH - 8)

      // Ürün: ad (kalın) + boyut
      const name = p.package_size ? `${p.name} ${p.package_size}` : p.name
      doc.setFont('NotoSans', 'normal')
      doc.setTextColor(20)
      const nameFit = fitLines(doc, [name], cols[1] - 16, rowH - 8, Math.min(11, rowH / 3.2), 6.5)
      const nameBlock = nameFit.wrapped.length * nameFit.size * 1.25
      nameFit.wrapped.forEach((line, li) =>
        doc.text(line, xs[1] + cols[1] / 2, y + (rowH - nameBlock) / 2 + nameFit.size * (li + 0.85) * 1.25 - nameFit.size * 0.2, { align: 'center' }),
      )

      // Fiyat
      doc.setFontSize(Math.min(11, rowH / 3.2))
      doc.text(formatTl(priceOf(p)), xs[2] + cols[2] / 2, y + rowH / 2 + 3.5, { align: 'center' })

      // Kampanya: kademeler alt alta
      const parts = (p.campaign ?? '').split(/\s*·\s*/).filter(Boolean)
      if (parts.length > 0) {
        const fit = fitLines(doc, parts, cols[3] - 10, rowH - 8, Math.min(9, rowH / 3.6), 5.5)
        const block = fit.wrapped.length * fit.size * 1.25
        fit.wrapped.forEach((line, li) =>
          doc.text(line, xs[3] + cols[3] / 2, y + (rowH - block) / 2 + fit.size * (li + 0.85) * 1.25 - fit.size * 0.2, { align: 'center' }),
        )
      }
    })

    // Izgara çizgileri
    doc.setDrawColor(...GRID)
    doc.setLineWidth(0.8)
    const tableBottom = top + headH + n * rowH
    doc.rect(margin, top, tableW, tableBottom - top)
    for (let ri = 0; ri <= n; ri++) doc.line(margin, top + headH + ri * rowH, margin + tableW, top + headH + ri * rowH)
    for (let ci = 1; ci < cols.length; ci++) doc.line(xs[ci], top, xs[ci], tableBottom)

    // Alt logo
    if (logo) {
      const lw = 150
      const lh = (logo.h / logo.w) * lw
      doc.addImage(logo.data, 'PNG', (pageW - lw) / 2, pageH - 46 - lh, lw, lh)
    }
  })

  const fileName = `elffarma-${year}-fiyat-listesi-${kind === 'uninvoiced' ? 'faturasiz' : 'faturali'}.pdf`
  saveAs(doc.output('blob'), fileName)
}
