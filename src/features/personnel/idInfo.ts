import type { Personnel } from '@/types/database'
import { formatAddress, formatPhoneTR, formatPlaceName } from '@/lib/personFormat'
import { isValidTcNo } from './status'

export const ID_FIELDS = [
  'tc_no',
  'birth_date',
  'birth_place',
  'gender',
  'blood_type',
  'address',
  'phone',
  'education',
  'military_status',
  'license_class',
  'iban',
] as const satisfies readonly (keyof Personnel)[]

/** Belgeden okunabilen kimlik bilgileri (personel kartındaki alanlarla aynı adlar) */
export type IdInfo = Partial<Pick<Personnel, (typeof ID_FIELDS)[number]>>

export const ID_FIELD_LABELS: Record<keyof IdInfo, string> = {
  tc_no: 'T.C. Kimlik No',
  birth_date: 'Doğum Tarihi',
  birth_place: 'Doğum Yeri',
  gender: 'Cinsiyet',
  blood_type: 'Kan Grubu',
  address: 'Adres',
  phone: 'Telefon',
  education: 'Eğitim',
  military_status: 'Askerlik Durumu',
  license_class: 'Ehliyet Sınıfı',
  iban: 'IBAN',
}

const pad = (n: number) => String(n).padStart(2, '0')
const DATE_RE = /(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/
const LICENSE_CLASSES = ['B', 'A2', 'A', 'B1', 'BE', 'C', 'D']
const thisYear = new Date().getFullYear()
/** Karşılaştırma için küçük harf; taranmış belgelerde noktasız yazılan büyük I ("LISE", "YERI") da i sayılır */
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')

function iso(d: number, mo: number, y: number): string | undefined {
  return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1940 && y <= thisYear - 14 ? `${y}-${pad(mo)}-${pad(d)}` : undefined
}
const toIso = (m: RegExpMatchArray | null) => (m ? iso(+m[1], +m[2], +m[3]) : undefined)

/** Yer adı adayı: harf, boşluk, "/" ve "-" dışında bir şey yoksa ve etiket değilse */
function placeName(s: string): string | undefined {
  const clean = s.replace(/[:_*]/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < 3 || clean.length > 40 || !/^[\p{L}\s/-]+$/u.test(clean)) return undefined
  if (/tarih|date|doğum|dogum|birth|place|cinsiyet|uyruk|soyad|adı|name/i.test(clean)) return undefined
  return formatPlaceName(clean)
}

const EDU: [RegExp, string][] = [
  [/doktora|ph\.?\s?d|doctor of philosophy/, 'Doktora'],
  [/yüksek lisans|yuksek lisans|master/, 'Yüksek Lisans'],
  [/ön\s?lisans|on\s?lisans|meslek yüksekokulu|meslek yuksekokulu|associate/, 'Ön Lisans'],
  [/lisans diploması|lisans diplomasi|fakültesi|fakultesi|bachelor/, 'Lisans'],
  [/lise diploması|lise diplomasi|\blisesi\b|ortaöğretim|ortaogretim/, 'Lise'],
  [/ilköğretim|ilkogretim|ortaokul/, 'Ortaokul'],
  [/ilkokul/, 'İlkokul'],
]

/**
 * Kimlik kartı, ehliyet, nüfus kaydı, e-Devlet belgeleri (adli sicil, askerlik, ikametgâh), diploma, sağlık raporu,
 * iş sözleşmesi ve banka belgelerinin metninden kişinin kimlik bilgileri (kullanıcı isteği, 2026-11-17: "kimlik
 * kısımlarını da otomatik girsin bilgileri", "dosyalarını incele çek, doğru eksiksiz düzenli nizami olsun").
 * Saf fonksiyon — test edilebilir. `docType` belgenin türüdür: ehliyet sınıfı yalnız ehliyetten, askerlik durumu
 * yalnız askerlik belgesinden, eğitim yalnız diplomadan, IBAN yalnız banka belgesinden, adres yalnız ikametgâh /
 * sağlık raporu / sözleşmeden alınır (başka belgelerdeki işyeri/şirket bilgileri karışmasın diye).
 */
export function parseIdInfo(text: string, docType?: string | null): IdInfo {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const low = lines.map(fold)
  const all = low.join('\n')
  const out: IdInfo = {}

  // T.C. kimlik no: algoritması tutan 11 haneli sayı (yanlış okunmuş hane algoritmaya takılır, alınmaz)
  for (const m of text.matchAll(/(?<!\d)([1-9](?:\s?\d){10})(?!\d)/g)) {
    const v = m[1].replace(/\s/g, '')
    if (isValidTcNo(v)) {
      out.tc_no = v
      break
    }
  }

  // Kimlik kartının arkasındaki makine okunur satır: YYAAGG + kontrol + cinsiyet (M/F) — en güvenilir kaynak
  const mrz = text.replace(/\s/g, '').match(/(\d{2})(\d{2})(\d{2})\d([MF])\d{6}\d[A-Z]{3}</)
  if (mrz) {
    const y = +mrz[1] + (+mrz[1] > (thisYear % 100) ? 1900 : 2000)
    out.birth_date = iso(+mrz[3], +mrz[2], y)
    out.gender = mrz[4] === 'F' ? 'Kadın' : 'Erkek'
  }

  lines.forEach((line, i) => {
    const l = low[i]
    const next = lines[i + 1] ?? ''
    // Ehliyet 3. alanı: "3. 24.02.1992 Kartal" ya da yer adı alt satırda ("3. 28.07.1981" / "Berlin")
    const lic3 = line.match(/^3\s*[.)]\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(.*)$/)
    if (lic3) {
      out.birth_date ??= toIso(lic3[1].match(DATE_RE))
      out.birth_place ??= placeName(lic3[2]) ?? (/^\d/.test(next) ? undefined : placeName(next))
      return
    }
    // e-Devlet belgeleri: "DOĞUM YERİ / TARİHİ : ADANA/YÜREĞİR / 07/02/1984", "Doğum Yeri ve Yılı :ADANA 07/02/1984"
    if (/doğum yeri\s*(\/|ve)\s*(tarihi|yılı)|dogum yeri\s*(\/|ve)\s*(tarihi|yili)/.test(l)) {
      const val = line.includes(':') ? line.slice(line.indexOf(':') + 1) : next
      const date = val.match(DATE_RE)
      out.birth_date ??= toIso(date)
      if (date) out.birth_place ??= placeName(val.slice(0, date.index).replace(/[/\s]+$/, ''))
      return
    }
    if (/doğum tarihi|dogum tarihi|date of birth/.test(l)) {
      out.birth_date ??= toIso(line.match(DATE_RE)) ?? toIso(next.match(DATE_RE))
    }
    if (/doğum yeri|dogum yeri|place of birth/.test(l)) {
      const after = line.replace(/.*?(doğum yeri|dogum yeri|place of birth)\s*:?/i, '')
      out.birth_place ??= placeName(after) ?? placeName(next.replace(/^:/, ''))
    }
    if (/cinsiyet|gender|\bsex\b/.test(l)) {
      const v = `${l.replace(/.*?(cinsiyeti?|gender|sex)/, '')} ${low[i + 1] ?? ''}`.replace(/[_:]/g, ' ')
      if (/\b(kadın|kadin|k\s*\/\s*f|female)\b/.test(v)) out.gender ??= 'Kadın'
      else if (/\b(erkek|e\s*\/\s*m|male)\b/.test(v)) out.gender ??= 'Erkek'
    }
    // Kan grubu: "A Rh+", ehliyet arkası "13. ORh+"
    const blood = line.match(/(?:^|[^\p{L}])(AB|A|B|0|O)\s*Rh\s*([+-]|pozitif|negatif)/iu)
    if (blood) {
      const g = blood[1].toUpperCase() === 'O' ? '0' : blood[1].toUpperCase()
      out.blood_type ??= `${g} Rh${/^[+p]/i.test(blood[2]) ? '+' : '-'}`
    }
    // Ehliyet 9. alanı: sınıflar ("9. B B1 D1 FM") — personel kartında tek sınıf seçilir, en yaygın olan önce
    if (docType === 'ehliyet') {
      const cls = line.match(/^9\s*[.)]\s*(.+)$/)
      if (cls) {
        const tokens = cls[1].toUpperCase().split(/[\s,;/]+/)
        out.license_class ??= LICENSE_CLASSES.find((c) => tokens.includes(c))
      }
    }
  })

  // Adres: ikametgâh belgesi, sağlık raporu, iş sözleşmesi — "MAH." ile başlayan satır ve devamı
  if (docType === 'ikametgah' || docType === 'saglik_raporu' || docType === 'is_sozlesmesi' || docType === 'nufus_kayit') {
    out.address = findAddress(lines)
  }
  // Telefon: kişinin kendi beyanı olan belgelerden (sözleşme, sağlık raporu, başvuru) — cep numarası
  if (docType === 'is_sozlesmesi' || docType === 'saglik_raporu' || docType === 'cv' || docType === 'aile_durum') {
    for (let i = 0; i < lines.length && !out.phone; i++) {
      if (!/telefon|tel\s*no|cep|gsm|mobile|phone/.test(low[i]) || /işveren|isveren|firma|şirket|sirket/.test(low[i])) continue
      const m = `${lines[i]} ${lines[i + 1] ?? ''}`.match(/(?<!\d)(?:\+?90\s*)?0?\s*(5\d{2})[\s.-]*(\d{3})[\s.-]*(\d{2})[\s.-]*(\d{2})(?!\d)/)
      if (m) out.phone = formatPhoneTR(`0${m[1]}${m[2]}${m[3]}${m[4]}`)
    }
  }
  if (docType === 'askerlik') {
    if (/terhis|yerine getir|yapmistir|tamamlam/.test(all)) out.military_status = 'Yapıldı'
    else if (/muaf/.test(all)) out.military_status = 'Muaf'
    else if (/tecil/.test(all)) out.military_status = 'Tecilli'
  }
  if (docType === 'diploma') out.education = EDU.find(([re]) => re.test(all))?.[1]
  if (docType === 'banka') {
    const m = text.replace(/\s/g, '').toUpperCase().match(/TR\d{24}/)
    if (m) out.iban = m[0]
  }
  for (const k of Object.keys(out) as (keyof IdInfo)[]) if (!out[k]) delete out[k]
  return out
}

