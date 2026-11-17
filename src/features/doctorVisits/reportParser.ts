import type { WordDoctorRow } from '@/features/customers/parseDoctorWord'

/**
 * Temsilci ziyaret raporu metnini (WhatsApp mesajı ya da resimden okunan yazı) doktor/kurum kayıtlarına
 * ayırır (kullanıcı isteği, 2026-11-13: "satırdan sonra bir başlık varsa o yeni kayıt olmalı, hepsi aynı
 * doktorun altına yazılmasın"; "caride isimlerin yanında bilgiler yazmasın").
 *
 * - Başlık satırı ("Dr. Metin Vural – Plastik Cerrahi", "Snap Clinic – Murat Bey", "• Dr. Aylin Akıncı",
 *   "1. Dr. Ad — 0544…") yeni kayıt başlatır; altındaki paragraflar onun açıklamasıdır.
 * - "Dr. Gaye Sarıkaya: FaceTime üzerinden…" tek satırlık kayıttır (ad : açıklama).
 * - Ad yalnızca isimdir: ayraçtan ( – — - : ) sonrası, telefon ve sipariş/fatura satırları açıklamaya/telefona gider.
 * - "Dr. A & Dr. B" / "Dr. A ve Dr. B" iki ayrı kayıttır.
 * - Rapor içinde "Eğitimin ardından Dr. X ziyaret edildi." diye başlayan yeni paragraf X'in kaydıdır.
 * - "Genel Değerlendirme", "Günün Öne Çıkan Fırsatları" gibi özet bölümleri ve "Yarının Ziyaret Programı"
 *   (henüz yapılmamış ziyaretler) okunmaz.
 */

const UP = 'A-ZÇĞİÖŞÜ'
const LOW = 'a-zçğıöşü'
const NAME_WORD = `(?!(?:Dr|Prof|Doç|Doc|Op|Uzm)\\b)(?:[${UP}][${LOW}]+(?:-[${UP}][${LOW}]+)?|[${UP}]{2,})`
// Ünvan + 1-4 büyük harfle başlayan kelime ("Prof. Dr. Ahmet ER", "Dr Ümran Kale", "Dr. Şehmuz Bey")
// "Dr. Ad" ve boşluksuz "Dr.Ad" ikisi de
const DOC_NAME_RE = new RegExp(`(?:(?:Prof|Doç|Doc|Op|Uzm)(?:\\.\\s*|\\s+))*Dr(?:\\.\\s*|\\s+)${NAME_WORD}(?:\\s+${NAME_WORD}){0,3}`, 'g')
const TITLE_TOKEN = '(?:(?:Prof|Doç|Doc|Op|Uzm)(?:\\.\\s*|\\s+))*Dr(?:\\.\\s*|\\s+)'
const ANY_WORD = '[A-Za-zÇĞİÖŞÜçğıöşü]+'
// Akan yazıda "… bir hekim Dr.Abdurrahman Bozkurt 0506 781 42 44 …" / "Dr.Asena balta Dr.İzzet balta 0532 …":
// ünvan + ad (küçük harfli soyad dahil) + telefon başladığı yerde yeni kayıt başlar
const MOBILE_START = '(?:\\+?90\\s?)?\\(?0?\\s?5\\d{2}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{2}[\\s.-]?\\d{2}(?!\\d)'
const RUN_ON_SPLIT = new RegExp(
  `(?<=\\S)(?<!\\b(?:Prof|Doç|Doc|Op|Uzm|Dr)\\.?)\\s+(?=(?:${TITLE_TOKEN}${ANY_WORD}(?:\\s+${ANY_WORD}){0,2}(?:\\s*\\([^)]*\\))?\\s+){1,3}${MOBILE_START})`,
  'g',
)
// Ünvansız: "… bırakıldı Murat Keskin 0533 608 08 …" — ünvanlı adın ortasından ("Dr.Zeynel Tolga kayhan") bölünmez
const RUN_ON_SPLIT_UNTITLED = new RegExp(
  `(?<=\\S)(?<!\\b(?:Prof|Doç|Doc|Op|Uzm|Dr)\\.?)(?<!(?:Prof|Doç|Doc|Op|Uzm|Dr)(?:\\.\\s*|\\s+)${ANY_WORD}(?:\\s+${ANY_WORD})?)\\s+(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\\s+${ANY_WORD}){1,2}\\s+${MOBILE_START})`,
  'g',
)
// Telefonsuz: "… deneyimleyecek Dr.Ersin uçan ziyaret edildi" / "Dr.Ersin uçan Ersin hoca ile…"
const RUN_ON_SPLIT_VISIT = new RegExp(
  `(?<=\\S)(?<!\\b(?:Prof|Doç|Doc|Op|Uzm|Dr)\\.?)\\s+(?=${TITLE_TOKEN}(\\p{L}+)(?:\\s+${ANY_WORD})?(?:\\s*\\([^)]*\\))?\\s+(?:ziyaret edil|ile görüşül|\\1\\s+(?:hoca|bey|hanım)))`,
  'gu',
)
// Emoji ve selamlaşma kapanışları kayda girmez (kullanıcı isteği, 2026-11-13: "emojileri de kullanma")
const EMOJI_RE = /\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\uFE0F|\u200D/gu
const CLOSING_RE = /\s*([iİ]yi akşamlar|[iİ]yi çalışmalar|kolay gelsin|[iİ]yi günler|teşekkürler|saygılarımla)[\s!.,]*$/i
const TITLE_START = /^(?:prof|doç|doc|op|uzm|dr)\b\.?/i
// Adın sonuna takılan, isim olmayan kelimeler ("Dr. Tolga Şahin Bugün …", "Dr. Garip Gülfırat Ziyaret …")
const NAME_STOP = /^(bugün|ziyaret|görüşme|görüşmede|klinik|kliniği|kliniğinde|sipariş|ürün|genel|telefon|tel|için|ile|ise|tarafından|tarafında|adana|istanbul|ankara|izmir|bursa)$/i

