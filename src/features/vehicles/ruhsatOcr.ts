import { createWorker, type Worker } from 'tesseract.js'

import { CAR_MODELS } from '@/lib/carModels'
import { trFold } from '@/lib/detectProvince'
import type { RegistrationFields } from './registration'

/**
 * Ruhsat fotoğrafını BİLGİSAYARIN KENDİSİNDE okur — hiçbir yapay zekâ servisine
 * (Gemini vb.) gönderilmez (kullanıcı isteği, 2026-10-21: "gemini kullanmasın,
 * otomatik tanısın bilgileri eklesin"). Tesseract (Türkçe) ile yazı tanınır,
 * ardından Türk Araç Tescil Belgesi'nin kod/etiket düzenine göre alanlar
 * çıkarılır: (A) plaka, (B) ilk tescil, (I) tescil tarihi, (D.1) marka,
 * (D.3) ticari adı, (E) şase, (P.5) motor no, (C.1.x) sahip, (Y.1) kimlik/vergi
 * no, (J) sınıf, (D.5) cins, (R) renk, (P.1-3) motor/yakıt, (S.1) koltuk,
 * (Z.1) kullanım amacı, belge seri no, muayene. Bulunamayan alan boş kalır;
 * kullanıcı kontrol edip düzeltir. İlk kullanımda Türkçe dil verisi indirilir
 * (birkaç MB), sonra önbellekten kullanılır.
 */

let workerPromise: Promise<Worker> | null = null
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('tur').catch((err) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/** Okunaklılık için: gri ton, en az 2000 px genişlik, kontrast artırma. */
async function preprocess(dataUrl: string): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.max(1, Math.min(3, 2000 / img.naturalWidth))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  // gri ton + kontrast (ortalamadan uzaklaştır)
  let sum = 0
  for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
  const mean = sum / (px.length / 4)
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    const v = Math.max(0, Math.min(255, (g - mean) * 1.6 + 128))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}
/** Satırdaki, aralarında büyük boşluk olmayan kelime grubu — ruhsattaki bir "hücre". */
interface Segment extends Box {
  text: string
  line: number
}

interface OcrPage {
  text: string
  segments: Segment[]
}

export async function recognizeRuhsat(dataUrls: string[], onProgress?: (msg: string) => void): Promise<OcrPage[]> {
  onProgress?.('Yazı tanıma hazırlanıyor…')
  const worker = await getWorker()
  const pages: OcrPage[] = []
  for (let i = 0; i < dataUrls.length; i++) {
    onProgress?.(dataUrls.length > 1 ? `${i + 1}. fotoğraf okunuyor…` : 'Ruhsat okunuyor…')
    const { data } = await worker.recognize(await preprocess(dataUrls[i]), {}, { text: true, blocks: true })
    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    const segments: Segment[] = []
    lines.forEach((line, li) => {
      const words = [...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0)
      if (words.length === 0) return
      const height = line.bbox.y1 - line.bbox.y0
      let cur: { words: typeof words } = { words: [words[0]] }
      const flush = () => {
        const ws = cur.words
        segments.push({
          text: norm(ws.map((w) => w.text).join(' ')),
          x0: Math.min(...ws.map((w) => w.bbox.x0)),
          x1: Math.max(...ws.map((w) => w.bbox.x1)),
          y0: Math.min(...ws.map((w) => w.bbox.y0)),
          y1: Math.max(...ws.map((w) => w.bbox.y1)),
          line: li,
        })
      }
      for (let k = 1; k < words.length; k++) {
        const gap = words[k].bbox.x0 - words[k - 1].bbox.x1
        if (gap > Math.max(height * 1.8, 30)) {
          flush()
          cur = { words: [words[k]] }
        } else cur.words.push(words[k])
      }
      flush()
    })
    pages.push({ text: data.text, segments })
  }
  return pages
}

// ---------------------------------------------------------------------------
// Metinden alan çıkarma
// ---------------------------------------------------------------------------

