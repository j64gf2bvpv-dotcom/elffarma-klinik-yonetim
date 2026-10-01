/**
 * Telefon rehberi dışa aktarımlarını (.vcf / vCard 2.1, 3.0, 4.0) okur —
 * Samsung (Kişiler > Dışa aktar) ve Apple (iCloud/Kişiler > vCard dışa aktar)
 * dosyalarında görülen farklılıkları kapsar (kullanıcı isteği, 2026-10-01):
 *  - satır katlama (CRLF + boşluk/sekme ile devam eden satırlar)
 *  - Samsung'un `ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8` ile kodladığı Türkçe
 *    isimler (=C3=BC… ve satır sonundaki "=" yumuşak kırılımları)
 *  - Apple'ın `item1.TEL;type=CELL:...` gibi gruplu alanları
 *  - kaçışlı karakterler (\, \; \n)
 *  - FN yoksa N (Soyad;Ad;İkinci Ad;Ön ek;Son ek) alanından isim üretme
 * Tek dosyada çok sayıda kişi olabilir; kütüphane eklenmeden yazıldı.
 */

export interface VCardPhone {
  value: string
  /** küçük harfli tipler: cell, mobile, work, home, voice, main, iphone, fax… */
  types: string[]
}

export interface VCardContact {
  fullName: string
  phones: VCardPhone[]
  emails: string[]
  org: string
  title: string
  note: string
  address: string
}

function unfold(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  const raw = normalized.split('\n')
  const lines: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  // Quoted-printable yumuşak kırılımları: satır "=" ile bitiyorsa bir sonraki
  // satır aynı değerin devamıdır (vCard 2.1'de katlama böyle yapılıyor).
  const joined: string[] = []
  for (const line of lines) {
    const prev = joined[joined.length - 1]
    if (prev !== undefined && /QUOTED-PRINTABLE/i.test(prev.split(':')[0] ?? '') && prev.endsWith('=')) {
      joined[joined.length - 1] = prev.slice(0, -1) + line
    } else {
      joined.push(line)
    }
  }
  return joined
}

function decodeQuotedPrintable(value: string, charset: string): string {
  const bytes: number[] = []
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      // QP içinde ASCII dışı karakter beklenmez ama gelirse UTF-8 baytlarıyla ekle
      for (const b of new TextEncoder().encode(ch)) bytes.push(b)
    }
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(bytes))
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  }
}

function unescapeValue(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

/** "N" ve "ADR" gibi ';' ile ayrılmış yapılandırılmış alanları kaçışlara dikkat ederek böler. */
function splitStructured(value: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '\\' && i + 1 < value.length) {
      current += ch + value[i + 1]
      i++
    } else if (ch === ';') {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map((p) => unescapeValue(p).trim())
}

interface ParsedLine {
  name: string
  params: Record<string, string[]>
  value: string
}

function parseLine(line: string): ParsedLine | null {
  // İlk kaçışsız ':' anahtar ile değeri ayırır (parametre değerleri tırnaklı olabilir)
  let inQuotes = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes
    if (line[i] === ':' && !inQuotes) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const key = line.slice(0, colon)
  let value = line.slice(colon + 1)
  const [rawName, ...rawParams] = key.split(';')
  const name = rawName.replace(/^[^.]+\./, '').toUpperCase() // "item1.TEL" → "TEL"
  const params: Record<string, string[]> = {}
  for (const p of rawParams) {
    const eq = p.indexOf('=')
    if (eq < 0) {
      // vCard 2.1: TEL;CELL;PREF:... — çıplak parametre = TYPE
      ;(params.TYPE ??= []).push(p.toLowerCase())
    } else {
      const k = p.slice(0, eq).toUpperCase()
      const vals = p
        .slice(eq + 1)
        .replace(/"/g, '')
        .split(',')
        .map((v) => v.trim())
      ;(params[k] ??= []).push(...(k === 'TYPE' ? vals.map((v) => v.toLowerCase()) : vals))
    }
  }
  if ((params.ENCODING ?? []).some((e) => /quoted-printable/i.test(e))) {
    value = decodeQuotedPrintable(value, params.CHARSET?.[0] ?? 'utf-8')
  }
  return { name, params, value }
}

export function parseVCards(text: string): VCardContact[] {
  const contacts: VCardContact[] = []
  let current: VCardContact | null = null
  let nameFromN = ''

  for (const line of unfold(text.replace(/^﻿/, ''))) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^BEGIN:VCARD$/i.test(trimmed)) {
      current = { fullName: '', phones: [], emails: [], org: '', title: '', note: '', address: '' }
      nameFromN = ''
      continue
    }
    if (/^END:VCARD$/i.test(trimmed)) {
      if (current) {
        if (!current.fullName) current.fullName = nameFromN
        current.fullName = current.fullName.replace(/\s+/g, ' ').trim()
        contacts.push(current)
      }
      current = null
      continue
    }
    if (!current) continue
    const parsed = parseLine(line)
    if (!parsed) continue
    const { name, params, value } = parsed

    switch (name) {
      case 'FN':
        current.fullName = unescapeValue(value).trim()
        break
      case 'N': {
        const [family = '', given = '', additional = '', prefix = '', suffix = ''] = splitStructured(value)
        nameFromN = [prefix, given, additional, family, suffix].filter(Boolean).join(' ')
        break
      }
      case 'TEL': {
        const v = unescapeValue(value).replace(/^tel:/i, '').trim()
        if (v) current.phones.push({ value: v, types: params.TYPE ?? [] })
        break
      }
      case 'EMAIL': {
        const v = unescapeValue(value).trim()
        if (v) current.emails.push(v)
        break
      }
      case 'ORG':
        current.org = splitStructured(value).filter(Boolean).join(' / ')
        break
      case 'TITLE':
        current.title = unescapeValue(value).trim()
        break
      case 'NOTE':
        current.note = unescapeValue(value).trim()
        break
      case 'ADR':
        if (!current.address) {
          // PO Box; Ek; Sokak; İlçe/Şehir; Bölge; Posta kodu; Ülke
          current.address = splitStructured(value).filter(Boolean).join(', ')
        }
        break
    }
  }
  return contacts
}

/** Cep numarasını öne alarak kişinin numaralarını sıralar (önce cell/mobile/iphone, sonra diğerleri, faks en sonda). */
export function rankPhones(phones: VCardPhone[]): VCardPhone[] {
  const score = (p: VCardPhone) =>
    p.types.some((t) => t === 'fax') ? 3 : p.types.some((t) => ['cell', 'mobile', 'iphone'].includes(t) || t.startsWith('x-mobil')) ? 0 : p.types.includes('pref') ? 1 : 2
  return [...phones].sort((a, b) => score(a) - score(b))
}
