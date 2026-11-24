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
}

export interface ExistingOwed {
  customerId: string | null
  doctor: string
  productName: string
  qty: number
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

/** WhatsApp konuşması (yapıştırılmış metin ya da "Sohbeti dışa aktar" dosyası) → doktor/ürün/adet satırları */
export function parseOwedWhatsApp(text: string, products: Product[]): OwedLine[] {
  const out: OwedLine[] = []
  const current = { name: '', phone: null as string | null }
  let lastSender = ''
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
      line = m[2]
    }
    if (!line.trim() || NOISE_RE.test(line)) continue
    out.push(...parseTextLine(line, products, current))
  }
  return out
}

const HEAD = {
  doctor: /doktor|hekim|^dr\.?$|müşteri|musteri|cari|ad[ıi]?\s*soyad|isim|unvan|alıcı|alici|klinik|firma/i,
  product: /ürün|urun|malzeme|stok\s*ad|mal\s*ad|ürün\s*ad|cins|açıklama|aciklama|model/i,
  qty: /adet|miktar|qty|sayı|sayi|kutu|paket|borç\s*adet|kalan/i,
  price: /birim|fiyat/i,
  total: /tutar|toplam|bedel/i,
  phone: /tel|gsm|cep|telefon|whatsapp/i,
  note: /^not(lar)?$|^durum$|inceleme|^aç[ıi]klama\s*\/?\s*not$/i,
}

/** Excel'in bütün sayfalarını ham hücre matrisi olarak okur */
export async function readWorkbookMatrices(file: File): Promise<{ name: string; rows: unknown[][] }[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true }) }))
}

/**
 * Excel listesi → doktor/ürün/adet satırları. Üç düzen tanınır:
 *  1) Sütunlu liste: Doktor | Ürün | Adet (| Fiyat | Telefon) — doktor hücresi boşsa üstteki doktor geçerli
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
      const col = (re: RegExp, skip: number[] = []) => header.findIndex((h, i) => !skip.includes(i) && h && re.test(h))
      const dCol = col(HEAD.doctor)
      const pCol = col(HEAD.product, [dCol])
      const qCol = col(HEAD.qty, [dCol, pCol])
      const prCol = col(HEAD.price, [dCol, pCol, qCol])
      const tCol = col(HEAD.total, [dCol, pCol, qCol, prCol])
      const phCol = col(HEAD.phone, [dCol, pCol, qCol, prCol, tCol])
      const nCol = col(HEAD.note, [dCol, pCol, qCol, prCol, tCol, phCol])
      const productCols = header.map((h, i) => ({ i, p: h ? matchProduct(h, products) : undefined, h })).filter((x) => x.i !== dCol && (x.p || PRODUCT_RE.test(x.h)))

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
          const qty = toNumber(r[qCol]) ?? qtyOf(ptext) ?? 1
          if (qty <= 0) continue
          const unit = toNumber(r[prCol])
          const total = toNumber(r[tCol])
          out.push({
            doctor,
            phone,
            productText: productTextOf(ptext) || ptext,
            product: matchProduct(ptext, products),
            qty,
            unitPrice: unit ?? (total ? Math.round((total / qty) * 100) / 100 : null),
            raw: [d || doctor, ptext, qCol >= 0 ? cell(qCol) : ''].filter(Boolean).join(' · '),
            note: cell(nCol) || undefined,
          })
        } else {
          for (const pc of productCols) {
            const qty = toNumber(r[pc.i])
            if (!qty || qty <= 0) continue
            out.push({ doctor, phone, productText: pc.h, product: pc.p, qty, unitPrice: null, raw: `${doctor} · ${pc.h} · ${qty}` })
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
 * İki listeyi (ve programdaki açık borçları) kıyaslar. Satır anahtarı: doktor (Cari Kart eşleşmesi ya da adı) + ürün
 * (katalog eşleşmesi ya da yazısı). Excel'de aynı doktor/ürün birden çok satırdaysa adetler toplanır; WhatsApp'ta
 * tekrar geçen satır çoğu zaman aynı listenin yeniden gönderilmesi ya da düzeltmesi olduğu için en büyüğü alınır ve
 * işaretlenir.
 */