/** Belgedeki kişi adresi: "Adresi:" etiketinin değeri ya da "Mah." geçen satır + sonraki adres satırları (il adına kadar) */
function findAddress(lines: string[]): string | undefined {
  const isAddr = (s: string) => /\b(mah|mahallesi|sk|sok|sokak|cad|caddesi|apt|blok|no\s*:|kapi no|bulvar|bulvari)\b/.test(fold(s))
  const stop = /aciklama|açiklama|telefon|tel\s*:|e-?posta|kurumu|baslangic|başlangiç|ev ve cep|^\d+\s*[-.]\s/
  // Sütunlu belgelerde (ikametgâh) satır başlıklarla karışır: "Yerleşim Yeri  Yurtiçi  3831101112  2000 EVLER MAH."
  const LABEL = /^(yerleşim yeri|yerlesim yeri|yurtiçi|yurtici|yurtdişi|yurtdisi|adresi?|adres tipi|adres türü|adres no|ikametgah adresi|ikametgâh adresi|diğer adres|diger adres)\s*:?$/
  const keep = (line: string) =>
    line
      .split(/\s{2,}/)
      .map((p) => p.replace(/^(ikametgah adresi|ikametgâh adresi|adresi?)\s*:\s*/i, '').replace(/^:\s*/, '').trim())
      .filter((p) => p && !LABEL.test(fold(p)) && !/^\d{7,}$/.test(p))
      .join(' ')
  let best: string | undefined
  for (let i = 0; i < lines.length; i++) {
    const l = fold(lines[i])
    const labelled = /^(ikametgah adresi|ikametgâh adresi|adresi?)\s*:/.test(l)
    if (!labelled && !/\bmah\b|mahallesi/.test(l)) continue
    // İşverenin (şirketin) adresi alınmaz
    if (/işveren|isveren|unvan/.test(lines.slice(Math.max(0, i - 2), i + 1).map(fold).join(' '))) continue
    const parts = [keep(lines[i])]
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const lj = fold(lines[j])
      if (stop.test(lj) || /\d{10,}/.test(lj)) break
      const part = keep(lines[j])
      // Devam satırı: adres sözcüğü içerir ya da yalnız il/ilçe adıdır ("SEYHAN / ADANA", "ADANA")
      if (part && (isAddr(part) || /^[\p{L}\s/]{3,30}$/u.test(part))) parts.push(part)
      else break
    }
    const v = parts.join(' ').trim()
    if (isAddr(v) && v.length >= 15 && (!best || v.length > best.length)) best = v
  }
  return best ? formatAddress(best) : undefined
}

/** Birden çok belgeden okunanlar birleşir; ilk bulunan değer kalır (belgeler güvenilirlik sırasıyla verilmeli) */
export function mergeIdInfo(list: IdInfo[]): IdInfo {
  const out: IdInfo = {}
  for (const info of list) for (const k of ID_FIELDS) if (info[k] && !out[k]) out[k] = info[k]
  return out
}

/** Kişinin kartında boş olan alanlar için belgeden okunan değerler (dolu alanlar korunur) */
export function missingIdFields(person: Personnel, info: IdInfo): IdInfo {
  const out: IdInfo = {}
  for (const k of ID_FIELDS) if (info[k] && !person[k]) out[k] = info[k]
  return out
}

/** "T.C. Kimlik No, Doğum Tarihi" — bildirimde gösterilir */
export const idFieldList = (info: IdInfo) => (Object.keys(info) as (keyof IdInfo)[]).map((k) => ID_FIELD_LABELS[k]).join(', ')
