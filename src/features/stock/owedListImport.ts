import * as XLSX from 'xlsx'

import { matchProduct } from '@/features/doctorVisits/productMatch'
import { cleanVisitName } from '@/features/doctorVisits/reportParser'
import { nameKey, phoneKey } from '@/features/customers/dedupe'
import type { Product } from '@/types/database'

/**
 * Borçlu olduğumuz ürünleri WhatsApp konuşmasından ve Excel listesinden okuyup birbiriyle kıyaslama
 * (kullanıcı isteği, 2026-11-24: "borçlu olduğumuz ürünler kısmında whatsapp konuşmasıyla liste ekle, excel listesi
 * ekleme kısmı olsun, birbiriyle kıyaslayın, ona göre eklemeleri yap, programa doğru ve düzgün bilgileri ekle").
 *
 * İki kaynak ayrı ayrı (doktor + ürün + adet) satırlarına çevrilir, aynı doktor + aynı ürün tek satırda birleşir ve
 * her satır programda zaten açık duran borçla da karşılaştırılır. Hangi satırın ekleneceğine kullanıcı önizlemede
 * karar verir; burada hiçbir şey kaydedilmez.
 */

export interface OwedLine {
  doctor: string
  phone: string | null
  productText: string
  product?: Product
  qty: number
  /** Kaynakta yazan birim fiyat (toplam yazdıysa adede bölünmüş) */
  unitPrice: number | null
  /** Satırın kaynağındaki ham metin — önizlemede "nereden okundu" diye gösterilir */
  raw: string
  /** Excel'deki "Not" sütunu (ör. "İNCELENECEK — …") — kayda olduğu gibi yazılır */
  note?: string
  /** Satışı yapan kişi (Excel "Satış Yapan" sütunu ya da WhatsApp mesajını gönderen) */
  rep?: string | null
  /** Kongre / workshop / masterclass */
  event?: string | null
  /** Sipariş tarihi yyyy-MM-dd (Excel sütunu ya da WhatsApp mesaj tarihi) */
  orderDate?: string | null
  /** Sipariş edilen adet — verilmezse qty + delivered */
  ordered?: number | null
  /** Verilen adet */
  delivered?: number
  /** Aynı siparişten verilen ürünlerin adları */
  deliveredItems?: string | null
}

export interface ExistingOwed {
  customerId: string | null
  doctor: string
  productName: string
  qty: number
  /** Elle/listeden eklenmiş kayıtsa id'si (önceki içe aktarmayı değiştirmek için) */
  pendingId?: string
  note?: string | null
}

export interface CariLite {
  id: string
  full_name: string
  phone: string | null
  mobile_phone?: string | null
  whatsapp_phone?: string | null
}

export type CompareStatus = 'eslesti' | 'farkli' | 'yalniz_wa' | 'yalniz_xl' | 'tek_kaynak'

export interface CompareRow {
  key: string
  doctor: string
  phone: string | null
  customer?: CariLite
  productName: string
  product?: Product
  waQty: number | null
  xlQty: number | null
  existingQty: number
  /** Kaynaklara göre doğru adet (farklıysa Excel'deki) */
  targetQty: number
  /** Programda zaten olan düşülerek eklenecek adet */
  addQty: number
  unitPrice: number
  status: CompareStatus
  /** WhatsApp'ta aynı doktor + ürün birden çok kez farklı adetle geçti */
  waRepeated: boolean
  raws: string[]
  /** Excel "Not" sütunundan gelen notlar */
  notes: string[]
  rep: string | null
  event: string | null
  orderDate: string | null
  ordered: number | null
  delivered: number
  deliveredItems: string | null
}

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/\s+/g, ' ').trim()

// Katalogda olmayan ama bilinen ürün yazımları (bkz. doctorVisits/chatSales.ts)
const PRODUCT_RE =
  /bvrs|fill?ic[iı]a|f[iı]ll?yal|mix\s?xo|mixo|sap+h?ire|safir|pdrn|vitapep|elis[iı]r|elix[iı]r|\bstar\b|hamo|\bamc\b|somon|\bdna\b|\blux\b|\bcol\b|\bbio\b|dolgu|mezoterapi|exosome|ekzozom/i
