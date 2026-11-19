import { format, subDays } from 'date-fns'

/**
 * WhatsApp sohbetindeki SATIŞLARI çıkarır (kullanıcı isteği, 2026-11-19: "satış personelinin hangi ürünü ne kadar
 * sattığı, hangi doktora sattığı otomatik programa günlük işlesin; doktor ve numara kısmının altında hangi doktora
 * ne satıldı görünsün; diğer konuşmaları alma, sadece satılan, fiyatı yazılan ürünleri karıştırmadan ekle").
 *
 * Yalnız temsilcinin kendi mesajları okunur. Satış satırı = fiyatlı ürün satırı ("5 paket Bvrs pl 35.000₺ KDV dahil",
 * "Ürün: BVRS PL / Miktar: 1 Paket / Toplam Tutar: 39.000 TL"). Hedef/forecast, teklif, fiyat talebi, "verilecek",
 * bakiye/ödeme/kart/IBAN satırları ALINMAZ. Doktor: mesajdaki "Dr …" adı; yoksa temsilcinin hemen önceki (15 dk)
 * mesajlarındaki tek satırlık kişi adı ("ALİ EREN AKBAY"). Bulunamazsa ad boş kalır, önizlemede elle yazılır.
 */

export interface SaleItem {
  text: string
  amount: number | null
}
export interface VisitSale {
  items: SaleItem[]
  total: number | null
  /** "Ürünler gelince gönderilecek" — sipariş alındı, ürün henüz gönderilmedi */
  pending?: boolean
  /** Stoktan düşme teyidi: 'done' düşüldü (satış kaydı açıldı), 'skipped' düşülmesin dendi */
  stock?: 'done' | 'skipped'
}
export interface ChatSaleRow {
  date: string
  name: string
  phone: string
  sale: VisitSale
}

interface Msg {
  date: string
  minutes: number
  sender: string
  lines: string[]
}