const up = (s: string) => s.toLocaleUpperCase('tr-TR')
const norm = (s: string) => up(s).replace(/[|]/g, 'I').replace(/[‘’`´]/g, "'")

/** Etiketten sonra (aynı satırda ya da sonraki 2 satırda) gelen metin. */
function after(text: string, label: RegExp, span = 120): string | null {
  const m = label.exec(text)
  if (!m) return null
  return text.slice(m.index + m[0].length, m.index + m[0].length + span)
}

function firstMatch(segment: string | null, re: RegExp): string | null {
  if (!segment) return null
  const m = re.exec(segment)
  return m ? (m[1] ?? m[0]).trim() : null
}

function toIso(d: string | null): string | undefined {
  if (!d) return undefined
  const m = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(d)
  if (!m) return undefined
  const [day, mon, yr] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (day < 1 || day > 31 || mon < 1 || mon > 12 || yr < 1950 || yr > 2100) return undefined
  return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const DATE = /(\d{1,2}[./-]\d{1,2}[./-]\d{4})/
const PLATE = /\b((?:0[1-9]|[1-7]\d|8[01])\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4})\b/
const VIN = /\b([A-HJ-NPR-Z0-9]{17})\b/
const COLORS = ['BEYAZ', 'SİYAH', 'GRİ', 'FÜME', 'GÜMÜŞ', 'GÜMÜŞ GRİ', 'KIRMIZI', 'BORDO', 'MAVİ', 'LACİVERT', 'YEŞİL', 'SARI', 'TURUNCU', 'KAHVERENGİ', 'BEJ', 'MOR', 'ŞAMPANYA', 'BRONZ', 'ALTIN']
const FUELS = ['BENZİN', 'DİZEL', 'MOTORİN', 'LPG', 'BENZİN/LPG', 'ELEKTRİK', 'HİBRİT', 'HYBRID', 'CNG']
const TYPES = ['OTOMOBİL', 'KAMYONET', 'ARAZİ TAŞITI', 'MİNİBÜS', 'PANELVAN', 'KAMYON', 'OTOBÜS', 'MOTOSİKLET', 'ÇEKİCİ', 'TRAKTÖR']
const USAGES = ['HUSUSİ', 'TİCARİ', 'RESMİ', 'KİRALIK']

function findWord(text: string, words: string[]): string | undefined {
  // Uzun kelimeler önce ("GÜMÜŞ GRİ" "GRİ"den önce)
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    if (new RegExp(`(^|[^A-ZÇĞİÖŞÜ])${w.replace('/', '\\/')}([^A-ZÇĞİÖŞÜ]|$)`).test(text)) return w
  }
  return undefined
}

/** Büyük/küçük harf ve I/İ farkını yok sayan karşılaştırma ("CLIO" = "Clio"). */
const fold = (s: string) => ` ${trFold(s).replace(/[^a-z0-9]+/g, ' ')} `

function findBrandModel(text: string): string | undefined {
  const t = fold(text)
  const brands = Object.keys(CAR_MODELS).sort((a, b) => b.length - a.length)
  for (const brand of brands) {
    if (!t.includes(fold(brand))) continue
    const models = [...CAR_MODELS[brand]].sort((a, b) => b.length - a.length)
    const model = models.find((m) => t.includes(fold(m)))
    return model ? `${brand} ${model}` : brand
  }
  return undefined
}

/** Ruhsattaki etiket kelimeleri — bunlardan oluşan metin değer sayılmaz. */
const LABEL_WORDS =
  /\([A-Z0-9](?:\.\d){0,2}\)|PLAKA|ŞASE|SASE|NO|N0|İLK|TESC[İI]L|TAR[İI]H[İI]|MARKASI|T[İI]P[İI]|T[İI]CAR[İI]|ADI|ÜNVANI|SOYADI|ADRES[İI]|MOTOR|SINIFI|ARAÇ|C[İI]NS[İI]|RENG[İI]|KOLTUK|SAYISI|K[İI]ML[İI]K|T\.?C\.?|VERG[İI]|YAKIT|S[İI]L[İI]ND[İI]R|HACM[İI]|GÜCÜ|KULLANIM|AMACI|BELGE|SER[İI]|MUAYENE|GEÇERL[İI]L[İI]K|MODEL|YILI|[/|:.\-—]/g

function isLabelText(v: string): boolean {
  const residual = v.replace(LABEL_WORDS, '').replace(/\s+/g, '')
  // tek haneli değerler ("5" koltuk) etiket sayılmasın: kalıntı yoksa ya da metin etiket kelimesi içeriyorsa etiket
  return residual.length === 0 || (residual.length < 2 && /[A-ZÇĞİÖŞÜ]{3,}/.test(v))
}

/** Etiketin bulunduğu hücre → aynı hücrede etiketten sonrası ya da hemen altındaki (x'i örtüşen) hücre. */
function valueFor(segments: Segment[], label: RegExp, accept: (v: string) => boolean): string | null {
  for (const seg of segments) {
    const m = label.exec(seg.text)
    if (!m) continue
    // 1) aynı hücrede etiketten sonra
    const rest = seg.text.slice(m.index + m[0].length).replace(/^[\s:.\-—]+/, '').trim()
    if (rest && !isLabelText(rest) && accept(rest)) return rest
    // 2) altındaki hücreler (yakın satırlar), en çok yatay örtüşen
    const h = seg.y1 - seg.y0
    const below = segments
      // Eğik fotoğraflarda değer satırı etiketle dikeyde çakışabiliyor — üst kenar yerine orta noktalar karşılaştırılır
      .filter((o) => o !== seg && (o.y0 + o.y1) / 2 > (seg.y0 + seg.y1) / 2 + h * 0.35 && o.y0 - seg.y1 < h * 3)
      .map((o) => ({ o, overlap: Math.min(o.x1, Math.max(seg.x1, seg.x0 + 400)) - Math.max(o.x0, seg.x0) }))
      .filter((c) => c.overlap > 0)
      .sort((a, b) => a.o.y0 - b.o.y0 || b.overlap - a.overlap)
    for (const { o } of below) {
      if (/^\(?[A-Z](\.\d)*\)/.test(o.text)) break // bir sonraki etiket — değer yok
      if (isLabelText(o.text)) continue
      if (accept(o.text)) return o.text
    }
  }
  return null
}

const isDate = (v: string) => DATE.test(v)
const isText = (v: string) => /[A-ZÇĞİÖŞÜ]{2,}/.test(v) && !/^\(?[A-Z](\.\d)*\)/.test(v)
const hasDigits = (v: string) => /\d/.test(v)

/** VIN'de I, O, Q harfi olmaz — OCR karışıklıklarını düzelt. */
function fixVin(v: string): string {
  return v.replace(/\s+/g, '').replace(/[İIL]/g, '1').replace(/[OQ]/g, '0')
}

export function parseRuhsatLayout(segments: Segment[], fullText: string): RegistrationFields {
  const f: RegistrationFields = {}
  const get = (label: RegExp, accept: (v: string) => boolean) => valueFor(segments, label, accept)

  const plate = get(/\(A\)\s*PLAKA|\(A\)|PLAKA/, (v) => PLATE.test(v.replace(/\s+/g, ' ')) || /^\d{2}[A-ZÇĞİÖŞÜ]{1,3}\d{2,4}/.test(v.replace(/\s+/g, '')))
  if (plate) {
    const p = plate.replace(/\s+/g, '').match(/(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})/)
    if (p) f.plate_number = `${p[1]} ${p[2]} ${p[3]}`
  }
  f.first_registration_date = toIso(get(/\(B\)|İLK\s*TESC[İI]L/, isDate))
  f.registration_date = toIso(get(/\((?:I|1|İ|L)\)\s*TESC[İI]L|^TESC[İI]L\s*TAR/, isDate))
  f.inspection_valid_until = toIso(get(/MUAYENE/, isDate))

  const brand = get(/\(D\.1\)|MARKASI/, isText)
  const commercial = get(/\(D\.3\)|T[İI]CAR[İI]\s*ADI/, isText) ?? get(/\(D\.2\)|T[İI]P[İI]/, isText)
  const known = findBrandModel(`${brand ?? ''} ${commercial ?? ''}`) ?? findBrandModel(fullText)
  f.brand_model = known ?? ([brand, commercial].filter(Boolean).join(' ') || undefined)
  if (known && commercial && !fold(known).includes(fold(commercial.split(' ')[0]))) {
    // listede olmayan alt model (ör. "CLIO 1.0 TCE") — marka + ticari ad
    f.brand_model = `${known.split(' ')[0]} ${commercial}`.replace(/\s+/g, ' ')
  }

  const year = get(/MODEL\s*YILI|\(D\.4\)/, (v) => /\b(19|20)\d{2}\b/.test(v))
  if (year) f.year = Number(year.match(/\b((?:19|20)\d{2})\b/)![1])

  const vin = get(/\(E\)|ŞASE|SASE/, (v) => fixVin(v).match(/[A-HJ-NPR-Z0-9]{17}/) != null)
  if (vin) f.chassis_number = fixVin(vin).match(/[A-HJ-NPR-Z0-9]{17}/)![0]

  const engine = get(/\(P\.5\)|MOTOR\s*NO/, (v) => /^[A-Z0-9]{6,20}$/.test(v.replace(/\s+/g, '')))
  if (engine) f.engine_number = engine.replace(/\s+/g, '')

  const tax = get(/\(Y\.1\)|K[İI]ML[İI]K|VERG[İI]/, (v) => /\d{10,11}/.test(v.replace(/\s+/g, '')))
  if (tax) f.owner_tax_id = tax.replace(/\s+/g, '').match(/\d{10,11}/)![0]

  const surname = get(/\(C\.[1A]\.[1A]\)|SOYADI|ÜNVANI/, isText)
  const name = get(/\(C\.1\.2\)/, isText)
  const owner = [name, surname].filter(Boolean).join(' ').trim()
  if (owner) f.owner_name = owner
  const address = get(/\(C\.1\.3\)|ADRES[İI]?/, (v) => v.length >= 4 && !/^\(?[A-Z](\.\d)*\)/.test(v))
  // "ÇANKAYA / ANKARA" → OCR çoğu zaman "/" yerine "I" okur
  if (address) f.owner_address = address.replace(/\s[I|l1]\s/g, ' / ')

  const cls = get(/\(J\)|SINIFI/, (v) => /^[MNLO][1-3İIL]?G?\b/.test(v))
  if (cls) f.vehicle_class = cls.match(/^[MNLO][1-3İIL]?G?/)![0].replace(/[İIL]/, '1')
  f.vehicle_type = findWord(get(/\(D\.5\)|C[İI]NS[İI]/, isText) ?? '', TYPES) ?? findWord(fullText, TYPES)
  f.color = findWord(get(/\(R\)|RENG[İI]/, isText) ?? '', COLORS) ?? findWord(fullText, COLORS)
  f.fuel_type = findWord(get(/\(P\.3\)|YAKIT/, isText) ?? '', FUELS) ?? findWord(fullText, FUELS)
  f.usage_purpose = findWord(get(/\(Z\.1\)|KULLANIM/, isText) ?? '', USAGES) ?? findWord(fullText, USAGES)

  const cc = get(/\(P\.1\)|S[İI]L[İI]ND[İI]R/, hasDigits)
  if (cc) f.engine_capacity = cc.match(/\d{3,4}/)?.[0]
  const kw = get(/\(P\.2\)|MOTOR\s*GÜCÜ/, hasDigits)
  if (kw) f.engine_power = kw.replace(/[^\d.,]/g, '') || undefined
  const seats = get(/\(S\.1\)|KOLTUK/, (v) => /\b\d{1,2}\b/.test(v))
  if (seats) {
    const n = Number(seats.match(/\b(\d{1,2})\b/)![1])
    if (n > 0 && n < 60) f.seat_count = n
  }
  const serial = get(/BELGE\s*SER[İI]|SER[İI]\s*NO/, (v) => /[A-ZÇĞİÖŞÜ]{1,3}\s?\d{5,8}/.test(v))
  if (serial) f.document_serial = serial.match(/[A-ZÇĞİÖŞÜ]{1,3}\s?\d{5,8}/)![0]

  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null)) as RegistrationFields
}

export function parseRuhsatText(raw: string): RegistrationFields {
  const text = norm(raw)
  const f: RegistrationFields = {}

  const plate = firstMatch(after(text, /\(A\)|PLAKA/) ?? text, PLATE)
  if (plate) {
    const p = plate.replace(/\s+/g, '')
    const m = /^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})$/.exec(p)
    f.plate_number = m ? `${m[1]} ${m[2]} ${m[3]}` : plate
  }

  f.first_registration_date = toIso(firstMatch(after(text, /\(B\)|İLK\s*TESC[İI]L/), DATE))
  f.registration_date = toIso(firstMatch(after(text, /\(I\)\s*TESC[İI]L|(?<!İLK\s)TESC[İI]L\s*TAR[İI]H[İI]/), DATE))
  f.inspection_valid_until = toIso(firstMatch(after(text, /MUAYENE[^\n]{0,30}/, 160), DATE))

  const brandSeg = [firstMatch(after(text, /\(D\.1\)|MARKASI/, 60), /([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\- ]{1,25})/), firstMatch(after(text, /\(D\.3\)|T[İI]CAR[İI]\s*ADI/, 60), /([A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9.\- ]{1,30})/)]
  f.brand_model = findBrandModel(text) ?? (brandSeg.filter(Boolean).join(' ') || undefined)

  const yearSeg = firstMatch(after(text, /MODEL\s*YILI/, 40), /\b((?:19|20)\d{2})\b/)
  if (yearSeg) f.year = Number(yearSeg)

  const vinSeg = after(text, /\(E\)|ŞASE|SASE|ŞAS[İI]/, 80)
  const vin = (vinSeg ? fixVin(vinSeg).match(/[A-HJ-NPR-Z0-9]{17}/)?.[0] : null) ?? firstMatch(text, VIN)
  if (vin) f.chassis_number = vin

  const engine = firstMatch(after(text, /\(P\.5\)|MOTOR\s*NO/, 60), /\b([A-Z0-9]{6,20})\b/)
  if (engine && engine !== vin) f.engine_number = engine

  const tax = firstMatch(after(text, /\(Y\.1\)|K[İI]ML[İI]K|VERG[İI]\s*NO/, 60), /\b(\d{10,11})\b/)
  if (tax) f.owner_tax_id = tax

  const surname = firstMatch(after(text, /\(C\.1\.1\)|SOYADI|ÜNVANI/, 90), /([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ.&\- ]{2,70})/)
  const name = firstMatch(after(text, /\(C\.1\.2\)|(?<![A-ZÇĞİÖŞÜ])ADI(?![A-ZÇĞİÖŞÜ])/, 50), /([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ ]{1,40})/)
  const owner = [name && !/SOYADI|ADRES/.test(name) ? name : null, surname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (owner) f.owner_name = owner

  const address = firstMatch(after(text, /\(C\.1\.3\)|ADRES[İI]?/, 140), /([A-ZÇĞİÖŞÜ0-9][^\n]{4,120})/)
  if (address) f.owner_address = address

  const cls = firstMatch(after(text, /\(J\)|SINIFI/, 30), /\b([MNLO][1-3G]{0,2})\b/)
  if (cls) f.vehicle_class = cls
  f.vehicle_type = findWord(text, TYPES)
  f.color = findWord(after(text, /\(R\)|RENG[İI]/, 40) ?? '', COLORS) ?? findWord(text, COLORS)
  f.fuel_type = findWord(text, FUELS)
  f.usage_purpose = findWord(text, USAGES)

  const cc = firstMatch(after(text, /\(P\.1\)|S[İI]L[İI]ND[İI]R/, 40), /\b(\d{3,4})\s*(?:CM3|CC|CM)?\b/)
  if (cc) f.engine_capacity = cc
  const kw = firstMatch(after(text, /\(P\.2\)|MOTOR\s*GÜCÜ|GÜCÜ/, 40), /\b(\d{2,3}(?:[.,]\d+)?)\s*(?:KW|HP|BG)?\b/)
  if (kw) f.engine_power = kw
  const seats = firstMatch(after(text, /\(S\.1\)|KOLTUK/, 30), /\b(\d{1,2})\b/)
  if (seats && Number(seats) > 0 && Number(seats) < 60) f.seat_count = Number(seats)
  const serial = firstMatch(after(text, /SER[İI]\s*(?:NO)?/, 30), /\b([A-ZÇĞİÖŞÜ]{1,3}\s?\d{5,8})\b/)
  if (serial) f.document_serial = serial

  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null)) as RegistrationFields
}

export async function readRuhsatLocally(dataUrls: string[], onProgress?: (msg: string) => void): Promise<{ fields: RegistrationFields; text: string }> {
  const pages = await recognizeRuhsat(dataUrls, onProgress)
  const text = pages.map((p) => p.text).join('\n')
  // Önce konuma göre (etiketin altındaki/yanındaki hücre), bulunamayan alanlar düz metinden
  const layout: RegistrationFields = {}
  for (const p of pages) {
    const r = parseRuhsatLayout(p.segments, norm(p.text))
    for (const [k, v] of Object.entries(r)) if ((layout as Record<string, unknown>)[k] == null) (layout as Record<string, unknown>)[k] = v
  }
  const flat = parseRuhsatText(text) as Record<string, unknown>
  // Düz metin yedeği etiket yazısı döndürebiliyor ("KİMLİK NO TİCARİ ÜNVANI") — onları at
  for (const [k, v] of Object.entries(flat)) if (typeof v === 'string' && (isLabelText(v) || /K[İI]ML[İI]K|ÜNVANI|SOYADI|ADRES[İI]|T[İI]CAR[İI] ADI/.test(v))) delete flat[k]
  return { fields: { ...(flat as RegistrationFields), ...layout }, text }
}