const UNIT = '(?:paket|pk|kutu|adet|ad|flakon|fl|tane|kt)'
const QTY_RE = new RegExp(`(?:^|[^\\d.,])(\\d{1,3})\\s*(?:\\+\\s*(\\d{1,3})\\s*)?(?:x\\s*)?(${UNIT})?\\.?(?=\\s|$|[^\\p{L}\\d])`, 'iu')
const QTY_AFTER_RE = new RegExp(`(?:x|×|\\*)\\s*(\\d{1,3})\\b|\\b(\\d{1,3})\\s*${UNIT}\\b`, 'i')
const PRICE_RE = /(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:₺|tl\b|try\b)/i
const PHONE_RE = /(?:\+?90[\s-]?)?\(?0?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/
const TITLE_RE = /^(?:dr|doç|doc|prof|uzm|op)\b\.?\s*/i
// WhatsApp dışa aktarım satırı: "[23.10.2026 14:02:15] Ali: …" / "23.10.2026 14:02 - Ali: …"
const MESSAGE_RE = /^\[?\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[AaPp][Mm])?\]?\s*(?:-\s*)?([^:]{1,60}?):\s?(.*)$/
const NOISE_RE = /(dahil edilmedi|omitted|<attached|<ek:|bu mesaj silindi|this message was deleted|uçtan uca|end-to-end|\.(jpe?g|png|pdf|opus|mp4|webp)\b)/i
// Kişi adı olamayacak sohbet kelimeleri
const CHAT_WORDS =
  /\b(merhaba|selam|günaydın|iyi|tamam|teşekkür|tesekkur|sağol|hocam|abi|abla|kargo|gönder|gonder|gönderildi|gitti|liste|listesi|borç|borc|ürün|urun|stok|fatura|ödeme|odeme|iban|toplam|fiyat|adres|lütfen|evet|hayır|bugün|yarın|okey|ok|olur|bekliyor|geldi|gelince|kalan|eksik|sipariş|siparis)\b/i

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(/\s|₺|tl/gi, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function priceOf(text: string): number | null {
  const m = text.match(PRICE_RE)
  if (!m) return null
  const n = Number(m[1].replace(/[.\s]/g, '') + (m[2] ? `.${m[2]}` : ''))
  return n > 0 ? n : null
}

/** Satır bir kişi/kurum adına benziyor mu ("Dr. Ali Eren AKBAY", "Ayşe Kaya", "Snap Clinic") */
function looksLikeName(text: string): boolean {
  const t = text.replace(TITLE_RE, '').replace(/[:\-–—.,]+$/, '').trim()
  if (!t || /\d/.test(t) || CHAT_WORDS.test(t) || PRODUCT_RE.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 5) return TITLE_RE.test(text) && words.length >= 1 && t.length >= 3
  return words.every((w) => /^\p{L}[\p{L}'’.]*$/u.test(w)) && words.some((w) => /^\p{Lu}/u.test(w))
}

function cleanDoctor(text: string): string {
  return cleanVisitName(text.replace(/[:\-–—=>]+\s*$/, '').replace(/^[\s:\-–—•*·]+/, '').trim())
}

/** "2 kutu BVRS PL", "BVRS PL x2", "3+1 paket Fillicia" → adet */
function qtyOf(segment: string): number | null {
  const m = segment.match(QTY_RE)
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) : 0)
  const a = segment.match(QTY_AFTER_RE)
  if (a) return Number(a[1] ?? a[2])
  return null
}

/** Segmentteki ürün yazısı: adet/fiyat/telefon çıkarılmış hâli */
function productTextOf(segment: string): string {
  return segment
    .replace(PHONE_RE, ' ')
    .replace(PRICE_RE, ' ')
    .replace(new RegExp(`\\b\\d{1,3}\\s*(?:\\+\\s*\\d{1,3}\\s*)?(?:x\\s*)?${UNIT}?\\b\\.?`, 'gi'), ' ')
    .replace(/(?:x|×|\*)\s*\d{1,3}\b/gi, ' ')
    .replace(/\b(kdv\s*dahil|kdv|dahil|hariç)\b/gi, ' ')
    .replace(/[()[\]:;=>\-–—•*·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Bir satırı/hücreyi (doktor, ürün, adet) kayıtlarına çevirir. "Dr Ali Kaya 2 BVRS PL, 1 Fillicia" gibi satırda ürünün
 * önündeki ad doktordur; yalnız ürün yazan satırlar (`currentDoctor`) son geçen doktora yazılır.
 */
function parseTextLine(line: string, products: Product[], currentDoctor: { name: string; phone: string | null }): OwedLine[] {
  const raw = line.trim()
  const phone = raw.match(PHONE_RE)?.[0] ?? null
  let text = raw.replace(/\s+/g, ' ').replace(/^\s*(?:[-•*·▪►✓✔]+|\d{1,2}[)])\s*/, '')
  if (phone) text = text.replace(PHONE_RE, ' ').replace(/\s+/g, ' ').trim()

  // Ürün geçmeyen satır: kişi adıysa sonraki ürünlerin doktoru olur
  const hasProduct = (s: string) => !!matchProduct(s, products) || PRODUCT_RE.test(s)
  if (!hasProduct(text)) {
    if (looksLikeName(text)) {
      currentDoctor.name = cleanDoctor(text)
      currentDoctor.phone = phone
    } else if (phone && currentDoctor.name && !currentDoctor.phone) currentDoctor.phone = phone
    return []
  }

  // Ürünün önündeki ad doktor: "Dr. Ali Kaya: 2 bvrs" / "Ayşe Yılmaz - 1 kutu Fillicia"
  const firstHit = (() => {
    const q = text.search(new RegExp(`\\b\\d{1,3}\\s*(?:\\+\\s*\\d{1,3}\\s*)?${UNIT}?\\b`, 'i'))
    const p = text.search(PRODUCT_RE)
    const folded = fold(text)
    const catalogIdx = products
      .map((pr) => fold(pr.name).split(' ')[0])
      .filter((w) => w.length >= 3)
      .map((w) => folded.search(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)))
      .filter((i) => i >= 0)
    const c = catalogIdx.length ? Math.min(...catalogIdx) : -1
    return Math.min(...[q, p, c].filter((i) => i >= 0))
  })()
  if (Number.isFinite(firstHit) && firstHit > 0) {
    const head = text.slice(0, firstHit).trim()
    if (looksLikeName(head)) {
      currentDoctor.name = cleanDoctor(head)
      currentDoctor.phone = phone
      text = text.slice(firstHit)
    }
  } else if (phone && currentDoctor.name && !currentDoctor.phone) currentDoctor.phone = phone
  if (!currentDoctor.name) return []

  const out: OwedLine[] = []
  for (const seg of text.split(/\s*(?:[,;/]|\s\+\s|\bve\b|&)\s*/i)) {
    if (!seg.trim() || !hasProduct(seg)) continue
    const qty = qtyOf(seg.replace(PRICE_RE, ' ')) ?? 1
    const product = matchProduct(seg, products)
    const productText = productTextOf(seg)
    if (!productText) continue
    const price = priceOf(seg)
    out.push({
      doctor: currentDoctor.name,
      phone: currentDoctor.phone,
      productText,
      product,
      qty,
      unitPrice: price ? Math.round((price / qty) * 100) / 100 : null,
      raw,
    })
  }
  return out
}

/** "23.10.2026" + saat → yyyy-MM-dd */
function chatDate(d: string): string | null {
  const m = d.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (!m) return null
  const y = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** WhatsApp konuşması (yapıştırılmış metin ya da "Sohbeti dışa aktar" dosyası) → doktor/ürün/adet satırları.
 * Satış yapan = mesajı gönderen kişi, sipariş tarihi = mesajın tarihi. */
/**
 * Not yazısını sadeleştirir (kullanıcı isteği, 2026-11-25: "8.09 gibi saatleri yazma, WhatsApp / Excel listesi gibi
 * şeyleri yazma"): gün.ay / saat ifadeleri, kaynak ve kıyas yazıları ("WhatsApp + Excel listesi", "WhatsApp 1 / Excel
 * 5 adet", "Excel'de yok", "Sohbette bulunamadı") ve ardından kalan satış yapan adı çıkarılır.
 */
export function cleanOwedNote(note: string | null | undefined): string {
  if (!note) return ''
  let s = note
    .replace(/\b(whatsapp|excel)\s*(\+\s*(whatsapp|excel))?\s*listesi\b/gi, '')
    .replace(/\bwhatsapp\s*\d+\s*\/\s*excel\s*\d+(\s*adet)?/gi, '')
    .replace(/\b(whatsapp|excel)\s*\d+\s*adet\b/gi, '')
    .replace(/excel[’'`]?(de|da)\s*(yok(tu)?|bulunamadı|yer\s*almıyor)\s*[:.]?/gi, '')
    .replace(/sohbette\s*bulunamadı\.?/gi, '')
    .replace(/\b\d{1,2}[.:/]\d{1,2}([.:/]\d{2,4})?\b(\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü]+[:.](?=\s|$))?/g, '')
    .replace(/\(\s*\)/g, '')
  s = s
    .split(/\s*·\s*/)
    .map((p) => p.replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, '').replace(/\s{2,}/g, ' '))
    .filter((p) => p && !/^(İNCELENECEK|incelenecek)$/.test(p))
    .join(' · ')
  return s.replace(/(İNCELENECEK|İncelenecek)\s*[—–-]\s*[:.]?\s*/g, 'İncelenecek: ').replace(/:\s*:/g, ':').trim()
}

export function parseOwedWhatsApp(text: string, products: Product[]): OwedLine[] {
  const out: OwedLine[] = []
  const current = { name: '', phone: null as string | null }
  let lastSender = ''
  let msgDate: string | null = null
  for (const rawLine of text.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/ /g, ' ').split(/\r?\n/)) {
    let line = rawLine
    const m = rawLine.match(MESSAGE_RE)
    if (m) {
      // Başka kişinin mesajına geçince önceki doktor taşınmaz
      if (m[1].trim() !== lastSender) {
        current.name = ''
        current.phone = null
        lastSender = m[1].trim()
      }
      msgDate = chatDate(rawLine)
      line = m[2]
    }
    if (!line.trim() || NOISE_RE.test(line)) continue
    for (const l of parseTextLine(line, products, current)) out.push({ ...l, rep: lastSender || null, orderDate: msgDate })
  }
  return out
}

const HEAD = {
  doctor: /doktor|hekim|^dr\.?$|müşteri|musteri|cari|ad[ıi]?\s*soyad|isim|unvan|alıcı|alici|klinik|firma/i,
  product: /ürün|urun|malzeme|stok\s*ad|mal\s*ad|ürün\s*ad|cins|açıklama|aciklama|model/i,
  qty: /adet|miktar|qty|sayı|sayi|kutu|paket|borç\s*adet/i,
  price: /birim|fiyat/i,
  total: /^tutar|^toplam\s*tutar|^bedel/i,
  phone: /^tel|gsm|cep|telefon|whatsapp/i,
  note: /^not(lar)?$|^durum$|inceleme|^aç[ıi]klama\s*\/?\s*not$/i,
  rep: /satış\s*yapan|satis\s*yapan|temsilci|satan|personel|plasiyer/i,
  event: /kongre|workshop|etkinlik|masterclass|organizasyon|eğitim/i,
  date: /tarih/i,
  ordered: /^sipariş(\s*(adedi|adet|miktarı?))?$|^siparis(\s*(adedi|adet))?$/i,
  deliveredItems: /verilen\s*ürün|verilen\s*urun|teslim\s*edilen\s*ürün|al[ıi]nan\s*ürün|al[ıi]nan\s*urun/i,
  /** "Borçlu Ürünler" sütunu: "5 BVRS PL" — ürün ve eksik kalan adet birlikte */
  owed: /borçlu\s*ürün|borclu\s*urun/i,
  delivered: /verilen|teslim\s*edilen|gönderilen|gonderilen/i,
  remaining: /^eksik(\s*kalan)?|^kalan(\s*adet)?$/i,
}

/** Excel tarih hücresi (seri sayı, "12.06.2026", "12 Haz 2026", Date) → yyyy-MM-dd */
const TR_MONTHS = ['oca', 'şub', 'mar', 'nis', 'may', 'haz', 'tem', 'ağu', 'eyl', 'eki', 'kas', 'ara']
function excelDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = chatDate(s)
  if (n) return n
  const m = s.toLocaleLowerCase('tr-TR').match(/(\d{1,2})\s+([a-zçğıöşü]{3})[a-zçğıöşü]*\.?\s+(\d{4})/)
  const mi = m ? TR_MONTHS.indexOf(m[2]) : -1
  return m && mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

/** Excel'in bütün sayfalarını ham hücre matrisi olarak okur */
export async function readWorkbookMatrices(file: File): Promise<{ name: string; rows: unknown[][] }[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true }) }))
}

