import { matchProduct } from '@/features/doctorVisits/productMatch'
import type { Product } from '@/types/database'

/**
 * Kongrede hocalara verilen ürünler Excel'i (kullanıcının gönderdiği düzen, 2026-11-27):
 *   No | TARİH | (açıklama, ör. KAYIT KONAKLAMA ULAŞIM) | ADI SOYADI | SATIŞÇISI | ÜRÜNLER | SİPARİŞ | TESLİM EDİLEN | BORÇ ÜRÜN | (not, ör. BORÇ)
 * Bir doktorun ürünleri alt alta yazılır; No / tarih / açıklama / ad hücreleri yalnız ilk satırda doludur, altındaki boş
 * hücreler üstten devralınır. Boş ayırıcı satırlar atlanır. Adetler hücrede ne yazıyorsa o; boş hücre yorumlanmaz,
 * yalnız eksik olan biri öbür ikisinden hesaplanır (Borç = Sipariş − Teslim) ve satır "kontrol et" diye işaretlenir.
 */
export interface GivenLine {
  groupNo: number | null
  date: string | null
  description: string | null
  doctor: string
  rep: string | null
  productText: string
  product?: Product
  ordered: number
  delivered: number
  owed: number
  note: string | null
  /** Teslim / borç hücresi boştu, hesaplandı — kontrol edilmeli */
  check: string | null
  row: number
}

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').trim()

const text = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const t = text(v).replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Excel tarih seri numarası ya da "3/6/26", "17.06.2026" gibi gün/ay/yıl yazısı → yyyy-mm-dd */
function toDate(v: unknown): string | null {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel seri günü (1900 sistemi): 25569 = 1970-01-01
    const d = new Date(Math.round((v - 25569) * 864e5))
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  const m = text(v).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!m) return null
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
}

/** Katalogdaki yazımdan farklı yazılan ürün adları (ör. SAPPHIRE ↔ SAPPIRE) */
function matchGiven(name: string, products: Product[]): Product | undefined {
  const n = name.replace(/sapphire/gi, 'SAPPIRE').replace(/\d+\s*\+\s*\d+/g, ' ')
  const direct = matchProduct(n, products) ?? matchProduct(n.replace(/sappire/gi, 'SAPPHIRE'), products)
  if (direct) return direct
  // Kısa yazım: "FILLYAL STRONG" → katalogda tek bir "FILLYAL STRONG LINE" varsa o
  const words = fold(n).split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
  if (!words.length) return undefined
  const hits = products.filter((p) => {
    const pw = fold(p.name).split(/[^a-z0-9]+/)
    return words.every((w) => pw.includes(w))
  })
  return hits.length === 1 ? hits[0] : undefined
}

export function parseCongressGivenExcel(sheets: { name: string; rows: unknown[][] }[], products: Product[]): GivenLine[] {
  const out: GivenLine[] = []
  for (const { rows } of sheets) {
    const hi = rows.findIndex((r) => {
      const h = r.map((c) => fold(text(c)))
      return h.some((c) => /^urun/.test(c)) && h.some((c) => /sipari|teslim|ad[i]?\s*soyad/.test(c))
    })
    if (hi < 0) continue
    const head = rows[hi].map((c) => fold(text(c)))
    const find = (re: RegExp) => head.findIndex((h) => re.test(h))
    const dateCol = find(/tarih/)
    const nameCol = find(/ad[i]?\s*soyad|doktor|hoca|isim/)
    const prodCol = find(/^urun/)
    const ordCol = find(/sipari|alinan|adet/)
    const delCol = find(/teslim|verilen/)
    const owedCol = find(/borc|kalan/)
    const repCol = find(/satis|temsilci/)
    const known = [dateCol, nameCol, repCol, prodCol, ordCol, delCol, owedCol].filter((c) => c >= 0)
    const noCol = find(/^no$|^sira/) >= 0 ? find(/^no$|^sira/) : dateCol > 0 && head[dateCol - 1] === '' ? dateCol - 1 : -1
    // Tarih ile ad arasındaki başlıksız sütun = açıklama (KAYIT KONAKLAMA ULAŞIM); son bilinen sütundan sonrası = not
    const descCols = head.map((_, i) => i).filter((i) => i > Math.max(dateCol, noCol) && i < nameCol && !known.includes(i))
    const last = Math.max(...known)
    const width = Math.max(...rows.map((r) => r.length))
    const noteCols = [...Array(width).keys()].filter((i) => i > last || /^not|aciklama/.test(head[i] ?? ''))
    if (nameCol < 0 || prodCol < 0) continue

    let carry = { no: null as number | null, date: null as string | null, desc: null as string | null, doctor: '', rep: '' }
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i]
      const no = noCol >= 0 ? num(r[noCol]) : null
      if (no != null && no !== carry.no) carry = { no, date: null, desc: null, doctor: '', rep: '' }
      const d = dateCol >= 0 ? toDate(r[dateCol]) : null
      const desc = descCols.map((c) => text(r[c])).filter(Boolean).join(' ')
      if (d) {
        carry.date = d
        carry.desc = desc || null
      } else if (desc) carry.desc = desc
      const doc = text(r[nameCol])
      if (doc) carry.doctor = doc
      const rep = repCol >= 0 ? text(r[repCol]) : ''
      if (rep) carry.rep = rep
      const prod = text(r[prodCol])
      if (!prod) continue
      const o = num(r[ordCol]), dl = num(r[delCol]), ow = num(r[owedCol])
      if (o == null && dl == null && ow == null) continue
      let ordered = o ?? (dl ?? 0) + (ow ?? 0)
      let delivered = dl ?? (ow != null ? Math.max(0, ordered - ow) : 0)
      let owed = ow ?? Math.max(0, ordered - delivered)
      ordered = Math.max(0, Math.round(ordered))
      delivered = Math.max(0, Math.round(delivered))
      owed = Math.max(0, Math.round(owed))
      const check =
        dl == null && ow == null
          ? 'Teslim edilen ve borç boş — hiç teslim edilmedi sayıldı'
          : dl == null
            ? 'Teslim edilen boş — sipariş − borç olarak hesaplandı'
            : ow == null
              ? 'Borç boş — sipariş − teslim olarak hesaplandı'
              : ordered !== delivered + owed
                ? 'Sipariş, teslim + borç ile tutmuyor'
                : null
      out.push({
        groupNo: carry.no,
        date: carry.date,
        description: carry.desc,
        doctor: carry.doctor || '(isimsiz)',
        rep: carry.rep || null,
        productText: prod,
        product: matchGiven(prod, products),
        ordered,
        delivered,
        owed,
        note: noteCols.map((c) => text(r[c])).filter(Boolean).join(' · ') || null,
        check,
        row: i + 1,
      })
    }
  }
  return out
}

export { matchGiven }
