/**
 * Programın her yerinde aynı isim ve telefon düzeni (kullanıcı isteği, 2026-11-17: "numaraları girerken
 * otomatik boşluk versin, isimlerin baş harfleri büyük diğerleri küçük, soyadlarda hep büyük; programın her
 * yerinde aynı işlesin"). Kayıt sırasında api katmanında, telefon yazarken de ortak Input bileşeninde kullanılır.
 */

const TITLES: Record<string, string> = { prof: 'Prof.', doç: 'Doç.', doc: 'Doç.', op: 'Op.', uzm: 'Uzm.', dr: 'Dr.', dt: 'Dt.', ecz: 'Ecz.' }
// Soyadı yerine yazılan hitaplar ("Dr. Ömer Hoca", "Ayşe Hanım") büyük harfe çevrilmez
const HONORIFIC_RE = /^(hoca|hocam|hanım|hanim|bey|abla|abi|yenge|yengem|teyze|amca|dayı)$/i
// Kurum adları olduğu gibi kalır
const ORG_RE = /klinik|clinic|merkez|hastane|poliklinik|estetik|aesthetic|medikal|medical|tıp|sağlık|güzellik|dental|muayenehane|ltd|a\.ş|şirket|eczane/i

const up = (s: string) => s.toLocaleUpperCase('tr-TR')
const low = (s: string) => s.toLocaleLowerCase('tr-TR')
const cap = (w: string) => w.split(/([-'’])/).map((p) => (/^[-'’]$/.test(p) ? p : up(p.slice(0, 1)) + low(p.slice(1)))).join('')

const FRONT = /[EÖÜİ]/
const BACK = /[AOU]/
/**
 * Büyük harfle yazılmış kelimedeki "I": taranmış belgelerde İ'nin noktası çoğu zaman okunmaz ("KEÇIÖREN"). Türkçe
 * ünlü uyumuna göre karar verilir: yakınındaki ünlü ince (e, ö, ü, i) ise i, kalın (a, o, u) ise ı — "KEÇIÖREN" →
 * "Keçiören", "YELLICE" → "Yellice", "KAPI" → "Kapı". Karar verilemezse i.
 */
function fixUpperI(w: string): string {
  if (!w.includes('I') || w !== up(w)) return w
  // Ünlü uyumuna uymayan bilinen yer adları
  const known = ['İSTANBUL', 'İZMİR', 'İZMİT', 'İSKENDERUN', 'İNEGÖL', 'DİYARBAKIR', 'İSTİKLAL', 'CUMHURİYET', 'MİLLET', 'İNÖNÜ'].find(
    (k) => k.replace(/İ/g, 'I') === w.replace(/İ/g, 'I'),
  )
  if (known) return known
  const chars = [...w]
  return chars
    .map((c, i) => {
      if (c !== 'I') return c
      for (let j = i - 1; j >= 0; j--) if (FRONT.test(chars[j]) || BACK.test(chars[j]) || chars[j] === 'Ğ') {
        if (FRONT.test(chars[j])) return 'İ'
        if (BACK.test(chars[j])) return 'I'
      }
      for (let j = i + 1; j < chars.length; j++) {
        if (FRONT.test(chars[j])) return 'İ'
        if (BACK.test(chars[j])) return 'I'
      }
      return 'İ'
    })
    .join('')
}
/** Yer/adres kelimesi: büyük harfli yazımdaki I düzeltilip baş harf büyük yapılır */
const capPlace = (w: string) => cap(fixUpperI(w))

