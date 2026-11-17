import type { Personnel } from '@/types/database'
import { isValidTcNo } from './status'

/** Belgeden okunabilen kimlik bilgileri (personel kartındaki alanlarla aynı adlar) */
export type IdInfo = Partial<
  Pick<Personnel, 'tc_no' | 'birth_date' | 'birth_place' | 'gender' | 'blood_type' | 'license_class' | 'military_status' | 'iban'>
>

export const ID_FIELD_LABELS: Record<keyof IdInfo, string> = {
  tc_no: 'T.C. Kimlik No',
  birth_date: 'Doğum Tarihi',
  birth_place: 'Doğum Yeri',
  gender: 'Cinsiyet',
  blood_type: 'Kan Grubu',
  license_class: 'Ehliyet Sınıfı',
  military_status: 'Askerlik Durumu',
  iban: 'IBAN',
}

const pad = (n: number) => String(n).padStart(2, '0')
const DATE_RE = /(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/
const LICENSE_CLASSES = ['B', 'A2', 'A', 'B1', 'BE', 'C', 'D']

function toIso(m: RegExpMatchArray | null): string | undefined {
  if (!m) return undefined
  const d = +m[1], mo = +m[2], y = +m[3]
  const thisYear = new Date().getFullYear()
  return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1940 && y <= thisYear - 14 ? `${y}-${pad(mo)}-${pad(d)}` : undefined
}

/** "KADIKÖY-ISTANBUL" / "Kartal" → "Kadıköy-İstanbul" / "Kartal" */
function placeName(s: string): string | undefined {
  const clean = s.replace(/[^\p{L}\s/-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < 3 || clean.length > 40) return undefined
  return clean
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase('tr-TR'))
}

/**
 * Kimlik kartı, ehliyet, nüfus kayıt örneği, askerlik ve banka belgelerinin metninden kişinin kimlik bilgileri
 * (kullanıcı isteği, 2026-11-17: "kimlik kısımlarını da otomatik girsin bilgileri"). Saf fonksiyon — test edilebilir.
 * `docType` belgenin türüdür: ehliyet sınıfı yalnız ehliyetten, askerlik durumu yalnız askerlik belgesinden, IBAN
 * yalnız banka belgesinden alınır (başka belgelerdeki işyeri/şirket numaraları karışmasın diye).
 */
export function parseIdInfo(text: string, docType?: string | null): IdInfo {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const low = lines.map((l) => l.toLocaleLowerCase('tr-TR'))
  const out: IdInfo = {}

  // T.C. kimlik no: algoritması tutan 11 haneli sayı
  for (const m of text.matchAll(/(?<!\d)([1-9](?:\s?\d){10})(?!\d)/g)) {
    const v = m[1].replace(/\s/g, '')
    if (isValidTcNo(v)) {
      out.tc_no = v
      break
    }
  }

  lines.forEach((line, i) => {
    const l = low[i]
    const next = lines[i + 1] ?? ''
    // Ehliyet 3. alanı: "3. 24.02.1992 Kartal" (doğum tarihi + doğum yeri)
    const lic3 = line.match(/^3\s*[.)]\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(.*)$/)
    if (lic3) {
      out.birth_date ??= toIso(lic3[1].match(DATE_RE))
      if (lic3[2]) out.birth_place ??= placeName(lic3[2])
      return
    }
    if (/doğum tarihi|dogum tarihi|date of birth|doğum yeri ve tarihi/.test(l)) {
      out.birth_date ??= toIso(line.match(DATE_RE)) ?? toIso(next.match(DATE_RE))
    }
    if (/doğum yeri|dogum yeri|place of birth/.test(l)) {
      const after = line.replace(/.*?(doğum yeri|dogum yeri|place of birth)[^:]*[:/]?/i, '').replace(DATE_RE, '')
      out.birth_place ??= placeName(after) ?? (!/[:]/.test(next) ? placeName(next.replace(DATE_RE, '')) : undefined)
    }
    if (/cinsiyet|gender|\bsex\b/.test(l)) {
      const v = `${l.replace(/.*?(cinsiyeti?|gender|sex)/, '')} ${low[i + 1] ?? ''}`
      if (/\b(kadın|kadin|k\s*\/\s*f|female)\b/.test(v)) out.gender ??= 'Kadın'
      else if (/\b(erkek|e\s*\/\s*m|male)\b/.test(v)) out.gender ??= 'Erkek'
    }
    const blood = line.match(/\b(AB|A|B|0|O)\s*Rh\s*([+-]|pozitif|negatif)/i)
    if (blood) {
      const g = blood[1].toUpperCase() === 'O' ? '0' : blood[1].toUpperCase()
      out.blood_type ??= `${g} Rh${/^[+p]/i.test(blood[2]) ? '+' : '-'}`
    }
    // Ehliyet 9. alanı: sınıflar ("9. B B1D1 FM") — personel kartında tek sınıf seçilir, en yaygın olan önce
    if (docType === 'ehliyet') {
      const cls = line.match(/^9\s*[.)]\s*(.+)$/)
      if (cls) {
        const tokens = cls[1].toUpperCase().split(/[\s,;/]+/)
        out.license_class ??= LICENSE_CLASSES.find((c) => tokens.includes(c))
      }
    }
  })

  if (docType === 'askerlik') {
    const t = low.join(' ')
    if (/terhis|yapmıştır|tamamlam/.test(t)) out.military_status = 'Yapıldı'
    else if (/muaf/.test(t)) out.military_status = 'Muaf'
    else if (/tecil/.test(t)) out.military_status = 'Tecilli'
  }
  if (docType === 'banka') {
    const m = text.replace(/\s/g, '').toUpperCase().match(/TR\d{24}/)
    if (m) out.iban = m[0]
  }
  return out
}

/** Kişinin kartında boş olan alanlar için belgeden okunan değerler (dolu alanlar korunur) */
export function missingIdFields(person: Personnel, info: IdInfo): IdInfo {
  const out: IdInfo = {}
  for (const [k, v] of Object.entries(info) as [keyof IdInfo, string | undefined][]) {
    if (v && !person[k]) out[k] = v
  }
  return out
}

/** "T.C. Kimlik No, Doğum Tarihi" — bildirimde gösterilir */
export const idFieldList = (info: IdInfo) => (Object.keys(info) as (keyof IdInfo)[]).map((k) => ID_FIELD_LABELS[k]).join(', ')