/**
 * Excel listesi → doktor/ürün/adet satırları. Üç düzen tanınır:
 *  1) Sütunlu liste: Doktor | Ürün | Adet (| Satış Yapan | Kongre / Workshop | Sipariş Tarihi | Sipariş Adedi |
 *     Verilen | Eksik Kalan | Birim Fiyat | Tutar | Telefon | Not) — doktor hücresi boşsa üstteki doktor geçerli.
 *     Programın kendi "Dışa Aktar" Excel'i bu düzendedir, geri okunabilir.
 *  2) Çapraz tablo: satırlarda doktor, sütun başlıklarında ürün adları, hücrelerde adet
 *  3) Başlıksız/serbest liste: her satır WhatsApp satırı gibi okunur ("Dr Ali Kaya | 2 BVRS PL")
 */
export function parseOwedExcel(sheets: { name: string; rows: unknown[][] }[], products: Product[]): OwedLine[] {
  const out: OwedLine[] = []
  for (const sheet of sheets) {
    const rows = sheet.rows.filter((r) => r.some((c) => String(c ?? '').trim()))
    if (!rows.length) continue
    const headerIdx = rows.slice(0, 12).findIndex((r) => {
      const cells = r.map((c) => String(c ?? '').trim())
      return cells.some((c) => HEAD.doctor.test(c)) && (cells.some((c) => HEAD.product.test(c) || HEAD.qty.test(c)) || cells.filter((c) => matchProduct(c, products)).length >= 1)
    })

    if (headerIdx >= 0) {
      const header = rows[headerIdx].map((c) => String(c ?? '').trim())
      const used: number[] = []
      // Borç/özet sütunları (ör. "Doktora Kalan Toplam Borç") hiçbir alana eşlenmez
      const col = (re: RegExp) => {
        const i = header.findIndex((h, j) => !used.includes(j) && h && !/borç|borc/i.test(h) && re.test(h))
        if (i >= 0) used.push(i)
        return i
      }
      // "Borçlu Ürünler" borç sözcüğü içerdiği hâlde ürün sütunudur; bu düzende "Fiyat" borçlu ürünlerin tutarıdır
      const owedCol = header.findIndex((h) => HEAD.owed.test(h))
      if (owedCol >= 0) used.push(owedCol)
      const dCol = col(HEAD.doctor)
      const repCol = col(HEAD.rep)
      const evCol = col(HEAD.event)
      const dateCol = col(HEAD.date)
      const delItemsCol = col(HEAD.deliveredItems)
      const pCol = owedCol >= 0 ? owedCol : col(HEAD.product)
      const ordCol = col(HEAD.ordered)
      const delCol = col(HEAD.delivered)
      const remCol = col(HEAD.remaining)
      const qCol = col(HEAD.qty)
      const tCol = owedCol >= 0 ? col(/^fiyat$|^tutar$|^toplam/i) : col(HEAD.total)
      const prCol = col(HEAD.price)
      const phCol = col(HEAD.phone)
      const nCol = col(HEAD.note)
      const productCols = header.map((h, i) => ({ i, p: h ? matchProduct(h, products) : undefined, h })).filter((x) => !used.includes(x.i) && (x.p || PRODUCT_RE.test(x.h)))

      let doctor = ''
      let phone: string | null = null
      for (const r of rows.slice(headerIdx + 1)) {
        const cell = (i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '')
        const d = cell(dCol)
        if (/^(genel\s*)?toplam|^total/i.test(d)) continue
        if (d) {
          doctor = cleanDoctor(d)
          phone = cell(phCol) || null
        } else if (cell(phCol)) phone = cell(phCol)
        if (!doctor) continue

        if (pCol >= 0) {
          const ptext = cell(pCol)
          if (!ptext) continue
          const ordered = toNumber(r[ordCol])
          const delivered = toNumber(r[delCol]) ?? 0
          // Eksik kalan: sütunu varsa o; yoksa sipariş − verilen; yoksa adet sütunu / yazıdaki adet
          const qty = toNumber(r[remCol]) ?? (ordered != null ? ordered - delivered : null) ?? toNumber(r[qCol]) ?? qtyOf(ptext) ?? 1
          if (qty <= 0) continue
          const unit = toNumber(r[prCol])
          const total = toNumber(r[tCol])
          out.push({
            doctor,
            phone,
            productText: productTextOf(ptext) || ptext,
            product: matchProduct(ptext, products),
            qty,
            unitPrice: unit ?? (total != null ? Math.round((total / qty) * 100) / 100 : null),
            raw: [d || doctor, ptext, String(qty)].filter(Boolean).join(' · '),
            note: cell(nCol) || undefined,
            rep: cell(repCol) || null,
            event: cell(evCol) || null,
            orderDate: dateCol >= 0 ? excelDate(r[dateCol]) : null,
            ordered: ordered ?? qty + delivered,
            delivered,
            deliveredItems: cell(delItemsCol) || null,
          })
        } else {
          for (const pc of productCols) {
            const qty = toNumber(r[pc.i])
            if (!qty || qty <= 0) continue
            out.push({ doctor, phone, productText: pc.h, product: pc.p, qty, unitPrice: null, raw: `${doctor} · ${pc.h} · ${qty}`, rep: cell(repCol) || null, event: cell(evCol) || null, orderDate: dateCol >= 0 ? excelDate(r[dateCol]) : null })
          }
        }
      }
      continue
    }

    // Başlıksız liste: her satır metin olarak
    const current = { name: '', phone: null as string | null }
    for (const r of rows) {
      const cells = r.map((c) => String(c ?? '').trim()).filter(Boolean)
      // Tek hücresi sayı olan "Dr Ali | BVRS | 2" satırında adet ürün yazısının yanına gelsin
      const line = cells.map((c) => (/^\d{1,3}$/.test(c) ? `${c} adet` : c)).join(' : ')
      out.push(...parseTextLine(line, products, current))
    }
  }
  return out
}