/** "emrah karabıyık" → "Emrah KARABIYIK", "DR mustafa yavuz" → "Dr. Mustafa YAVUZ", "Dr. Ömer hoca" → "Dr. Ömer Hoca" */
export function formatPersonName(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!s || ORG_RE.test(s) || /[\d@]/.test(s)) return s
  const titles: string[] = []
  let rest = s
  for (;;) {
    const m = rest.match(/^(prof|doç|doc|op|uzm|dr|dt|ecz)\b\.?\s*/i)
    if (!m || m[0].length >= rest.length) break
    titles.push(TITLES[low(m[1])])
    rest = rest.slice(m[0].length)
  }
  const words = rest.split(' ')
  const last = words.length - 1
  const hasSurname = words.length > 1 && !HONORIFIC_RE.test(words[last])
  const out = words.map((w, i) => {
    if (!/^[\p{L}'’-]+$/u.test(w)) return w // "E.Egemen", "(Mersin)" gibi parçalara dokunma
    return hasSurname && i === last ? up(w) : cap(w)
  })
  return [...titles, ...out].join(' ')
}

/** Türkiye numarası "0532 123 45 67" biçimine; tanınmayan numara olduğu gibi döner */
export function formatPhoneTR(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  const d = v.replace(/\D/g, '')
  let local = d
  if (d.startsWith('90') && d.length === 12) local = `0${d.slice(2)}`
  else if (d.length === 10 && /^[2-5]/.test(d)) local = `0${d}`
  if (local.length === 11 && local.startsWith('0')) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9)}`
  return v
}

/** Yazarken boşlukları kendiliğinden ekler: "05387" → "0538 7", "05387858474" → "0538 785 84 74" */
export function formatPhoneTyping(value: string): string {
  if (/\p{L}/u.test(value)) return value
  if (/^\s*\+/.test(value) && !/^\s*\+\s*9\s*0?/.test(value)) return value // yurt dışı numara
  let d = value.replace(/\D/g, '')
  if ((/^\s*\+/.test(value) || d.length > 11) && d.startsWith('90')) d = `0${d.slice(2)}`
  else if (d.startsWith('5') || d.startsWith('2') || d.startsWith('3') || d.startsWith('4')) d = `0${d}`
  if (!d) return ''
  const parts = [d.slice(0, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11), d.slice(11)].filter(Boolean)
  return parts.join(' ')
}

/** Yer adı: "KADIKÖY-ISTANBUL" / "adana/yüreğir" → "Kadıköy-Istanbul" / "Adana / Yüreğir" */
export function formatPlaceName(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim()
  return s
    .split(' ')
    .map((w) => (w === '/' ? w : capPlace(w)))
    .join(' ')
}

// Adres kısaltmaları — tek tip yazılır
const ADDRESS_ABBR: [RegExp, string][] = [
  [/^(mah|mahallesi|mahalle|mh)\.?$/i, 'Mah.'],
  [/^(sok|sk|sokak|sokağı|sokagi)\.?$/i, 'Sk.'],
  [/^(cad|cd|caddesi|cadde)\.?$/i, 'Cad.'],
  [/^(bulv|blv|bulvarı|bulvari)\.?$/i, 'Bulv.'],
  [/^(apt|apartmanı|apartmani)\.?$/i, 'Apt.'],
  [/^(sit|sitesi)\.?$/i, 'Sitesi'],
  [/^(kat)\.?$/i, 'Kat'],
  [/^(daire|d)\.?$/i, 'Daire'],
  [/^(blok|blk)\.?$/i, 'Blok'],
]

/**
 * Adres tek düzende yazılır (kullanıcı isteği, 2026-11-17: "doğru eksiksiz düzenli nizami olsun"):
 * "2000 evler mah 76034 sok lale apt no 24/2 seyhan/adana" → "2000 Evler Mah. 76034 Sk. Lale Apt. No: 24/2 Seyhan / Adana".
 * Kelimelerin baş harfi büyük, kısaltmalar tek tip, "No"/"İç Kapı No" iki noktalı; içerik değiştirilmez.
 */
export function formatAddress(raw: string | null | undefined): string {
  let s = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  // "5088.no.relaxplus" gibi noktayla bitişik yazılmış kelimeler ayrılır (sayı içi nokta/kesir korunur)
  s = s.replace(/(\p{L})\.(?=[\p{L}\d])/gu, '$1. ').replace(/(\d)\.(?=\p{L})/gu, '$1. ')
  // "d:4" → "d: 4"; "56:56" gibi rakam arası iki nokta olduğu gibi kalır
  s = s.replace(/\s*\/\s*/g, ' / ').replace(/\s*,\s*/g, ', ').replace(/(\p{L})\s*:\s*/gu, '$1: ')
  // "24 / 2" kapı numarası kesri bitişik kalır
  s = s.replace(/(\d) \/ (\d)/g, '$1/$2')
  const words = s.split(' ')
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const bare = w.replace(/[.,:]+$/, '')
    const tail = w.slice(bare.length).replace(/^\./, '')
    const abbr = ADDRESS_ABBR.find(([re]) => re.test(bare))
    if (abbr) {
      out.push(abbr[1] + tail.replace(/^\./, ''))
      continue
    }
    if (/^no$/i.test(bare)) {
      out.push(/^\d/.test(words[i + 1] ?? '') ? 'No:' : 'No.')
      continue
    }
    if (/^(iç|ic)$/i.test(bare) && /^kap[ıi]$/i.test(words[i + 1]?.replace(/[.,:]+$/, '') ?? '')) {
      out.push('İç Kapı')
      i++
      continue
    }
    // Tek harfli blok adı (G Blok) ve rakamla başlayanlar olduğu gibi büyük
    if (/^\p{L}$/u.test(bare)) out.push(up(bare) + tail)
    else if (/^\d/.test(bare)) out.push(up(w))
    else out.push(capPlace(bare) + tail)
  }
  return out
    .join(' ')
    .replace(/No: :/g, 'No:')
    .replace(/(\d\.)(?=\p{L})/gu, '$1 ')
    .replace(/No:(?=\S)/g, 'No: ')
    .replace(/\s+/g, ' ')
    .trim()
}

const SMALL_WORDS = new Set(['ve', 'ile', 'veya', 'de', 'da', 'ki'])
/**
 * Görev, birim gibi serbest metinler: her kelimenin baş harfi büyük ("türkiye satış direktörü" → "Türkiye Satış
 * Direktörü"); "ve/ile" küçük kalır, "IT", "AR-GE" gibi kısa büyük harfli kısaltmalara dokunulmaz.
 */
export function formatTitleText(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => {
      if (i > 0 && SMALL_WORDS.has(low(w))) return low(w)
      if (/^\p{Lu}{2,3}$|^\p{Lu}{2}-\p{Lu}{2}$/u.test(w)) return w
      return cap(w)
    })
    .join(' ')
}