export function compareOwedLists(
  wa: OwedLine[] | null,
  xl: OwedLine[] | null,
  existing: ExistingOwed[],
  customers: CariLite[],
  products: Product[],
): CompareRow[] {
  const both = !!wa?.length && !!xl?.length
  const doctorKey = (doctor: string, phone: string | null) => {
    const c = findCari(doctor, phone, customers)
    return { key: c ? `c:${c.id}` : `n:${nameKey(doctor)}`, customer: c }
  }

  type Acc = Omit<CompareRow, 'existingQty' | 'targetQty' | 'addQty' | 'status' | 'unitPrice'> & { price: number | null; waList: number[] }
  const map = new Map<string, Acc>()
  // Yalnız Excel verildiyse her satır ayrı kayıt kalır (aynı doktor + ürünün iki ayrı siparişi, ayrı notlarıyla)
  const separateXl = !wa?.length
  const baseKey = new Map<string, string>()
  const add = (l: OwedLine, src: 'wa' | 'xl', i: number) => {
    const d = doctorKey(l.doctor, l.phone)
    if (d.key === 'n:') return
    const base = `${d.key}|${productKey(l)}`
    const key = src === 'xl' && separateXl ? `${base}#${i}` : base
    baseKey.set(key, base)
    let a = map.get(key)
    if (!a) {
      a = {
        key,
        doctor: d.customer?.full_name ?? l.doctor,
        phone: l.phone,
        customer: d.customer,
        productName: l.product?.name ?? l.productText,
        product: l.product,
        waQty: null,
        xlQty: null,
        waRepeated: false,
        raws: [],
        notes: [],
        price: null,
        waList: [],
      }
      map.set(key, a)
    }
    if (!a.phone && l.phone) a.phone = l.phone
    if (a.price == null && l.unitPrice != null) a.price = l.unitPrice
    if (l.note && !a.notes.includes(l.note)) a.notes.push(l.note)
    const rawLabel = `${src === 'wa' ? 'WhatsApp' : 'Excel'}: ${l.raw}`
    if (!a.raws.includes(rawLabel)) a.raws.push(rawLabel)
    if (src === 'xl') a.xlQty = (a.xlQty ?? 0) + l.qty
    else {
      a.waList.push(l.qty)
      a.waQty = Math.max(a.waQty ?? 0, l.qty)
      a.waRepeated = new Set(a.waList).size > 1
    }
  }
  for (const [i, l] of (wa ?? []).entries()) add(l, 'wa', i)
  for (const [i, l] of (xl ?? []).entries()) add(l, 'xl', i)

  // Programdaki açık borçlar aynı anahtarla toplanır
  const existingByKey = new Map<string, number>()
  for (const e of existing) {
    const c = e.customerId ? customers.find((x) => x.id === e.customerId) : findCari(e.doctor, null, customers)
    const dk = c ? `c:${c.id}` : `n:${nameKey(e.doctor)}`
    const p = matchProduct(e.productName, products)
    const k = `${dk}|${p ? `p:${p.id}` : `t:${fold(e.productName)}`}`
    existingByKey.set(k, (existingByKey.get(k) ?? 0) + e.qty)
  }

  return [...map.values()]
    .map(({ price, waList: _w, ...a }) => {
      const status: CompareStatus = !both
        ? 'tek_kaynak'
        : a.waQty != null && a.xlQty != null
          ? a.waQty === a.xlQty
            ? 'eslesti'
            : 'farkli'
          : a.waQty != null
            ? 'yalniz_wa'
            : 'yalniz_xl'
      const targetQty = a.xlQty ?? a.waQty ?? 0
      // Programdaki adet aynı doktor + ürünün satırlarına sırayla düşülür
      const base = baseKey.get(a.key) ?? a.key
      const existingQty = Math.min(targetQty, existingByKey.get(base) ?? 0)
      existingByKey.set(base, (existingByKey.get(base) ?? 0) - existingQty)
      return {
        ...a,
        status,
        targetQty,
        existingQty,
        addQty: Math.max(0, targetQty - existingQty),
        unitPrice: price ?? Number(a.product?.unit_price ?? 0),
      }
    })
    .sort((x, y) => x.doctor.localeCompare(y.doctor, 'tr') || x.productName.localeCompare(y.productName, 'tr'))
}