const MESSAGE_RE =
  /^\[?(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?(?:\s*([AaPp])[Mm])?\]?\s*(?:-\s*)?([^:]{1,60}?):\s?(.*)$/

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')

const PRICE_RE = /(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?(?:\.0{2})?\s*(?:₺|tl\b|try\b)/i
const PRODUCT_RE =
  /bvrs|fill?ic[iı]a|f[iı]ll?yal|mix\s?xo|mixo|sap+h?ire|safir|pdrn|vitapep|elis[iı]r|elix[iı]r|\bstar\b|hamo|\bamc\b|somon|\bdna\b|\blux\b|\bcol\b|\bbio\b|dolgu|mezoterapi|exosome|ekzozom/i
const QTY_RE = /^\s*\d+\s*(?:\+\s*\d+\s*)?(?:x\s*)?(?:tam\s+)?(?:paket|kutu|adet|flakon|ad\.?|kt\.?)\b/i
// Satış olmayan fiyat cümleleri (hedef, teklif, ödeme, bakiye, gelecekte verilecek…)
const NOT_SALE_RE =
  /hedef|forecast|potansiyel|tutar[ıi]nda|teklif|talep|bekleniyor|ver[iı]c[eə]k|veril[iı]?[cç]ek|verilecek|alacak\b|planlan|bakiye|[öo]deme|kart[ıi]?nd|iban|indirim|zam\b|ortalama|civar[ıi]|den\s*$|dan\s*$/i
// Fiyatsız sipariş satırı: sipariş/satış fiili şart ("1 kutu BVRS STAR AŞISI SİPARİŞİMDİR", "10 paket Bvrs satıldı")
const ORDER_RE = /sipariş|alındı|aldı\b|satıldı|satış yapıldı|verildi|vade|gönderil|verilecek/i
// Henüz sipariş olmayan niyet/öneri cümleleri
const FUTURE_RE = /geçecek|geçicek|geçecek|vericek|verecek|düşünüyor|değerlendir|planl|talep|fiyat ver|teklif|kaldı|azal|bitince|alacak|alıcak|istiyor|bilgilendirme|deneyecek|denemek/i
// Ürün gelince gönderilecek (bekleyen sipariş)
const PENDING_RE = /gel(?:ince|diğinde|diğin\s*de|dikten sonra|ir gelmez)|stoğa gir|stoklara gir|stok(?:a|lara)? giriş|ürün bekliyor|bekliyor(?!um|uz|sun)|kargoya\s+çıkar/i
const QTY_PHRASE_RE = /(\d+)\s*(?:\+\s*(\d+)\s*)?(paket|kutu|adet|flakon|ad\.?|kt\.?)?/i
const CITY_RE = /^(alanya|manavgat|antalya|ankara|istanbul|adana|mersin|konya|kayseri|eskişehir|hatay|bursa|izmir|kadıköy|çankaya|antakya|gaziantep|kocaeli|sakarya|adapazarı|ceyhan|tarsus|osmaniye|iskenderun)$/
const LOCATION_WORDS = /masterclass|master class|adana|istanbul|ankara|eskişehir|eskisehir|hatay|mah\.?|sok|cad|apt|clinic|klinik|kongre|ödeme|kart|iban|vergi|fatura|teşekkür|merhaba|günaydın|uygun|tamam|hocam|burcu|atınç|elif/i

function toDate(d: string, m: string, y: string): string | null {
  let day = +d
  let month = +m
  if (month > 12 && day <= 12) [day, month] = [month, day]
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  const year = y.length === 2 ? 2000 + +y : +y
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function splitMessages(text: string): Msg[] {
  const out: Msg[] = []
  for (const raw of text.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/ /g, ' ').split(/\r?\n/)) {
    const m = raw.match(MESSAGE_RE)
    const date = m && toDate(m[1], m[2], m[3])
    if (m && date) {
      let hour = +m[4]
      if (m[6]) hour = (hour % 12) + (/p/i.test(m[6]) ? 12 : 0)
      const visitDate = hour < 5 ? format(subDays(new Date(`${date}T12:00:00`), 1), 'yyyy-MM-dd') : date
      out.push({ date: visitDate, minutes: hour * 60 + +m[5], sender: m[7].trim(), lines: [m[8]] })
    } else if (out.length) out[out.length - 1].lines.push(raw)
  }
  return out
}

export function parseAmount(raw: string): number | null {
  const m = raw.match(PRICE_RE)
  if (!m) return null
  const n = Number(m[1].replace(/[.\s]/g, '') + (m[2] ? `.${m[2]}` : ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

const cleanLine = (l: string) =>
  l
    .replace(/<?\s*bu mesaj düzenlendi\s*>?/gi, '')
    .replace(/(?:görüntü|kişi kartı|belge|video|ses|çıkartma|gif)\s+dahil edilmedi|<medya dahil edilmedi>|bu mesaj silindi\.?|\S+\.(?:pdf|jpe?g|png|opus|mp4)\b.*$/gi, '')
    .replace(/\p{Extended_Pictographic}|\u{FE0F}/gu, '')
    .replace(/^\s*(?:[•*·\-–]|\d{1,2}\s*[-.)]+)\s*(?=\S)/, (m) => (/^\s*\d/.test(m) && !/[-.)]/.test(m) ? m : ''))
    .trim()

/** "Dr alparslan Tekiner 5 paket…" / "DR PINAR ÜNAL MISIR" / "Dr. Çağatay Gül’ün kaydının…" → doktor adı */
function doctorIn(line: string): string | null {
  if (/@|https?:/.test(line)) return null
  const m = line.match(/(?:^|[\s(])(?:dr|doç|doc|prof|op|uzm)\.?\s*([A-Za-zÇĞİÖŞÜçğıöşüÂâÎî]+(?:[ \t]+[A-Za-zÇĞİÖŞÜçğıöşüÂâÎî]+){0,3})/i)
  if (!m) return null
  const words: string[] = []
  for (const w of m[1].split(/\s+/)) {
    if (PRODUCT_RE.test(w) || CITY_RE.test(w.toLocaleLowerCase('tr-TR')) || /^(hoca|hocaya|hocadan|bey|hanım|hn|ile|ve|için|siparişi?|paket|kutu|adet|ürün|tarafından)$/i.test(w)) break
    words.push(w.replace(/[’'](?:\p{L})*$/u, ''))
  }
  if (!words.length) return null
  return 'Dr. ' + words.map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')).join(' ')
}

/** Tek başına kişi adı satırı ("ALİ EREN AKBAY", "Sinem Sabuncugil") */
function personLine(line: string): string | null {
  const l = line.trim()
  // Her kelime büyük harfle başlar ("Sinem Sabuncugil", "ALİ EREN AKBAY") — "ek bilgi lazım mı" gibi cümleler kişi değil
  if (!/^[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü]+){1,3}$/.test(l)) return null
  if (PRODUCT_RE.test(l) || LOCATION_WORDS.test(l) || /\b(ltd|şti|limited|şirket|kozmetik|ticaret)\b/i.test(l)) return null
  return 'Dr. ' + l.split(/\s+/).map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')).join(' ')
}

/** Satırdaki ürün kısmı: fiyat, "KDV dahil", doktor adı ve "Ürün:/Sipariş:" etiketi atılır */
function itemText(line: string, doctor: string | null): string {
  let t = line
    .replace(PRICE_RE, ' ')
    .replace(/\b(?:toplam\s+)?(?:tutar|fiyat)\s*:?/gi, ' ')
    .replace(/\bkdv\s*(?:dahil|hariç|li|siz)\b\.?|\bfaturas[ıi]z\b|\bfatural[ıi]\b/gi, ' ')
    .replace(/^\s*(?:ürün|sipariş|ürün talebi)\s*:\s*/i, '')
  // Satır başındaki "DR HAKAN TÜFEKÇİ 1 paket…" — ünvandan miktara kadar olan ad atılır
  t = t.replace(/(?:^|\s)(?:dr|doç|doc|prof|op|uzm)\.?\s+[^\d]*?(?=\d)/i, ' ')
  void doctor
  // Uzun cümle: "…kaydının, 23+ 5 Mix XO Dolgu paketi için … rica ederim" → miktar + ürün kısmı
  if (t.split(/\s+/).length > 8) {
    const m = t.match(/\d+\s*(?:\+\s*\d+\s*)?(?:paket|kutu|adet|flakon)?\s*(?:[A-Za-zÇĞİÖŞÜçğıöşü]+\s*){1,4}/g)
    const hit = m?.find((x) => PRODUCT_RE.test(x))
    if (hit) t = hit.replace(/\s+(?:için|ile|olarak|toplam)\b.*$/i, '')
  }
  // Ürünün ardından gelen ürün dışı kelimeler ("Masterclass adana", "Hasan aldinç", "bilgileri hoca…") atılır
  const words = t.trim().split(/\s+/)
  let lastProduct = -1
  words.forEach((w, i) => {
    if (PRODUCT_RE.test(w) || /^(pl|deep|volume|light|lux|col|bio|strong|line|soft|plus|aşısı|asisi|dolgu|hediye|mf|vitapep|pdrn)$/i.test(fold(w))) lastProduct = i
  })
  if (lastProduct >= 0 && PRODUCT_RE.test(t)) {
    const kept = words.slice(0, lastProduct + 1)
    const firstQty = kept.findIndex((w) => /^\d/.test(w))
    t = (firstQty > 0 && kept.slice(0, firstQty).every((w) => !PRODUCT_RE.test(w)) ? kept.slice(firstQty) : kept).join(' ')
  }
  return t.replace(/[–—-]\s*$/, '').replace(/\s*[,;:–—-]\s*$/, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.;:–—-]+/, '').trim()
}

export function parseChatSales(text: string, repName: string): ChatSaleRow[] {
  const all = splitMessages(text)
  const repKey = fold(repName.split(/\s+/)[0] ?? '')
  const isRep = (m: Msg) => !!repKey && fold(m.sender).split(/\s+/)[0] === repKey
  const out: ChatSaleRow[] = []
  let lastSaleMinutes: number | null = null

  for (let i = 0; i < all.length; i++) {
    const msg = all[i]
    if (!isRep(msg)) continue
    const lines = msg.lines.map(cleanLine).filter(Boolean)
    // "Ödemesini geçti ürün geldiğin de kargoya çıkarabiliriz" — az önceki satış bekleyen siparişdir
    const last = out[out.length - 1]
    if (last && last.date === msg.date && lastSaleMinutes != null && msg.minutes - lastSaleMinutes <= 10 && !lines.some((l) => PRICE_RE.test(l)) && lines.some((l) => PENDING_RE.test(l.toLocaleLowerCase('tr-TR')))) {
      last.sale.pending = true
      continue
    }
    if (!lines.some((l) => PRICE_RE.test(l))) {
      out.push(...unpricedOrders(lines, msg.date))
      continue
    }
    // Yalnız tutardan oluşan mesaj ("195.000₺ KDV dahil") birkaç dakika önceki satışın toplamıdır
    const prevSale = out[out.length - 1]
    if (
      prevSale && prevSale.date === msg.date && lastSaleMinutes != null && msg.minutes - lastSaleMinutes <= 5 &&
      lines.length === 1 && !/\p{L}{3}/u.test(lines[0].replace(PRICE_RE, '').replace(/\bkdv\s*(?:dahil|hariç)\b|\bfaturas[ıi]z\b|toplam/gi, ''))
    ) {
      prevSale.sale.total = parseAmount(lines[0])
      continue
    }

    let doctor: string | null = null
    let phone = ''
    const sale: VisitSale = { items: [], total: null }
    let pendingProduct: string | null = null // "Ürün: BVRS PL" (miktar sonraki satırda)
    let pendingQty: string | null = null

    for (const line of lines) {
      if (!doctor) doctor = doctorIn(line)
      const tel = line.match(/(?:tel(?:efon)?|gsm|cep)\s*:?\s*(\+?[\d\s()-]{10,})/i)
      if (tel) {
        phone = tel[1].trim()
        continue
      }
      if (NOT_SALE_RE.test(line)) continue
      const hasPrice = PRICE_RE.test(line)
      const f = fold(line)

      if (/^ürün\s*:/i.test(line) && !hasPrice) {
        pendingProduct = line.replace(/^ürün\s*:\s*/i, '').trim()
        continue
      }
      if (/^miktar\s*:/i.test(line)) {
        pendingQty = line.replace(/^miktar\s*:\s*/i, '').trim()
        if (pendingProduct) {
          sale.items.push({ text: `${pendingQty} ${pendingProduct}`, amount: null })
          pendingProduct = pendingQty = null
        }
        continue
      }
      // "Sipariş: 1 Paket BVRS PL – KDV dahil 39.000 TL." — üstte ayrıntısı yazılmış siparişin özeti, tekrar eklenmez
      if (/^sipariş\s*:/i.test(line) && sale.items.length) {
        const amt = parseAmount(line)
        if (amt && sale.total == null && sale.items.every((it) => it.amount == null)) sale.total = amt
        continue
      }
      if (hasPrice) {
        const amount = parseAmount(line)
        const rest = itemText(line, doctor)
        if (/^toplam/.test(f) || (/toplam/.test(f) && !PRODUCT_RE.test(rest))) {
          sale.total = amount
          continue
        }
        if (PRODUCT_RE.test(rest) || (QTY_RE.test(rest) && rest.length > 3)) {
          sale.items.push({ text: rest, amount })
          continue
        }
        // Yalnız fiyat ("26.000₺ KDV dahil", "• KDV Dahil: 8.000 TL"): önceki fiyatsız ürünün fiyatı, yoksa toplam
        if (!/\p{L}{3}/u.test(rest.replace(/\b(adet|paket|kutu)\b/gi, ''))) {
          const last = sale.items[sale.items.length - 1]
          if (last && last.amount == null && sale.items.filter((it) => it.amount == null).length === 1) last.amount = amount
          else if (sale.items.length) sale.total = amount
        }
        continue
      }
      // Fiyatsız ürün satırı ("1 paket sappire pdrn hediye", "* 3 adet en hafif form – dudak")
      if (QTY_RE.test(line) || (PRODUCT_RE.test(line) && /^\d/.test(line))) {
        sale.items.push({ text: itemText(line, doctor), amount: null })
      }
    }
    if (pendingProduct) sale.items.push({ text: pendingQty ? `${pendingQty} ${pendingProduct}` : pendingProduct, amount: null })
    if (!sale.items.length) continue
    // Tek ürün + toplam: toplam o ürünün tutarıdır
    if (sale.items.length === 1 && sale.items[0].amount == null && sale.total != null) sale.items[0].amount = sale.total
    if (!sale.items.some((it) => it.amount != null) && sale.total == null) continue

    // Doktor mesajda yoksa: temsilcinin hemen önceki (15 dk, aynı gün) mesajlarındaki kişi adı
    // "1 kutu fillicia faturasız 11.000₺ KDV dahil Hasan aldinç" — fiyattan sonra yazılan ad
    if (!doctor) {
      for (const line of lines) {
        const tail = line.split(PRICE_RE).pop()?.replace(/\bkdv\s*(?:dahil|hariç)\b|\bfaturas[ıi]z\b/gi, '').trim() ?? ''
        if (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-Za-zÇĞİÖŞÜçğıöşü]+$/.test(tail) && !LOCATION_WORDS.test(tail) && !PRODUCT_RE.test(tail)) {
          doctor = 'Dr. ' + tail.split(/\s+/).map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')).join(' ')
          break
        }
      }
    }
    if (!doctor) {
      for (let j = i - 1; j >= 0 && j >= i - 12; j--) {
        const prev = all[j]
        if (prev.date !== msg.date || msg.minutes - prev.minutes > 15) break
        if (!isRep(prev)) continue
        const pl = prev.lines.map(cleanLine).filter(Boolean)
        // Önceki mesaj başka bir satışsa o satışın doktoru bu satışa taşınmaz
        if (pl.some((l) => PRICE_RE.test(l))) break
        doctor = pl.map((l) => doctorIn(l) ?? (pl.length === 1 ? personLine(l) : null)).find(Boolean) ?? null
        if (doctor) break
      }
    }
    if (lines.some((l) => PENDING_RE.test(l.toLocaleLowerCase('tr-TR')))) sale.pending = true
    out.push({ date: msg.date, name: doctor ?? '', phone, sale })
    lastSaleMinutes = msg.minutes
  }
  return dedupeSales(out)
}

const lowerTr = (s: string) => s.toLocaleLowerCase('tr-TR')

/** Satırdaki miktar + ürün ("Sappire PDRN 1kutu sipariş" → "1 kutu Sappire PDRN") */
function qtyProduct(line: string): string | null {
  const words = line.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean)
  const isProd = (w: string) => PRODUCT_RE.test(w) || /^(pl|deep|volume|light|lux|col|bio|strong|line|soft|plus|aşısı|aşı|asisi|dolgu|vitapep)$/i.test(fold(w))
  // Ürün kelimelerinin ilk kesintisiz dizisi
  let start = words.findIndex((w) => PRODUCT_RE.test(w))
  if (start < 0) return null
  while (start > 0 && isProd(words[start - 1])) start--
  let end = start
  while (end + 1 < words.length && isProd(words[end + 1])) end++
  const product = words.slice(start, end + 1).join(' ')
  const qm = line.match(QTY_PHRASE_RE)
  if (!qm || !qm[3] && !/^\d+$/.test(words[start - 1] ?? '')) return null
  const qty = `${qm[1]}${qm[2] ? `+${qm[2]}` : ''}${qm[3] ? ` ${qm[3].toLocaleLowerCase('tr-TR')}` : ''}`
  return `${qty} ${product}`
}

/** Fiyatsız sipariş mesajı: her satırın doktoru, o satırın ya da üstündeki en yakın "Dr …" satırıdır */
function unpricedOrders(lines: string[], date: string): ChatSaleRow[] {
  const groups: ChatSaleRow[] = []
  let doctor: string | null = null
  let group: ChatSaleRow | null = null
  for (const line of lines) {
    const d = doctorIn(line)
    if (d) {
      doctor = d
      group = null
    }
    const tel = line.match(/^(?:tel(?:efon)?|gsm|cep)?\s*:?\s*(\+?0?\s*\(?5\d{2}\)?[\s\d]{7,})$/i)
    if (tel && group && !group.phone) {
      group.phone = tel[1].trim()
      continue
    }
    const low = lowerTr(line)
    if (NOT_SALE_RE.test(low) && !PENDING_RE.test(low)) continue
    // Ödünç/borç ürün ("Dr. X'ten 1 adet ödünç alındı, stoğa girince geri verilecek") satış değildir
    if (/ödünç|borç|geri veril/.test(low)) continue
    const pending = PENDING_RE.test(low)
    if (!ORDER_RE.test(low) || (FUTURE_RE.test(low) && !pending)) continue
    const item = qtyProduct(line)
    if (!item) continue
    if (!group) {
      group = { date, name: doctor ?? '', phone: '', sale: { items: [], total: null } }
      groups.push(group)
    }
    group.sale.items.push({ text: item, amount: null })
    if (pending) group.sale.pending = true
  }
  return groups
}

/**
 * Aynı satış hem fiyatlı sipariş mesajında hem de gün sonu raporunda ("10 paket Bvrs satıldı") geçebilir:
 * 3 gün içinde aynı miktar + ürün ise fiyatsız tekrar atılır; fiyatlı kayıtta doktor yoksa rapordaki doktor yazılır.
 */
function dedupeSales(rows: ChatSaleRow[]): ChatSaleRow[] {
  const key = (t: string) => {
    const q = t.match(/\d+/)?.[0] ?? ''
    const p = fold(t.match(PRODUCT_RE)?.[0] ?? '').replace(/\s+/g, '')
    return `${q}|${p}`
  }
  const days = (a: string, b: string) => Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 864e5
  const sameDoctor = (a: string, b: string) => {
    const wa = fold(a).replace(/^dr\.\s*/, '').split(/\s+/)
    const wb = fold(b).replace(/^dr\.\s*/, '').split(/\s+/)
    return wa.some((w) => w.length > 2 && wb.includes(w))
  }
  const priced = rows.filter((r) => r.sale.items.some((it) => it.amount != null) || r.sale.total != null)
  return rows.filter((r) => {
    if (priced.includes(r)) return true
    const keys = r.sale.items.map((it) => key(it.text))
    const twin = priced.find(
      (p) => days(p.date, r.date) <= 3 && (!p.name || !r.name || sameDoctor(p.name, r.name)) && keys.every((k) => p.sale.items.some((it) => key(it.text) === k)),
    )
    if (!twin) return true
    if (!twin.name && r.name) twin.name = r.name
    if (r.sale.pending) twin.sale.pending = true
    return false
  })
}

/** Satış özeti tek satır ("5 paket Bvrs pl 175.000 ₺") — açıklama/dışa aktarma için */
export function formatSale(sale: VisitSale): string {
  const tl = (n: number) => `${n.toLocaleString('tr-TR')} ₺`
  const items = sale.items.map((it) => (it.amount != null ? `${it.text} ${tl(it.amount)}` : it.text)).join(', ')
  return sale.total != null && (sale.items.length > 1 || sale.items[0]?.amount !== sale.total) ? `${items} · Toplam ${tl(sale.total)}` : items
}