// Madde/numara işareti: "•", "*", "-", "1.", "1)", "1-)", "8-"
const LIST_MARK = /^\s*(?:[•·●▪◦*]|[-–](?=\s)|\d{1,3}\s*-?\s*[.)]|\d{1,3}\s*[-–](?!\d))\s*/
const PHONE_RE = /(?:\+?\s?90[\s.-]?)?(?:0\s?)?\(?0?\s?[2-5]\d{2}\)?[\s.-]{0,2}\d{3}[\s.-]{0,2}\d{2}[\s.-]{0,2}\d{2}(?!\d)/
const PHONE_ALL_RE = new RegExp(PHONE_RE.source, 'g')
/** Açıklamadaki telefonlar kayda (Telefon alanına) taşınır, metinden silinir (kullanıcı isteği, 2026-11-13) */
function pullPhones(c: { phone: string; notes: string }) {
  for (const m of c.notes.matchAll(PHONE_ALL_RE)) {
    if (m[0].replace(/\D/g, '').length < 10) continue
    if (!c.phone) c.phone = m[0].trim()
  }
  c.notes = c.notes
    .replace(PHONE_ALL_RE, (p) => (p.replace(/\D/g, '').length >= 10 ? ' ' : p))
    .replace(/\b(tel(efon)?|gsm|cep)\s*(no)?\s*:?\s*(?=[\s·,.;]|$)/gi, ' ')
    .replace(/\s+([,.;·])/g, '$1')
    .replace(/^[\s,.;:·–—-]+/, '')
}
const SEP_RE = /\s+[—–-]\s+|\s*:\s+|\s*:$/

// Özet/plan bölümleri: içerikleri ziyaret değildir
const SKIP_SECTION_RE = /^(genel değerlendirme|genel durum|değerlendirme|günün öne çıkan|öne çıkan|takip edilecek|öncelikli|özet|forecast|hedef|toplam|yarının|yarın|haftalık plan|ziyaret programı|aksiyon|sonuç|günlük program|araç|servis)|forecast|ziyaret programı|takip edilecek/i
// Selamlaşma / yazışma satırları başlık sayılmaz
const CHAT_RE = /merhaba|selam|kolay gelsin|iyi akşamlar|iyi günler|teşekkür|rica ederim|günaydın/i
// Rapor başlıkları: altındaki paragraflarda geçen doktorlar kayıttır
const REPORT_SECTION_RE = /(rapor|ziyaret edilen|ziyaret gerçekleştirilen|görüşme notları|saha|hekimler|kurumlar|sipariş bilgi|diğer çalışma|^not$|^notlar$|^sipariş$|^siparişler$)/i
// Bir kaydın içindeki bilgi satırları
const FIELD_RE = /^(ürün|miktar|toplam tutar|tutar|telefon|tel|gsm|cep|e-?posta|mail|vergi( dairesi| kimlik no| no)?|fatura|teslimat|adres|sipariş|iban)\b[^:]{0,25}:/i
const NOT_A_VISIT_RE = /toplantı|zoom|meeting|webinar|masterclass|master class|elffarma|kongre|organizasyon|workshop|eğitim|fiyat listesi/i
// Adın bittiğini gösteren kelimeler (fiil, ürün, işlem)
const NAME_END_RE =
  /^(ziyaret|edildi|ile|görüşül|görüşme|için|tarafından|ziyaretinde|paket|kutu|adet|flakon|ürün|sipariş|borç|ödeme|numune|katalog|kampanya|bvrs|mixo|fil+[iı]c[iı]a|pdrn|sap+h?[iı]re|el[iı]s[iı]r|el[iı]x[iı]r|star|somon|amc|vola|dna|vitapep|antiage|alanya|antalya|mersin|adana|ankara|istanbul|izmir|bursa|konya|kayseri|kırıkkale|manavgat|eryaman|gata)$/i
