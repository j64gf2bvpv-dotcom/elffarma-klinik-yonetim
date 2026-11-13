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
const NAME_WORD = `(?:[${UP}][${LOW}]+(?:-[${UP}][${LOW}]+)?|[${UP}]{2,})`
// Ünvan + 1-4 büyük harfle başlayan kelime ("Prof. Dr. Ahmet ER", "Dr Ümran Kale", "Dr. Şehmuz Bey")
const DOC_NAME_RE = new RegExp(`(?:(?:Prof|Doç|Doc|Op|Uzm)\\.?\\s*)*Dr\\.?\\s+${NAME_WORD}(?:\\s+${NAME_WORD}){0,3}`, 'g')
const TITLE_START = /^(?:prof|doç|doc|op|uzm|dr)\b\.?/i
// Adın sonuna takılan, isim olmayan kelimeler ("Dr. Tolga Şahin Bugün …", "Dr. Garip Gülfırat Ziyaret …")
const NAME_STOP = /^(bugün|ziyaret|görüşme|görüşmede|klinik|kliniği|kliniğinde|sipariş|ürün|genel|telefon|tel|için|ile|ise|tarafından|tarafında|adana|istanbul|ankara|izmir|bursa)$/i

const PHONE_RE = /(?:\+?\s?90[\s.-]?)?(?:0\s?)?\(?0?\s?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/
const SEP_RE = /\s+[—–-]\s+|\s*:\s+|\s*:$/

// Özet/plan bölümleri: içerikleri ziyaret değildir
const SKIP_SECTION_RE = /^(genel değerlendirme|genel durum|değerlendirme|günün öne çıkan|öne çıkan|takip edilecek|öncelikli|özet|forecast|hedef|toplam|yarının|yarın|haftalık plan|ziyaret programı|aksiyon|sonuç|günlük program|araç|servis)|forecast|ziyaret programı|takip edilecek/i
// Selamlaşma / yazışma satırları başlık sayılmaz
const CHAT_RE = /merhaba|selam|kolay gelsin|iyi akşamlar|iyi günler|teşekkür|rica ederim|günaydın/i
// Rapor başlıkları: altındaki paragraflarda geçen doktorlar kayıttır
const REPORT_SECTION_RE = /(rapor|ziyaret edilen|ziyaret gerçekleştirilen|görüşme notları|saha|hekimler|kurumlar|sipariş bilgi|diğer çalışma|^not$|^notlar$)/i
// Bir kaydın içindeki bilgi satırları
const FIELD_RE = /^(ürün|miktar|toplam tutar|tutar|telefon|tel|gsm|cep|e-?posta|mail|vergi( dairesi| kimlik no| no)?|fatura|teslimat|adres|sipariş|iban)\b[^:]{0,25}:/i
const NOT_A_VISIT_RE = /toplantı|zoom|meeting|webinar/i

/** Başlıktaki ek bilgi ("Plastik Cerrahi", "Murat Bey / Merkez Sahibi") paragraftan " · " ile ayrılır */
const headNote = (rest: string) => (rest && !/[.!?]$/.test(rest) ? `${rest} ·` : rest)
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()
// Yalnız harf içeren kelimeler sayılır ('–', '/' gibi ayraçlar başlığı uzun göstermesin)
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length

/** "Dr Ümran kale" → "Dr. Ümran kale"; sondaki isim olmayan kelimeler ve iyelik ekleri atılır */
function tidyName(raw: string): string {
  let words = raw.replace(/[’'][a-zçğıöşü]+/gi, '').replace(/\s+/g, ' ').trim().split(' ')
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

/** Cari Kart / ziyaret için ad: ünvanlıysa yalnız isim, değilse ilk ayraçtan önceki kısım */
export function cleanVisitName(raw: string): string {
  const text = raw.replace(/^\s*(?:[•·●▪◦*\-–]|\d{1,3}[.)])\s*/, '').trim()
  if (TITLE_START.test(text)) {
    const names = findDoctorNames(text)
    if (names.length) return names[0]
  }
  return text.split(SEP_RE)[0].replace(/[\s,;/]+$/, '').trim()
}

// fromSentence: kayıt bir cümleden çıkarıldı ("Gün içerisinde Dr. X ile…") — sonraki adsız paragraflar genel yazıdır
type Rec = { names: string[]; phone: string; notes: string; bullet?: boolean; fromSentence?: boolean }

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
    for (const name of c.names) {
      if (!name || NOT_A_VISIT_RE.test(name)) continue
      out.push({ name, phone: c.phone, notes: c.notes.replace(/\s+/g, ' ').replace(/\s*·$/, '').trim() })
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
  let fieldOpen = false

  for (const raw of lines) {
    if (!raw.trim()) {
      prevBlank = true
      fieldOpen = false
      continue
    }
    const bullet = /^\s*(?:[•·●▪◦*\-–]|\d{1,3}[.)])\s+/.test(raw)
    const line = raw.replace(/^\s*(?:[•·●▪◦*\-–]|\d{1,3}[.)])\s*/, '').replace(/\*+/g, '').trim()
    const atBoundary = prevBlank || prevEnded || bullet || !cur
    const ended = /[.!?]$/.test(line)
    const words = wordCount(line)
    const phoneMatch = line.match(PHONE_RE)
    const phone = phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10 ? phoneMatch[0].trim() : ''
    const titled = TITLE_START.test(line)
    const noDate = line.replace(/^[\d.\s/–-]+(?=\p{L})/u, '').replace(/[\s–—-]+\d[\d.\s/]*$/, '').trim()

    try {
      if (fieldOpen && !titled) {
        append(line, false)
        continue
      }
      // 1) Kaydın bilgi satırı (Telefon:, Ürün:, Adres: …)
      if (!titled && FIELD_RE.test(line)) {
        fieldOpen = /:\s*$/.test(line)
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
        const names = findDoctorNames(line.slice(0, at))
        if (names.length) {
          start(names, phone, line.slice(at + phoneMatch![0].length).replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, ''), bullet)
          continue
        }
      }
      if (titled) {
        const [head, ...restParts] = line.split(SEP_RE)
        const rest = restParts.join(': ').trim()
        const headNames = findDoctorNames(head)
        if (restParts.length && headNames.length) {
          // "Dr. Ad – Plastik Cerrahi" / "Dr. Ad: açıklama" / "Dr. A & Dr. B" / "Dr. Ad — 0544…" / "Dr. A – Dr. B"
          const restNames = TITLE_START.test(rest) && wordCount(rest) <= 6 && !/[.!?]$/.test(rest) ? findDoctorNames(rest) : []
          const notes = restNames.length ? '' : phone ? rest.replace(phoneMatch![0], '').replace(/^[\s,;–—-]+|[\s,;–—-]+$/g, '') : rest
          start([...headNames, ...restNames], phone, headNote(notes), bullet)
        } else if (!ended && words <= 8 && headNames.length) {
          start(headNames, phone, '', bullet) // başlık: "Dr. Kerem Aras", "Dr. Oğuz Yaşar & Dr. Özer Özdemir"
        } else {
          // Cümle: "Dr. Hasan Asker ziyaret edildi. …" → ad cümleden, cümle açıklama
          const names = findDoctorNames(line).slice(0, 1)
          if (names.length) {
            start(names, phone, line)
            if (cur) (cur as Rec).fromSentence = true
          } else append(line, false)
        }
        continue
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
        start([head.replace(/[\s,;/]+$/, '').trim()], phone, headNote(restParts.join(': ').trim()), bullet)
        continue
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