const productKey = (l: { product?: Product; productText: string }) => (l.product ? `p:${l.product.id}` : `t:${fold(l.productText)}`)

function findCari(doctor: string, phone: string | null, customers: CariLite[]): CariLite | undefined {
  const key = nameKey(doctor)
  if (!key) return undefined
  const exact = customers.find((c) => nameKey(c.full_name) === key)
  if (exact) return exact
  const pk = phoneKey(phone)
  const surname = key.split(' ').pop()
  if (pk) {
    const byPhone = customers.find((c) => [c.phone, c.mobile_phone, c.whatsapp_phone].map(phoneKey).includes(pk) && nameKey(c.full_name).split(' ').pop() === surname)
    if (byPhone) return byPhone
  }
  // "Ali Kaya" ↔ "Ali Eren Kaya": ilk ad ve soyad aynı, tek aday varsa
  const words = key.split(' ')
  if (words.length >= 2) {
    const cands = customers.filter((c) => {
      const w = nameKey(c.full_name).split(' ')
      return w.length >= 2 && w[0] === words[0] && w[w.length - 1] === surname
    })
    if (cands.length === 1) return cands[0]
  }
  return undefined
}

/**
 * İki listeyi (ve programdaki açık borçları) kıyaslar. Excel'in her satırı AYRI kayıttır — aynı doktorun aynı ürünü
 * iki ayrı siparişte geçiyorsa birleşmez (kullanıcı isteği, 2026-11-24: "her biri ayrı olmalı"). WhatsApp satırları
 * doktor + ürün başına tek toplanır (tekrar gönderilen liste çift sayılmasın — en büyüğü alınır) ve Excel'deki aynı
 * doktor + ürünün toplam eksik adediyle kıyaslanır; Excel'de karşılığı olmayan WhatsApp satırı ayrı satır olur.
 */