// Ünvansız kayıt adı ancak kurumsa kabul (kişi adı telefonla gelir): "Snap Clinic", "Kardelen Tıp Merkezi"
export const ORG_RE = /klinik|clinic|merkez|hastane|poliklinik|estetik|aesthetic|medikal|medical|medica|tıp|sağlık|güzellik|dental|diş|muayenehane|este\b/i
// Sipariş/fatura bilgisi: kayda yazılmaz (adres, vergi, TC, ÜTS, e-posta, IBAN)
const PRIVATE_LINE_RE = /(\b(mah\.?|mahallesi|sk\.?|sokak|cad\.?|caddesi|bulv\.?|bulvarı|apt\.?|daire|blok)\b|\bno\s*:|\bkat\s*:|\bvd\b|vergi|t\.?c\.?\s*(kimlik)?\s*(no)?\s*:|\büts\b|@|iban|\btr\d{2}\s?\d{4})/i
const PRIVATE_FIELD_RE = /^(e-?posta|mail|vergi|fatura|teslimat|adres|iban|t\.?c|üts)/i

/** Başlıktaki ek bilgi ("Plastik Cerrahi", "Murat Bey / Merkez Sahibi") paragraftan " · " ile ayrılır */
const headNote = (rest: string) => (rest && !/[.!?]$/.test(rest) ? `${rest} ·` : rest)
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()
// Yalnız harf içeren kelimeler sayılır ('–', '/' gibi ayraçlar başlığı uzun göstermesin)
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length

