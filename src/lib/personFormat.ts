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