export function compareOwedLists(
  wa: OwedLine[] | null,
  xl: OwedLine[] | null,
  existing: ExistingOwed[],
  customers: CariLite[],
  products: Product[],
): CompareRow[] {
  const both = !!wa?.length && !!xl?.length
  const doctorOf = (doctor: string, phone: string | null) => {
    const c = findCari(doctor, phone, customers)
    return { key: c ? `c:${c.id}` : `n:${nameKey(doctor)}`, customer: c }
  }
  const make = (l: OwedLine, key: string, customer: CariLite | undefined): Omit<CompareRow, 'status' | 'existingQty' | 'targetQty' | 'addQty'> & { base: string } => ({
    key,
    base: key.split('#')[0],
    doctor: customer?.full_name ?? l.doctor,
    phone: l.phone,
    customer,
    productName: l.product?.name ?? l.productText,
    product: l.product,
    waQty: null,
    xlQty: null,
    waRepeated: false,
    raws: [],
    notes: l.note ? [l.note] : [],
    unitPrice: l.unitPrice ?? Number(l.product?.unit_price ?? 0),
    rep: l.rep ?? null,
    event: l.event ?? null,
    orderDate: l.orderDate ?? null,
    ordered: l.ordered ?? null,
    delivered: l.delivered ?? 0,
    deliveredItems: l.deliveredItems ?? null,
  })

  // WhatsApp: doktor + ürün başına tek (en büyük adet)
  const waBy = new Map<string, { line: OwedLine; customer?: CariLite; qtys: number[]; raws: string[] }>()
  for (const l of wa ?? []) {
    const d = doctorOf(l.doctor, l.phone)
    if (d.key === 'n:') continue
    const base = `${d.key}|${productKey(l)}`
    const w = waBy.get(base) ?? { line: l, customer: d.customer, qtys: [], raws: [] }
    w.qtys.push(l.qty)
    if (!w.raws.includes(`WhatsApp: ${l.raw}`)) w.raws.push(`WhatsApp: ${l.raw}`)
    if (l.qty >= Math.max(...w.qtys)) w.line = { ...l, phone: l.phone ?? w.line.phone }
    waBy.set(base, w)
  }

  const rows: ReturnType<typeof make>[] = []
  for (const [i, l] of (xl ?? []).entries()) {
    const d = doctorOf(l.doctor, l.phone)
    if (d.key === 'n:') continue
    const r = make(l, `${d.key}|${productKey(l)}#x${i}`, d.customer)
    r.xlQty = l.qty
    r.raws.push(`Excel: ${l.raw}`)
    rows.push(r)
  }
  const xlSum = new Map<string, number>()
  for (const r of rows) xlSum.set(r.base, (xlSum.get(r.base) ?? 0) + (r.xlQty ?? 0))
  for (const [base, w] of waBy) {
    const waQty = Math.max(...w.qtys)
    const matched = rows.filter((r) => r.base === base)
    if (matched.length) {
      for (const r of matched) {
        r.waQty = waQty
        r.waRepeated = new Set(w.qtys).size > 1
        r.raws.push(...w.raws)
        // Excel'de boş kalan alanlar WhatsApp'tan tamamlanır
        r.rep ??= w.line.rep ?? null
        r.orderDate ??= w.line.orderDate ?? null
      }
    } else {
      const r = make({ ...w.line, qty: waQty }, `${base}#w`, w.customer)
      r.waQty = waQty
      r.waRepeated = new Set(w.qtys).size > 1
      r.raws.push(...w.raws)
      rows.push(r)
    }
  }

  // Programdaki açık borçlar aynı doktor + ürün anahtarıyla; satırlara sırayla düşülür
  const existingByKey = new Map<string, number>()
  for (const e of existing) {
    const c = e.customerId ? customers.find((x) => x.id === e.customerId) : findCari(e.doctor, null, customers)
    const dk = c ? `c:${c.id}` : `n:${nameKey(e.doctor)}`
    const p = matchProduct(e.productName, products)
    const k = `${dk}|${p ? `p:${p.id}` : `t:${fold(e.productName)}`}`
    existingByKey.set(k, (existingByKey.get(k) ?? 0) + e.qty)
  }

  return rows
    .map(({ base, ...a }) => {
      const status: CompareStatus = !both
        ? 'tek_kaynak'
        : a.waQty != null && a.xlQty != null
          ? a.waQty === xlSum.get(base)
            ? 'eslesti'
            : 'farkli'
          : a.waQty != null
            ? 'yalniz_wa'
            : 'yalniz_xl'
      const targetQty = a.xlQty ?? a.waQty ?? 0
      const existingQty = Math.min(targetQty, existingByKey.get(base) ?? 0)
      existingByKey.set(base, (existingByKey.get(base) ?? 0) - existingQty)
      return { ...a, status, targetQty, existingQty, addQty: Math.max(0, targetQty - existingQty) }
    })
    .sort((x, y) => x.doctor.localeCompare(y.doctor, 'tr') || (x.orderDate ?? '').localeCompare(y.orderDate ?? '') || x.productName.localeCompare(y.productName, 'tr'))
}