/** "Dr Ümran kale" → "Dr. Ümran kale"; sondaki isim olmayan kelimeler ve iyelik ekleri atılır */
function tidyName(raw: string): string {
  // Ünvanlar "Dr. " biçimine ("Dr.Ali" → "Dr. Ali", "Op.Dr.Ali" → "Op. Dr. Ali")
  const titled = raw.replace(/^((?:(?:Prof|Doç|Doc|Op|Uzm|Dr)\.?\s*)+)/i, (t) => t.replace(/(Prof|Doç|Doc|Op|Uzm|Dr)\.?\s*/gi, '$1. '))
  let words = titled.replace(/[’'][a-zçğıöşü]+/gi, '').replace(/\s+/g, ' ').trim().split(' ')
  while (words.length > 2 && NAME_STOP.test(words[words.length - 1])) words = words.slice(0, -1)
  return words.join(' ').replace(/^(Prof|Doç|Doc|Op|Uzm|Dr)\.?(?=\s)/gi, (t) => `${t.replace(/\.$/, '')}.`).replace(/\b(Dr|Prof|Doç|Op|Uzm)\.?\s+(?=Dr)/g, '$1. ')
}

/** Metindeki ünvanlı doktor adları (sırayla, tekrarsız) */
export function findDoctorNames(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(DOC_NAME_RE)) {
    const name = tidyName(m[0])
    if (!out.some((n) => fold(n) === fold(name))) out.push(name)
  }
  return out
}

/** Başlık satırındaki adlar: küçük harfli soyadı da kabul eder ("Dr.Asena balta Dr.İzzet balta" → iki ad) */
export function headingNames(text: string): string[] {
  // Ünvan dizileri bütün alınır ("Prof. Dr.", "Op. Dr." bölünmez)
  const marks = [...text.matchAll(new RegExp(TITLE_TOKEN, 'gi'))]
  const out: string[] = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length
    const m = [marks[i][0], marks[i][0], text.slice(start, i + 1 < marks.length ? marks[i + 1].index : undefined)]
    // Ad noktalama, rakam/saat, fiil, ürün kelimesi ya da küçük harfli hitapta biter
    // ("Dr.Ersin uçan ziyaret edildi", "Dr alparslan Tekiner 5 paket…", "Dr Mustafa sütçü 12:00", "Dr Hüseyin Öztürk (gata)")
    const all = m[2].replace(/[’'][a-zçğıöşü]+/gi, '').split(/[,;:.!?()]/)[0].replace(/[&–—-]+/g, ' ').replace(/\bve\b/gi, ' ').split(/\s+/).filter(Boolean)
    const allUpper = !!all[0] && all[0] === all[0].toLocaleUpperCase('tr-TR')
    const words: string[] = []
    // "Dr hanım ürünlerimizi…" — ad değil hitap
    if (/^(hanım|hanim|bey|hoca|hocam|hn)$/i.test(all[0] ?? '')) continue
    for (const [j, w] of all.entries()) {
      if (!/^\p{L}+$/u.test(w)) break
      if (j > 0 && (NAME_END_RE.test(w) || /^(hoca|hocam|bey|hanım|hn)$/.test(w) || (j > 1 && w === all[0]))) break
      // 3. kelimeden sonra küçük harf adın bittiğini gösterir — satır orada bitiyorsa soyadıdır ("Dr rümeysa nur bayrak")
      if (j >= 2 && /^[a-zçğıöşü]/.test(w) && j < all.length - 1 && /^\p{L}+$/u.test(all[j + 1])) break
      if (j >= 2 && !allUpper && w.length >= 3 && w === w.toLocaleUpperCase('tr-TR')) break // "Dr Mustafa kaplan GATA"
      words.push(w)
      if (words.length === 4) break
    }
    while (words.length > 1 && NAME_STOP.test(words[words.length - 1])) words.pop()
    if (!words.length) continue
    // Ayrılma eki: "Dr.Abdurrahman Bozkurttan 0506…" → Bozkurt
    const last = words[words.length - 1]
    if (words.length > 1 && last.length >= 8) words[words.length - 1] = last.replace(/(?<=\p{L}{5})(t|d)(a|e)n$/u, '')
    // Tamamı büyük harfli ad ("DR BIRGÜL ALTINTÜRK") → "Birgül ALTINTÜRK"
    const cap = (w: string, last: boolean) =>
      w === w.toLocaleUpperCase('tr-TR') && w.length > 1 ? (allUpper && !last ? w.slice(0, 1) + w.slice(1).toLocaleLowerCase('tr-TR') : w) : w.slice(0, 1).toLocaleUpperCase('tr-TR') + w.slice(1)
    const T: Record<string, string> = { prof: 'Prof.', doç: 'Doç.', doc: 'Doç.', op: 'Op.', uzm: 'Uzm.', dr: 'Dr.' }
    const title = m[1].replace(/(prof|doç|doc|op|uzm|dr)\.?\s*/gi, (t) => `${T[t.replace(/[.\s]/g, '').toLocaleLowerCase('tr-TR')]} `).trim()
    const name = `${title} ${words.map((w, j) => cap(w, j === words.length - 1)).join(' ')}`
    if (!out.some((n) => fold(n) === fold(name))) out.push(name)
  }
  return out
}

/** Cari Kart / ziyaret için ad: ünvanlıysa yalnız isim, değilse ilk ayraçtan önceki kısım */
export function cleanVisitName(raw: string): string {
  const text = raw.replace(LIST_MARK, '').trim()
  if (TITLE_START.test(text)) {
    const names = findDoctorNames(text)
    if (names.length) return names[0]
  }
  return text.split(SEP_RE)[0].replace(/[\s,;/]+$/, '').trim()
}

// fromSentence: kayıt bir cümleden çıkarıldı ("Gün içerisinde Dr. X ile…") — sonraki adsız paragraflar genel yazıdır
type Rec = { names: string[]; phone: string; notes: string; bullet?: boolean; fromSentence?: boolean; nameOnly?: boolean }

function capitalRatio(s: string): number {
  const words = s.split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (!words.length) return 0
  return words.filter((w) => new RegExp(`^[${UP}0-9]`).test(w)).length / words.length
}

export function parseReportLines(lines: string[]): WordDoctorRow[] {
  const out: WordDoctorRow[] = []
  let cur: Rec | null = null
  let section: 'none' | 'skip' | 'report' = 'none'
  let prevBlank = true
  let prevEnded = true

  const append = (text: string, paragraph: boolean) => {
    if (!cur || !text.trim()) return
    const t = text.trim()
    cur.notes = cur.notes ? `${cur.notes}${paragraph ? ' ' : ' '}${t}` : t
  }
  const close = () => {
    const c = cur
    cur = null
    if (!c) return
    if (!c.names.length) c.names = findDoctorNames(c.notes).slice(0, 1)
    pullPhones(c)
    for (const name of c.names) {
      if (!name || NOT_A_VISIT_RE.test(name)) continue
      // Açıklama doktorun adıyla başlamasın ("Dr Sabri güncan ( kampanya…" → "kampanya…")
      const nameWords = name.replace(/^(?:(?:Prof|Doç|Op|Uzm|Dr)\.\s*)+/, '').split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      const ownName = new RegExp(`^${TITLE_TOKEN}${nameWords.join('\\s+')}\\s*[(:,;–—-]*\\s*`, 'iu')
      const notes = c.notes
        .replace(/<?\s*bu mesaj düzenlendi\s*>?/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*·$/, '')
        .replace(CLOSING_RE, '')
        .trim()
      // Ad cümlenin öznesiyse ("Dr. Cihan Kirişçioğlu ile ürünlerimizin…") kalır
      out.push({ name, phone: c.phone.replace(/\s{2,}/g, ' ').trim(), notes: notes.replace(ownName, (m) => (/^(ile|ziyaret|tarafından|için|[’'])/i.test(notes.slice(m.length)) ? m : '')).trim() })
    }
  }
  const start = (names: string[], phone: string, notes: string, bullet = false) => {
    // Aynı doktorun yeni paragrafı ("Dr. Tolga Şahin, gruba Ekim…") yeni kayıt açmaz
    if (cur && names.length && names.every((n) => cur!.names.some((c) => fold(c) === fold(n)))) {
      append(notes, true)
      if (!cur.phone) cur.phone = phone
      return
    }
    close()
    cur = { names, phone, notes, bullet }
  }
  // "Teslimat Adresi:" / "Ürün Talebi:" gibi değeri alt satırlarda devam eden alan
  let fieldOpen: false | 'keep' | 'drop' = false

  const nameOnly = new RegExp(`^\\s*${TITLE_TOKEN}${ANY_WORD}(?:\\s+${ANY_WORD}){0,2}\\s*$`, 'i')
  const prepared = lines.flatMap((l) => {
    // Akan yazıdan bölünen parçalar madde gibi işaretlenir (yeni kayıt sınırı)
    // İsim düzeltme mesajları ("Dr.Melike Şener değil", "ismi yanlış yazdım") kayıt değildir
    if (/\bdeğil\s*$|yanlış yazdım|yanlis yazdim/i.test(l)) return ['']
    const parts = l
      .replace(EMOJI_RE, '')
      .replace(/\b(Dr|Prof|Op|Uzm|Doç)\s+\.(?=\s*\p{L})/giu, '$1.')
      .replace(/(\p{L})\(/gu, '$1 (')
      // satır içi numaralı liste: "… 5-)Dr Fatih … 6-)Dr Pelin …"
      .replace(/(?<=\S)\s*\d{1,2}\s*-?\)\s*(?=(?:dr|prof|op|uzm)\b)/gi, '\n• ')
      .replace(RUN_ON_SPLIT, '\n• ').replace(RUN_ON_SPLIT_UNTITLED, '\n• ').replace(RUN_ON_SPLIT_VISIT, '\n• ').split('\n')
    const bare = (p: string) => p.replace(/^•\s*/, '')
    // Cümle başındaki kısa girişten ("Eğitimin ardından Dr. X ziyaret edildi.") bölünmez — cümle bütün kalır
    for (let i = parts.length - 1; i > 0; i--) {
      const tail = bare(parts[i - 1]).split(/(?<!\b(?:Dr|Prof|Doç|Doc|Op|Uzm|Dt))[.!?]\s+/).pop() ?? ''
      const isRecord = TITLE_START.test(tail.trim()) || PHONE_RE.test(tail)
      if (!/[.!?]\s*$/.test(parts[i - 1]) && tail.trim() && !isRecord && wordCount(tail) <= 3) parts.splice(i - 1, 2, `${parts[i - 1]} ${bare(parts[i])}`)
    }
    // "Dr.Asena balta" + "Dr.İzzet balta 0532…" aynı satırdan bölündüyse birleşir (ortak telefon/açıklama)
    for (let i = parts.length - 2; i >= 0; i--) if (nameOnly.test(bare(parts[i])) && TITLE_START.test(bare(parts[i + 1]).trim())) parts.splice(i, 2, `${parts[i]} ${bare(parts[i + 1])}`)
    return parts
  })
  const phoneOnly = (l: string | undefined) => !!l && PHONE_RE.test(l) && !/\p{L}{3}/u.test(l.replace(PHONE_RE, ''))
  for (const [idx, raw] of prepared.entries()) {
    if (!raw.trim()) {
      prevBlank = true
      fieldOpen = false
      continue
    }
    const bullet = LIST_MARK.test(raw) && !/^\s*\d{1,3}\s*[.]\d/.test(raw)
    const line = raw.replace(LIST_MARK, '').replace(/\*+/g, '').trim()
    const atBoundary = prevBlank || prevEnded || bullet || !cur
    const ended = /[.!?]$/.test(line)
    const words = wordCount(line)
    const phoneMatch = line.match(PHONE_RE)
    const phone = phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10 ? phoneMatch[0].trim() : ''
    const titled = TITLE_START.test(line)
    const noDate = line.replace(/^[\d.\s/–-]+(?=\p{L})/u, '').replace(/[\s–—-]+\d[\d.\s/]*$/, '').trim()

    try {
      if (fieldOpen && !titled) {
        if (fieldOpen === 'keep' && !PRIVATE_LINE_RE.test(line)) append(line, false)
        continue
      }
      // Adres/vergi/TC/e-posta satırları hiçbir kayda yazılmaz
      if (!titled && PRIVATE_LINE_RE.test(line) && !phone) continue
      // 1) Kaydın bilgi satırı (Telefon:, Ürün:, Adres: …)
      if (!titled && FIELD_RE.test(line)) {
        fieldOpen = /:\s*$/.test(line) ? (PRIVATE_FIELD_RE.test(line) ? 'drop' : 'keep') : false
        if (PRIVATE_FIELD_RE.test(line) && !/^(telefon|tel|gsm|cep)/i.test(line)) continue
        const c = cur as Rec | null
        if (c && section !== 'skip') {
          if (phone && !c.phone && /^(telefon|tel|gsm|cep)/i.test(line)) c.phone = phone
          else append(line, false)
        }
        continue
      }
      // 2) Bölüm başlığı (özet/plan → atla; rapor → içindeki doktorlar kayıt)
      const sectionText = noDate.replace(/:$/, '').trim()
      if (!titled && words <= 8 && !ended && (SKIP_SECTION_RE.test(sectionText) || (REPORT_SECTION_RE.test(sectionText) && !bullet) || (line === line.toLocaleUpperCase('tr-TR') && /\p{L}{3}/u.test(line) && words <= 5))) {
        close()
        section = SKIP_SECTION_RE.test(noDate) ? 'skip' : 'report'
        continue
      }
      if (section === 'skip') continue

      // 3) Ünvanla başlayan satır
      if (titled && phone) {
        // "Dr. Ad - 0532 … - açıklama" / "Dr. Ad 0532 … açıklama": ad telefondan önce, açıklama sonra
        const at = line.indexOf(phoneMatch![0])
        const names = headingNames(line.slice(0, at))
        if (names.length) {
          start(names, phone, line.slice(at + phoneMatch![0].length).replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, ''), bullet)
          continue
        }
      }
      if (titled) {
        const [head, ...restParts] = line.split(SEP_RE)
        const rest = restParts.join(': ').trim()
        const headNames = wordCount(head) <= 8 ? headingNames(head) : findDoctorNames(head)
        if (restParts.length && headNames.length) {
          // "Dr. Ad – Plastik Cerrahi" / "Dr. Ad: açıklama" / "Dr. A & Dr. B" / "Dr. Ad — 0544…" / "Dr. A – Dr. B"
          const restNames = TITLE_START.test(rest) && wordCount(rest) <= 6 && !/[.!?]$/.test(rest) ? findDoctorNames(rest) : []
          const notes = restNames.length ? '' : phone ? rest.replace(phoneMatch![0], '').replace(/^[\s,;–—-]+|[\s,;–—-]+$/g, '') : rest
          start([...headNames, ...restNames], phone, headNote(notes), bullet)
        } else if (!ended && words <= 8 && headNames.length) {
          const c = cur as Rec | null
          // Alt alta yazılmış, aynı yerdeki hekimler ortak telefon/açıklama paylaşır:
          // "Dr. Çağan Dikmen" / "Dr.püren Dikmen" / "0539 …" / "Doktorlar ziyaret edildi…"
          // Yalnız ikisi de salt ad satırıysa ("Dr Olympos hastanesi yeşim yayla izin de" gibi ekli satırlar birleşmez)
          const lineNameOnly = wordCount(line) <= headNames.reduce((n, h) => n + wordCount(h.replace(/^(?:(?:Prof|Doç|Op|Uzm|Dr)\.\s*)+/, '')) + 1, 0)
          if (c && c.nameOnly && lineNameOnly && !bullet && !c.bullet && !prevBlank && !c.phone && !c.notes && !c.fromSentence && !phone && (phoneOnly(prepared[idx + 1]) || phoneOnly(prepared[idx + 2]))) {
            for (const n of headNames) if (!c.names.some((x) => fold(x) === fold(n))) c.names.push(n)
            continue
          }
          start(headNames, phone, '', bullet) // başlık: "Dr. Kerem Aras", "Dr. Oğuz Yaşar & Dr. Özer Özdemir"
          if (cur && lineNameOnly) (cur as Rec).nameOnly = true
        } else {
          // Cümle: "Dr. Hasan Asker ziyaret edildi. …" → ad cümleden, cümle açıklama
          let names = findDoctorNames(line).slice(0, 1)
          // Küçük harfli ad ("Dr alparslan Tekiner 5 paket…") büyük harf kuralına uymaz → başlık ayrıştırıcısı
          const hn = headingNames(line.split(/\s+/).slice(0, 6).join(' ')).slice(0, 1)
          if (hn.length && (!names.length || hn[0].length > names[0].length)) names = hn
          let notes = line
          if (bullet) {
            names = headingNames(line.split(/\s+/).slice(0, 4).join(' ')).slice(0, 1)
            // Açıklama adla başlamasın: "Dr.Ersin uçan Ersin hoca ile…" → "Ersin hoca ile…"
            const nameWords = names[0] ? names[0].split(' ').filter((w) => !/^(Prof|Doç|Doc|Op|Uzm|Dr)\.$/.test(w)).length : 0
            const m = line.match(new RegExp(`^${TITLE_TOKEN}(?:\\S+\\s*){${nameWords}}`, 'i'))
            if (names[0] && m) notes = line.slice(m[0].length).trim()
          }
          if (names.length) {
            start(names, phone, notes)
            if (cur) (cur as Rec).fromSentence = true
          } else append(line, false)
        }
        continue
      }

      // 3b) Ünvansız "Ad Soyad 0533 … açıklama" (madde/yeni satır başında)
      if (!titled && phone && atBoundary) {
        const at = line.indexOf(phoneMatch![0])
        const prefix = line.slice(0, at).replace(/[\s,:;–—-]+$/, '').trim()
        if (prefix && wordCount(prefix) <= 4 && !/\d/.test(prefix) && capitalRatio(prefix) >= 0.5 && !CHAT_RE.test(prefix) && !NOT_A_VISIT_RE.test(prefix) && !PRIVATE_LINE_RE.test(prefix)) {
          start([prefix.split(/\s+/).map((w) => w.slice(0, 1).toLocaleUpperCase('tr-TR') + w.slice(1)).join(' ')], phone, line.slice(at + phoneMatch![0].length).replace(/^[\s,;:|–—-]+/, ''), true)
          continue
        }
      }
      // 3b') Ünvansız ad satırı + alt satırda telefon: "Murat Keskin" / "0533 608 08 43"
      if (!titled && !phone && phoneOnly(prepared[idx + 1]) && wordCount(line) >= 2 && wordCount(line) <= 4 && !/\d/.test(line) && capitalRatio(line) === 1 && !CHAT_RE.test(line) && !NOT_A_VISIT_RE.test(line) && !PRIVATE_LINE_RE.test(line)) {
        start([line.split(/\s+/).map((w) => w.slice(0, 1).toLocaleUpperCase('tr-TR') + w.slice(1)).join(' ')], '', '')
        continue
      }
      // 3c) Ünvansız liste maddesi adla başlıyorsa kayıt: "1-)Caner emlik ( Bvrs…", "2-)Yılmaz turan Bvrs pl…"
      if (bullet && !titled && /^[A-ZÇĞİÖŞÜ]/.test(line) && !CHAT_RE.test(line) && !NOT_A_VISIT_RE.test(line) && !PRIVATE_LINE_RE.test(line) && !ORG_RE.test(line.split(/\s+/).slice(0, 4).join(' '))) {
        const nm = headingNames(`Dr. ${line}`)[0]?.replace(/^Dr\.\s*/, '')
        if (nm && nm.split(' ').length >= 2) {
          const used = line.match(new RegExp(`^(?:\\S+\\s*){${nm.split(' ').length}}`))?.[0] ?? ''
          start([nm], phone, line.slice(used.length).replace(/^[\s(,;:–—-]+/, ''), true)
          continue
        }
      }
      // 4) Ünvansız başlık: klinik/kurum ya da kişi ("Snap Clinic – Murat Bey", "Medica Work:", "No On Clinic")
      // Telefon başlık kontrolüne katılmaz ("30. Sevde Alacacı Sağlık Hizmetleri — 0505 950 37 88")
      const bare = (phoneMatch && phone ? line.replace(phoneMatch[0], '') : line).replace(/[\s:—–-]+$/, '').trim()
      const lastWord = bare.split(/\s+/).pop() ?? ''
      if (
        atBoundary &&
        !/[.!?,]$/.test(bare) &&
        wordCount(bare) <= 14 &&
        capitalRatio(bare) >= 0.6 &&
        new RegExp(`^[${UP}]`).test(lastWord) &&
        !/\d{5,}/.test(bare) &&
        !CHAT_RE.test(bare) &&
        !/^(ziyaret|görüşme|ayrıca|daha|bugün|sabah|gün)\b/i.test(bare)
      ) {
        const [head, ...restParts] = bare.split(SEP_RE)
        const orgName = head.replace(/[\s,;/]+$/, '').trim()
        // Yalnız kurumlar kayıt olur; "Uygun", "Masterclass Adana", "Elffarma …" gibi kısa satırlar atılır
        if (ORG_RE.test(orgName) && !NOT_A_VISIT_RE.test(orgName) && wordCount(orgName) >= 2 && !/^(merkez|klinik|hastane|şube)\b/i.test(orgName)) {
          start([orgName], phone, headNote(restParts.join(': ').trim()), bullet)
          continue
        }
        if (wordCount(bare) <= 3 || NOT_A_VISIT_RE.test(bare)) continue
      }
      // Madde listesinden sonra gelen genel paragraf ("ziyaret edilmiştir. Doktorlarla…") son maddeye yazılmaz
      const c0 = cur as Rec | null
      if (c0?.bullet && !c0.notes && (prevBlank || /^[a-zçğıöşü]/.test(line)) && !findDoctorNames(line).length) {
        close()
        continue
      }

      // 5) Düz yazı: yeni paragraf başka bir doktorla başlıyorsa onun kaydı, değilse mevcut kayda eklenir
      const firstSentence = line.split(/(?<!\b(?:Dr|Prof|Doç|Doc|Op|Uzm|Dt))[.!?]\s/)[0]
      const paragraphDoctor = (prevBlank || !cur) && findDoctorNames(firstSentence)[0]
      if (paragraphDoctor) {
        start([paragraphDoctor], phone, line)
        if (cur) (cur as Rec).fromSentence = true
      } else {
        const c = cur as Rec | null
        if (c?.fromSentence && prevBlank) {
          // Cümleden çıkan kaydın ardından gelen adsız paragraf genel yazıdır (hava durumu, ekip toplantısı…)
          close()
        } else if (c) {
          if (phone && !c.phone) c.phone = phone
          append(line, prevBlank)
        }
      }
    } finally {
      prevBlank = false
      prevEnded = ended
    }
  }
  close()

  // Aynı mesajda aynı doktor iki kez geçtiyse birleştir
  const merged: WordDoctorRow[] = []
  for (const r of out) {
    const prev = merged.find((m) => fold(m.name) === fold(r.name))
    if (!prev) merged.push(r)
    else {
      if (!prev.phone) prev.phone = r.phone
      if (r.notes && !prev.notes.includes(r.notes)) prev.notes = prev.notes ? `${prev.notes} ${r.notes}` : r.notes
    }
  }
  return merged
}
