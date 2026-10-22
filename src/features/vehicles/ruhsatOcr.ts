import { createWorker, type Worker } from 'tesseract.js'

import { CAR_MODELS } from '@/lib/carModels'
import { DISTRICTS, trFold } from '@/lib/detectProvince'
import { turkeyProvinces } from '@/lib/turkeyProvinces'
import { cropTemplateCells, locateTemplate, type PlacedText } from './ruhsatTemplate'
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

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = src
  return img.decode().then(() => img)
}

/**
 * Fotoğrafta ruhsat kâğıdını bulur: açık renkli (beyaz / açık mavi) ve
 * kahverengi olmayan (masa) pikseller — satır/sütun yoğunluğuna göre sınır
 * kutusu. Bulamazsa tüm görsel.
 */
function findDocumentBoxes(img: HTMLImageElement): Box[] {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const scale = Math.min(1, 700 / Math.max(W, H))
  const w = Math.max(1, Math.round(W * scale))
  const h = Math.max(1, Math.round(H * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  // Kâğıt: açık ve beyaz/mavimsi (masa ahşabı sıcak tonlu: kırmızı belirgin şekilde maviden fazla)
  const paper = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      const l = 0.299 * r + 0.587 * g + 0.114 * b
      paper[y * w + x] = l > 112 && b >= r - 6 ? 1 : 0
    }
  }
  /** Eşiği aşan kesintisiz bantlar (küçük boşluklar tolere edilir). */
  const runs = (frac: (i: number) => number, len: number, threshold: number, gapRatio: number): [number, number][] => {
    const gapMax = Math.max(2, Math.round(len * gapRatio))
    const out: [number, number][] = []
    let start = -1
    let lastOn = -1
    for (let i = 0; i <= len; i++) {
      const on = i < len && frac(i) > threshold
      if (on) {
        if (start < 0) start = i
        lastOn = i
      } else if (start >= 0 && (i === len || i - lastOn > gapMax)) {
        out.push([start, lastOn])
        start = -1
      }
    }
    return out
  }
  const longestRun = (frac: (i: number) => number, len: number, threshold: number): [number, number] =>
    runs(frac, len, threshold, 0.04).reduce<[number, number]>((best, r) => (r[1] - r[0] > best[1] - best[0] ? r : best), [-1, -1])
  const rowFrac = (y: number) => {
    let n = 0
    for (let x = 0; x < w; x++) n += paper[y * w + x]
    return n / w
  }
  const [y0, y1] = longestRun(rowFrac, h, 0.3)
  const colFrac = (x: number) => {
    let n = 0
    for (let y = Math.max(0, y0); y <= y1; y++) n += paper[y * w + x]
    return n / Math.max(1, y1 - y0 + 1)
  }
  if (y0 < 0) return [{ x0: 0, y0: 0, x1: W, y1: H }]
  // Belgenin yatay sınırları: anlamlı genişlikteki tüm açık sütun bantlarını kapsa
  const colRuns = runs(colFrac, w, 0.3, 0.012).filter((r) => r[1] - r[0] >= w * 0.06)
  if (colRuns.length === 0) return [{ x0: 0, y0: 0, x1: W, y1: H }]
  const dx0 = Math.min(...colRuns.map((r) => r[0]))
  const dx1 = Math.max(...colRuns.map((r) => r[1]))
  if ((dx1 - dx0) * (y1 - y0) < w * h * 0.06) return [{ x0: 0, y0: 0, x1: W, y1: H }]
  // Yatay (açık, iki sayfalı) ruhsat → ortadaki en koyu sütundan (kat yeri) ikiye böl
  let pages: [number, number][] = [[dx0, dx1]]
  if ((dx1 - dx0) / (y1 - y0) > 1.15) {
    // Yoğunluk ~%2 genişlikte yumuşatılır: ince tablo çizgileri değil, geniş koyu kat yeri bulunur
    const span = dx1 - dx0
    const win = Math.max(2, Math.round(span * 0.02))
    let split = Math.round((dx0 + dx1) / 2)
    let minFrac = Infinity
    for (let x = Math.round(dx0 + span * 0.38); x <= dx0 + span * 0.62; x++) {
      let sum = 0
      for (let k = -win; k <= win; k++) sum += colFrac(Math.min(w - 1, Math.max(0, x + k)))
      if (sum < minFrac) {
        minFrac = sum
        split = x
      }
    }
    // Kesimde harf kaybı olmasın diye iç kenarlara biraz pay
    const margin = span * 0.025
    pages = [
      [dx0, Math.min(dx1, split + margin)],
      [Math.max(dx0, split - margin), dx1],
    ]
  }
  const padY = (y1 - y0) * 0.015
  return pages.map(([x0, x1]) => {
    const padX = (x1 - x0) * 0.015
    return {
      x0: Math.max(0, (x0 - padX) / scale),
      y0: Math.max(0, (y0 - padY) / scale),
      x1: Math.min(W, (x1 + padX) / scale),
      y1: Math.min(H, (y1 + padY) / scale),
    }
  })
}

/**
 * Okunaklılık için: belgeyi kırp, ~2400 px genişliğe getir, gri tona çevir ve
 * UYARLAMALI eşikle siyah-beyaz yap (her pikseli çevresinin ortalamasıyla
 * kıyaslar — mavi zemin, gölge ve kılıf parlaması yazıdan ayrılır).
 */
function binarize(img: HTMLImageElement, box: Box): string {
  const { x0, x1 } = box
  const cw = x1 - x0
  const ch = box.y1 - box.y0
  const scale = Math.min(3, 1800 / cw)
  const w = Math.round(cw * scale)
  const h = Math.round(ch * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, x0, box.y0, cw, ch, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const gray = new Float32Array(w * h)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
  // integral görüntü — hızlı yerel ortalama
  const integ = new Float64Array((w + 1) * (h + 1))
  for (let y = 1; y <= h; y++) {
    let rowSum = 0
    for (let x = 1; x <= w; x++) {
      rowSum += gray[(y - 1) * w + (x - 1)]
      integ[y * (w + 1) + x] = integ[(y - 1) * (w + 1) + x] + rowSum
    }
  }
  const r = Math.max(8, Math.round(w / 45))
  const bin = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r)
    const yb = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r)
      const xb = Math.min(w, x + r + 1)
      const area = (yb - ya) * (xb - xa)
      const sum = integ[yb * (w + 1) + xb] - integ[ya * (w + 1) + xb] - integ[yb * (w + 1) + xa] + integ[ya * (w + 1) + xa]
      bin[y * w + x] = gray[y * w + x] < (sum / area) * 0.76 ? 1 : 0
    }
  }
  // Güvenlik deseninin tek tük noktalarını temizle (3x3 komşulukta 2'den az siyah → beyaz)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let black = bin[y * w + x]
      if (black) {
        let n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy
            const xx = x + dx
            if ((dy || dx) && yy >= 0 && yy < h && xx >= 0 && xx < w) n += bin[yy * w + xx]
          }
        if (n < 2) black = 0
      }
      const i = (y * w + x) * 4
      px[i] = px[i + 1] = px[i + 2] = black ? 0 : 255
    }
  }
  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Fotoğraftaki her sayfa için kırpılmış + siyah-beyaz görüntü. */
export async function preprocessRuhsat(dataUrl: string): Promise<string[]> {
  const img = await loadImage(dataUrl)
  return findDocumentBoxes(img).map((box) => binarize(img, box))
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
    for (const pageImage of await preprocessRuhsat(dataUrls[i])) {
    const { data } = await worker.recognize(pageImage, {}, { text: true, blocks: true })
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
  }
  return pages
}

// ---------------------------------------------------------------------------
// Metinden alan çıkarma
// ---------------------------------------------------------------------------

const up = (s: string) => s.toLocaleUpperCase('tr-TR')
// Sistem OCR'ı soluk Latin harfleri bazen Kiril benzerleriyle döndürüyor ("ОТОМОВІL")
const CYRILLIC: Record<string, string> = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', І: 'I', Ѕ: 'S', Ј: 'J' }
const norm = (s: string) =>
  up(s)
    .replace(/[АВЕКМНОРСТУХІЅЈ]/g, (ch) => CYRILLIC[ch] ?? ch)
    .replace(/[|]/g, 'I')
    .replace(/[‘’`´]/g, "'")

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
const FUELS = ['BENZİNLİ', 'BENZİN', 'DİZEL', 'MOTORİN', 'LPG', 'BENZİN/LPG', 'ELEKTRİK', 'ELEKTRİKLİ', 'HİBRİT', 'HYBRID', 'CNG']
const TYPES = ['OTOMOBİL', 'KAMYONET', 'ARAZİ TAŞITI', 'MİNİBÜS', 'PANELVAN', 'KAMYON', 'OTOBÜS', 'MOTOSİKLET', 'ÇEKİCİ', 'TRAKTÖR']
const USAGES = ['HUSUSİ', 'TİCARİ', 'RESMİ', 'KİRALIK']

function findWord(raw: string, words: string[]): string | undefined {
  // "(Q) GÜÇ AĞIRLIK ORANI (Motosiklet)" gibi etiket açıklamaları değer sayılmasın
  const text = raw.replace(/\([^)]*\)/g, ' ')
  const sorted = [...words].sort((a, b) => b.length - a.length)
  // Uzun kelimeler önce ("GÜMÜŞ GRİ" "GRİ"den önce)
  for (const w of sorted) {
    if (new RegExp(`(^|[^A-ZÇĞİÖŞÜ])${w.replace('/', '\\/')}([^A-ZÇĞİÖŞÜ]|$)`).test(text)) return w
  }
  // Uzun kelimeler bitişik / I-İ farkıyla okunmuş olabilir ("CINOTOMOBIL")
  const folded = trFold(text)
  return sorted.find((w) => w.length >= 6 && folded.includes(trFold(w)))
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
    if (model) return `${brand} ${model}`
    // Ticari ad bozuk okunmuş olabilir ("SALPANT" → Taliant): 2 harfe kadar fark, kısa modellerde 1
    let best: { m: string; d: number } | null = null
    for (const w of t.trim().split(' ').filter((x) => x.length >= 4))
      for (const m of models) {
        const fm = fold(m).trim()
        if (fm.includes(' ') || fm.length < 4) continue
        const d = editDistance(fm, w)
        if (d <= (fm.length >= 6 ? 2 : 1) && (!best || d < best.d)) best = { m, d }
      }
    return best ? `${brand} ${best.m}` : brand
  }
  return undefined
}

/** Ruhsattaki etiket kelimeleri — bunlardan oluşan metin değer sayılmaz. */
const LABEL_WORDS =
  /\([A-Z0-9](?:\.\d){0,2}\)|PLAKA|ŞASE|SASE|NO|N0|İLK|TESC[İI]L|TAR[İI]H[İI]|MARKASI|T[İI]P[İI]|T[İI]CAR[İI]|ADI|ÜNVANI|SOYADI|ADRES[İI]|MOTOR|SINIFI|ARAÇ|C[İI]NS[İI]|RENG[İI]|KOLTUK|SAYISI|K[İI]ML[İI]K|T\.?C\.?|VERG[İI]|YAKIT|S[İI]L[İI]ND[İI]R|HACM[İI]|GÜCÜ|KULLANIM|AMACI|BELGE|SER[İI]|MUAYENE|GEÇERL[İI]L[İI]K|MODEL|YILI|[/|:.\-—]/g

/** Etiket kelimeleri — soluk kırmızı basıldığı için bozuk okunabiliyor ("SOYADH", "ADREST"); 1 harf farkı tolere edilir. */
const LABEL_VOCAB = ['PLAKA', 'ŞASE', 'TESCİL', 'TARİHİ', 'MARKASI', 'TİPİ', 'TİCARİ', 'ÜNVANI', 'SOYADI', 'ADRESİ', 'MOTOR', 'SINIFI', 'CİNSİ', 'RENGİ', 'SAYISI', 'KİMLİK', 'VERGİ', 'YAKIT', 'SİLİNDİR', 'HACMİ', 'GÜCÜ', 'KULLANIM', 'AMACI', 'BELGE', 'MODEL', 'YILI', 'AĞIRLIĞI', 'AZAMİ', 'NOTER']
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
const isLabelWord = (w: string) => w.length >= 4 && LABEL_VOCAB.some((l) => Math.abs(l.length - w.length) <= 1 && editDistance(trFold(l), trFold(w)) <= 1)
/** Değerin başındaki (bozuk okunmuş olabilen) etiket kelimelerini at: "TICARİ ÜNVANI YİĞİT" → "YİĞİT". */
function stripLabelWords(v: string): string {
  const words = v.split(/\s+/)
  while (words.length && (isLabelWord(words[0].replace(/[^A-ZÇĞİÖŞÜ]/g, '')) || /^\(?[A-Z0-9](\.\d){0,2}\)$/.test(words[0]))) words.shift()
  return words.join(' ')
}

function isLabelText(v: string): boolean {
  if (v.split(/\s+/).every((w) => isLabelWord(w.replace(/[^A-ZÇĞİÖŞÜ]/g, '')) || !/[A-ZÇĞİÖŞÜ0-9]/.test(w))) return true
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
    const rest = stripLabelWords(seg.text.slice(m.index + m[0].length).replace(/^[\s:.\-—]+/, '').trim())
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
      const v = stripLabelWords(o.text)
      if (v && accept(v)) return v
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
  // Muayene: "MUAYENE GEÇERLİLİK" ya da (Z.2) Diğer Bilgiler içinde "mua.geç.trh: 12-06-2026"
  f.inspection_valid_until = toIso(get(/MUA\.?\s*GE[ÇC]|MUAYENE/, isDate)) ?? toIso(fullText.match(/MUA\.?\s*GE[ÇC][^0-9]{0,12}(\d{1,2}[./-]\d{1,2}[./-]\d{4})/)?.[1] ?? null)

  const brand = get(/\(D\.1\)|MARKASI/, isText)
  const commercial = get(/\(D\.3\)|T[İI]CAR[İI]\s*ADI/, isText) ?? get(/\(D\.2\)|T[İI]P[İI]/, isText)
  const fromCells = findBrandModel(`${brand ?? ''} ${commercial ?? ''}`)
  // Hücrelerde model bulunamadıysa (etiket okunamadı) tüm metinde ara
  const known = fromCells?.includes(' ') ? fromCells : (findBrandModel(fullText) ?? fromCells)
  f.brand_model = known ?? ([brand, commercial].filter(Boolean).join(' ') || undefined)
  if (known && !known.includes(' ') && commercial && !fold(known).includes(fold(commercial.split(' ')[0]))) {
    // listede olmayan alt model (ör. "CLIO 1.0 TCE") — marka + ticari ad
    f.brand_model = `${known.split(' ')[0]} ${commercial}`.replace(/\s+/g, ' ')
  }

  const year = get(/MODEL\s*YILI|\(D\.4\)/, (v) => /\b(19|20)\d{2}\b/.test(v))
  if (year) f.year = Number(year.match(/\b((?:19|20)\d{2})\b/)![1])

  const vin = get(/\(E\)|ŞASE|SASE/, (v) => fixVin(v).match(/[A-HJ-NPR-Z0-9]{17}/) != null)
  if (vin) f.chassis_number = fixVin(vin).match(/[A-HJ-NPR-Z0-9]{17}/)![0]

  const engine = get(/\(P\.5\)|MOTOR\s*NO/, (v) => /^[A-Z0-9]{6,20}$/.test(v.replace(/\s+/g, '')))
  if (engine) f.engine_number = engine.replace(/\s+/g, '')

  const tax = get(/\(Y\.[14]\)|K[İI]ML[İI]K|VERG[İI]/, (v) => /\d{10,11}/.test(v.replace(/\s+/g, '')))
  if (tax) f.owner_tax_id = tax.replace(/\s+/g, '').match(/\d{10,11}/)![0]

  const surname = get(/\(C\.[1A]\.[1A]\)|SOYADI|ÜNVANI/, isText)
  const name = get(/\(C\.1\.2\)/, isText)
  const owner = [name, surname].filter(Boolean).join(' ').trim()
  if (owner) f.owner_name = owner
  let address = get(/\(C\.1\.3\)|ADRES[İI]?/, (v) => v.length >= 4 && !/^\(?[A-Z](\.\d)*\)/.test(v))
  if (address) address = withContinuation(segments, address)
  // "ÇANKAYA / ANKARA" → OCR çoğu zaman "/" yerine "I" okur
  if (address) f.owner_address = address.replace(/\s[I|l1]\s/g, ' / ')

  const cls = get(/\(J\)|SINIFI/, (v) => /^[MNLO][1-3İIL]?G?\b/.test(v))
  if (cls) f.vehicle_class = cls.match(/^[MNLO][1-3İIL]?G?/)![0].replace(/[İIL]/, '1')
  // "(Q) GÜÇ AĞIRLIK ORANI (Motosiklet)" etiketi araç cinsi sanılmasın — parantez içleri atılır
  f.vehicle_type = findWord(get(/\(D\.5\)|C[İI]NS[İI]/, isText) ?? '', TYPES) ?? findWord(fullText.replace(/\([^)]*\)/g, ' '), TYPES)
  f.color = findWord(get(/\(R\)|RENG[İI]/, isText) ?? '', COLORS) ?? findWord(fullText, COLORS)
  f.fuel_type = findWord(get(/\(P\.3\)|YAKIT/, isText) ?? '', FUELS) ?? findWord(fullText, FUELS)
  // Kullanım amacı yeni ruhsatlarda (Y.3), eski örneklerde (Z.1) — değer olduğu gibi ("YOLCU NAKLİ - HUSUSİ")
  const usage = get(/\(Y\.3\)|KULLANIM\s*AMACI/, isText)
  f.usage_purpose = usage ? usage.replace(/\s+/g, ' ').trim() : findWord(fullText, USAGES)

  const cc = get(/\(P\.1\)|S[İI]L[İI]ND[İI]R/, hasDigits)
  if (cc) f.engine_capacity = cc.match(/\d{3,4}/)?.[0]
  const kw = get(/\(P\.2\)|MOTOR\s*GÜCÜ/, hasDigits)
  if (kw) f.engine_power = kw.replace(/[^\d.,]/g, '') || undefined
  const seats = get(/\(S\.1\)|KOLTUK/, (v) => /\b\d{1,2}\b/.test(v))
  if (seats) {
    const n = Number(seats.match(/\b(\d{1,2})\b/)![1])
    if (n > 0 && n < 60) f.seat_count = n
  }
  // "BELGE SERİ: HY № 215561"
  const SERIAL = /([A-ZÇĞİÖŞÜ]{1,3})\s*(?:N[O0º°]\.?|№|NE|N)?\s*(\d{5,8})/
  const serial = get(/BELGE|SER[İI]/, (v) => SERIAL.test(v)) ?? fullText.match(new RegExp(`SER[İI][^A-Z]{0,4}${SERIAL.source}`))?.[0] ?? null
  const sm = serial?.match(SERIAL)
  if (sm) f.document_serial = `${sm[1]} ${sm[2]}`

  applyPatternFallbacks(f, segments)
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null)) as RegistrationFields
}

/** Adres birden çok satıra yayılır — altındaki, etiket olmayan satırları ekle. */
function withContinuation(segments: Segment[], value: string): string {
  const seg = segments.find((s) => s.text.endsWith(value))
  if (!seg) return value
  let cur = seg
  const parts = [value]
  for (let i = 0; i < 2; i++) {
    const h = cur.y1 - cur.y0
    const next = segments
      .filter((o) => o !== cur && o.y0 > (cur.y0 + cur.y1) / 2 && o.y0 - cur.y1 < h * 0.9 && Math.abs(o.x0 - cur.x0) < h * 3)
      .sort((a, b) => a.y0 - b.y0)[0]
    if (!next || /^\(?[A-Z](\.\d)*\)/.test(next.text) || isLabelText(next.text) || !/[A-ZÇĞİÖŞÜ]{3,}/.test(next.text)) break
    parts.push(next.text)
    cur = next
  }
  return parts.join(' ')
}

/**
 * Etiketi okunamayan (soluk kırmızı) alanlar için değerin biçiminden bul:
 * şase 17 karakter, motor no harf+rakam karışık ve şasenin hemen üstünde, plaka sayfanın üstünde.
 */
function applyPatternFallbacks(f: RegistrationFields, segments: Segment[]) {
  const compact = (t: string) => t.replace(/\s+/g, '')
  const pageH = Math.max(1, ...segments.map((s) => s.y1))
  let vinSeg: Segment | undefined
  if (!f.chassis_number) {
    vinSeg = segments.find((s) => /^[A-HJ-NPR-Z0-9]{17}$/.test(fixVin(compact(s.text))) && /[A-Z]/.test(s.text) && /\d{5}/.test(s.text))
    if (vinSeg) f.chassis_number = fixVin(compact(vinSeg.text))
  } else vinSeg = segments.find((s) => fixVin(compact(s.text)).includes(f.chassis_number!))
  if (!f.engine_number) {
    const cands = segments.filter((s) => {
      const t = compact(s.text)
      return s !== vinSeg && /^[A-Z0-9]{8,20}$/.test(t) && (t.match(/[A-Z]/g)?.length ?? 0) >= 2 && (t.match(/\d/g)?.length ?? 0) >= 4 && fixVin(t) !== f.chassis_number
    })
    const pick = vinSeg
      ? cands.filter((c) => c.y1 <= vinSeg!.y0 + 5).sort((a, b) => vinSeg!.y0 - a.y1 - (vinSeg!.y0 - b.y1))[0]
      : cands[0]
    if (pick) f.engine_number = compact(pick.text)
  }
  if (!f.plate_number) {
    const DIGIT: Record<string, string> = { S: '5', B: '8', O: '0', I: '1', İ: '1', Z: '2', G: '6', D: '0', Q: '0', L: '1', T: '7' }
    for (const s of segments.filter((x) => x.y1 < pageH * 0.3)) {
      const m = /^((?:0[1-9]|[1-7]\d|8[01]))([A-ZÇĞİÖŞÜ]{1,3})([A-Z0-9]{2,4})$/.exec(compact(s.text))
      if (!m) continue
      const tail = m[3].replace(/[A-ZİÇĞÖŞÜ]/g, (ch) => DIGIT[ch] ?? ch)
      if (/^\d{2,4}$/.test(tail)) {
        f.plate_number = `${m[1]} ${m[2]} ${tail}`
        break
      }
    }
  }
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

interface PageCrop {
  dataUrl: string
  box: Box
  scale: number
}

/**
 * Sayfaları renkli JPEG olarak kırp (işletim sistemi OCR'ı için). `blur` sayfa
 * genişliğine oranla bulanıklık — ruhsattaki nokta vuruşlu yazıcı yazısında
 * noktalar birleşince harfler çok daha doğru okunuyor.
 */
function colorCrops(img: HTMLImageElement, width: number, blur = 0): PageCrop[] {
  return findDocumentBoxes(img).map((box) => {
    const cw = box.x1 - box.x0
    const ch = box.y1 - box.y0
    const scale = Math.min(3, width / cw)
    const c = document.createElement('canvas')
    c.width = Math.round(cw * scale)
    c.height = Math.round(ch * scale)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.imageSmoothingQuality = 'high'
    if (blur > 0) ctx.filter = `blur(${(blur * c.width).toFixed(2)}px)`
    ctx.drawImage(img, box.x0, box.y0, cw, ch, 0, 0, c.width, c.height)
    return { dataUrl: c.toDataURL('image/jpeg', 0.92), box, scale }
  })
}

type NativeLine = { t: string; c?: number; x: number; y: number; w: number; h: number }

/** Sistem OCR satırları → Segment'ler (piksel, sol-üst orijin), aynı yükseklikteki kutular aynı satır numarasında. */
function linesToPage(lines: NativeLine[], W: number, H: number, dropRightEdge: boolean): OcrPage {
  const raw = lines
    // Sol sayfa kırpılırken sağ sayfanın kenarından kesik yazılar giriyor ("(C.1.1) S") — sağ kenara değenler atılır
    .filter((l) => l.t.trim() && !(dropRightEdge && l.x + l.w > 0.98))
    .map((l) => ({ text: norm(l.t.trim()), raw: l.t.trim(), x0: l.x * W, x1: (l.x + l.w) * W, y0: (1 - l.y - l.h) * H, y1: (1 - l.y) * H }))
    .sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0)
  const segments: Segment[] = []
  let line = -1
  let lineMid = -Infinity
  for (const r of raw) {
    const mid = (r.y0 + r.y1) / 2
    if (Math.abs(mid - lineMid) > (r.y1 - r.y0) * 0.5) {
      line++
      lineMid = mid
    }
    segments.push({ ...r, line })
  }
  const text = Array.from({ length: line + 1 }, (_, i) =>
    segments
      .filter((sg) => sg.line === i)
      .sort((a, b) => a.x0 - b.x0)
      .map((sg) => sg.text)
      .join('   '),
  ).join('\n')
  return { text, segments }
}

/** Markaların üretici kodu (şase no'nun ilk 3 hanesi) — tek harf yanlış okunduysa düzeltilir ("VE1" → Renault "VF1"). */
const BRAND_WMI: Record<string, string[]> = {
  Renault: ['VF1'], Dacia: ['UU1', 'VGA'], Peugeot: ['VF3', 'VR3'], Citroën: ['VF7', 'VR7'], DS: ['VR1'], Opel: ['W0L', 'W0V'], Fiat: ['ZFA', 'NM4'],
  Volkswagen: ['WVW', 'WV1', 'WV2'], Audi: ['WAU', 'WUA'], Seat: ['VSS'], Skoda: ['TMB'], Cupra: ['VSS'], BMW: ['WBA', 'WBY'], Mini: ['WMW'],
  'Mercedes-Benz': ['WDD', 'W1K', 'WDB', 'W1N', 'WDF', 'W1V'], Ford: ['WF0', 'NM0'], Toyota: ['NMT', 'JTD', 'SB1', 'VNK'], Honda: ['NLA', 'SHH', 'JHM'],
  Hyundai: ['NLH', 'KMH', 'TMA'], Kia: ['KNA', 'U5Y'], Nissan: ['SJN', 'VSK', 'JN1'], Volvo: ['YV1'], Togg: ['NLT'],
}
function fixVinPrefix(r: Record<string, unknown>) {
  const vin = r.chassis_number
  const brand = typeof r.brand_model === 'string' ? Object.keys(BRAND_WMI).find((b) => (r.brand_model as string).startsWith(b)) : undefined
  if (typeof vin !== 'string' || vin.length !== 17 || !brand) return
  const wmi = vin.slice(0, 3)
  if (BRAND_WMI[brand].includes(wmi)) return
  const fix = BRAND_WMI[brand].find((w) => editDistance(w, wmi) === 1)
  if (fix) r.chassis_number = fix + vin.slice(3)
}

/** T.C. kimlik no kontrol haneleri (10. ve 11. hane) — yanlış okunan rakamı yakalar. */
function isValidTc(t: string): boolean {
  if (!/^[1-9]\d{10}$/.test(t)) return false
  const d = [...t].map(Number)
  const odd = d[0] + d[2] + d[4] + d[6] + d[8]
  const even = d[1] + d[3] + d[5] + d[7]
  return (((odd * 7 - even) % 10) + 10) % 10 === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10]
}

// ---------------------------------------------------------------------------
// Türkçe harf düzeltme — sistem OCR'ı büyük "İ"yi çoğu zaman noktasız "I" okuyor
// ("KAMIL", "HUSUSI"). Bilinen kelimeler sözlükten doğru yazımıyla değiştirilir.
// ---------------------------------------------------------------------------
const TR_WORDS = [
  'OTOMOBİL', 'KAMYONET', 'MİNİBÜS', 'PANELVAN', 'ARAZİ', 'TAŞITI', 'MOTOSİKLET', 'ÇEKİCİ', 'KAMYON', 'OTOBÜS', 'TRAKTÖR', 'SEDAN', 'HATCHBACK', 'STATION', 'WAGON', 'KAPALI', 'KASA',
  'BENZİNLİ', 'BENZİN', 'DİZEL', 'MOTORİN', 'ELEKTRİK', 'ELEKTRİKLİ', 'HİBRİT', 'YOLCU', 'NAKLİ', 'YÜK', 'HUSUSİ', 'TİCARİ', 'RESMİ', 'KİRALIK', 'ÖZEL', 'KİRA',
  'BEYAZ', 'SİYAH', 'GRİ', 'FÜME', 'GÜMÜŞ', 'KIRMIZI', 'BORDO', 'MAVİ', 'LACİVERT', 'YEŞİL', 'SARI', 'TURUNCU', 'KAHVERENGİ', 'BEJ', 'MOR', 'ŞAMPANYA', 'BRONZ', 'ALTIN', 'METALİK', 'İNCİ',
  'NOTERLİĞİ', 'NOTERİ', 'NOTER', 'EMNİYET', 'MÜDÜRLÜĞÜ', 'TESCİL', 'MAH', 'MAHALLESİ', 'SK', 'SOKAK', 'SOKAĞI', 'CAD', 'CADDESİ', 'BULVARI', 'BLV', 'APT', 'APARTMANI', 'DAİRE', 'KAT', 'SİTESİ', 'BLOK', 'KÖYÜ', 'MERKEZ',
  'BANKASI', 'FİNANS', 'LEASING', 'LTD', 'ŞTİ', 'A.Ş', 'SANAYİ', 'TİCARET', 'LİMİTED', 'ŞİRKETİ', 'ANONİM', 'İNŞAAT', 'TURİZM', 'SAĞLIK', 'İLAÇ', 'KOZMETİK', 'MEDİKAL',
  // yaygın adlar / soyadları
  'KAMİL', 'YİĞİT', 'HANDAN', 'MEHMET', 'MUSTAFA', 'AHMET', 'ALİ', 'HÜSEYİN', 'HASAN', 'İBRAHİM', 'İSMAİL', 'ÖMER', 'OSMAN', 'MURAT', 'EMİNE', 'AYŞE', 'FATMA', 'HATİCE', 'ZEYNEP', 'ELİF', 'MERVE',
  'ŞERİFE', 'SULTAN', 'ÖZGE', 'GÖKHAN', 'SİNAN', 'ERKAN', 'SERKAN', 'VOLKAN', 'İLKER', 'İLHAN', 'İSMET', 'NİHAT', 'SELİM', 'EMİR', 'EMRE', 'BÜŞRA', 'DİLEK', 'GÜLŞEN', 'NİLÜFER', 'SEVİL', 'İPEK', 'İREM',
  'YILMAZ', 'KAYA', 'DEMİR', 'ŞAHİN', 'ÇELİK', 'YILDIZ', 'YILDIRIM', 'ÖZTÜRK', 'AYDIN', 'ÖZDEMİR', 'ARSLAN', 'DOĞAN', 'KILIÇ', 'ASLAN', 'ÇETİN', 'KARA', 'KOÇ', 'KURT', 'ÖZKAN', 'ŞİMŞEK', 'POLAT',
  'ÖZCAN', 'KORKMAZ', 'ÇAKIR', 'ERDOĞAN', 'YAVUZ', 'GÜLER', 'AKTAŞ', 'ÜNAL', 'GÜNEŞ', 'TEKİN', 'BULUT', 'KESKİN', 'İPEKÇİ', 'ALTUN', 'TÜRK', 'ŞEN', 'ACAR', 'İNCE', 'GÜNDOĞDU', 'KOÇAK',
]
const TR_DICT = new Map<string, string>()
for (const w of [...TR_WORDS, ...turkeyProvinces, ...Object.values(DISTRICTS).flat()]) TR_DICT.set(trFold(w), up(w))
const TR_FOLDED = [...TR_DICT.keys()]

/** Kelime kelime: sadece harf farkı Türkçe karakterse düzelt; `fuzzy` ise (yer adları) 1-2 harf hatayı da düzelt. */
function restoreTurkish(text: string, fuzzy = false): string {
  return text.replace(/[A-Za-zÇĞİÖŞÜçğıöşüİÂÎÛâîû]+/g, (w) => {
    if (w.length < 2) return w
    const k = trFold(w)
    const exact = TR_DICT.get(k)
    if (exact) return w === up(w) ? exact : w
    if (fuzzy && w.length >= 5) {
      const max = w.length >= 7 ? 2 : 1
      let best: { f: string; d: number } | null = null
      for (const f of TR_FOLDED) {
        if (Math.abs(f.length - k.length) > max) continue
        const d = editDistance(f, k)
        if (d <= max && (!best || d < best.d)) best = { f, d }
      }
      if (best) return TR_DICT.get(best.f)!
    }
    return w
  })
}

const cleanSpaces = (s: string) => s.replace(/\s+/g, ' ').trim()

/** "NO21A/50" → "NO:21A/50"; kısaltmalardan sonra nokta ("MAH, DEVRAN SK," → "MAH. DEVRAN SK."). */
function formatAddress(v: string): string {
  return restoreTurkish(v)
    .replace(/\b[HN]O\s*[:;.,]?\s*(?=\d)/g, 'NO:')
    .replace(/\b(MAH|SK|SOK|CAD|BLV|BUL|APT|KAT|D)\s*[,.]\s*/g, '$1. ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Uzun metinlerde en çok oy alan yerine diğer okumalara en çok BENZEYEN aday (kesik "ANKARA" tam adresi yenemez). */
const MEDOID_FIELDS = new Set(['owner_address', 'issued_place', 'usage_purpose', 'other_info', 'rights_holders', 'notary_name', 'vehicle_type'])
function medoid(options: { value: string | number; score: number }[]): string | number | undefined {
  if (options.length <= 1) return options[0]?.value
  const keyOf = (v: string | number) => trFold(String(v)).replace(/[^a-z0-9]/g, '')
  let best: { value: string | number; s: number } | undefined
  for (const a of options) {
    let s = 0
    for (const b of options) {
      const ka = keyOf(a.value)
      const kb = keyOf(b.value)
      s += b.score * (1 - editDistance(ka, kb) / Math.max(1, ka.length, kb.length))
    }
    if (!best || s > best.s) best = { value: a.value, s }
  }
  return best?.value
}

/** Şablon kutusundan okunan satırları alana göre doğrula / biçimlendir. Uymuyorsa undefined. */
const MULTILINE = new Set(['vehicle_type', 'owner_address', 'rights_holders', 'notary_name', 'issued_place'])

function normalizeCell(field: string, input: NativeLine[]): { value: string; conf: number } | undefined {
  let lines = input.filter((l) => l.t.trim())
  // Kutunun kenarına giren kesik etiket parçaları düşük güvenle okunur ("HWACE") — daha güvenli satır varsa atılır
  // (kutunun üst %25'ine değen, altında başka satır olan, güveni düşük satır)
  if (lines.length > 1 && !MULTILINE.has(field)) lines = lines.filter((l) => !((l.c ?? 1) < 0.5 && l.y + l.h > 0.75 && lines.some((o) => o !== l && o.y + o.h / 2 < l.y + l.h / 2)))
  const value = normalizeCellText(field, lines)
  if (value == null) return undefined
  const conf = lines.reduce((a, l) => a + (l.c ?? 1), 0) / Math.max(1, lines.length)
  // Bilinen Türkçe kelimelerden oluşan metin daha güvenilir
  const words = String(value).match(/[A-ZÇĞİÖŞÜ]{3,}/g) ?? []
  const known = words.length ? words.filter((w) => TR_DICT.has(trFold(w))).length / words.length : 0
  return { value, conf: conf + known * 0.5 }
}

function normalizeCellText(field: string, lines: NativeLine[]): string | undefined {
  const sorted = [...lines].sort((a, b) => b.y + b.h / 2 - (a.y + a.h / 2) || a.x - b.x)
  const rawText = cleanSpaces(sorted.map((l) => l.t).join(' '))
  if (!rawText) return undefined
  const t = norm(rawText)
  const compact = t.replace(/[\s.]+/g, '')
  const num = (re: RegExp) => t.match(re)?.[1]
  const textValue = (fuzzy = false) => {
    const v = cleanSpaces(stripLabelWords(t.replace(/^[\s:;,.\-—*'"/|]+/, '')).replace(/^[\s:;,.\-—*'"/|]+|[\s:;,\-—*'"/|]+$/g, ''))
    if (!/[A-ZÇĞİÖŞÜ]{2,}/.test(v) || isLabelText(v)) return undefined
    return restoreTurkish(v, fuzzy)
  }
  switch (field) {
    case 'plate_number': {
      const m = /^((?:0[1-9]|[1-7]\d|8[01]))([A-ZÇĞİÖŞÜ]{1,3})([A-Z0-9]{2,5})$/.exec(compact.replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, ''))
      if (!m) return undefined
      const DIGIT: Record<string, string> = { S: '5', B: '8', O: '0', I: '1', İ: '1', Z: '2', G: '6', D: '0', Q: '0', L: '1', T: '7' }
      const tail = m[3].replace(/[A-ZİÇĞÖŞÜ]/g, (ch) => DIGIT[ch] ?? ch)
      // Türk plakası: 1 harf + 4-5 rakam, 2 harf + 3-4 rakam, 3 harf + 2-3 rakam
      const ok = (m[2].length === 1 && /^\d{4,5}$/.test(tail)) || (m[2].length === 2 && /^\d{3,4}$/.test(tail)) || (m[2].length === 3 && /^\d{2,3}$/.test(tail))
      return ok ? `${m[1]} ${m[2]} ${tail}` : undefined
    }
    case 'first_registration_date':
    case 'registration_date':
    case 'notary_sale_date':
      return toIso(t.match(DATE)?.[1] ?? null) ?? undefined
    case 'registration_sequence_no': {
      const d = compact.replace(/[OQ]/g, '0').replace(/[Iİl|]/g, '1')
      return /^\d{10,22}$/.test(d) ? d : undefined
    }
    case 'year':
      return num(/\b((?:19|20)\d{2})\b/)
    case 'model_type':
      return /^[A-Z0-9][A-Z0-9\-/]{1,15}$/.test(compact) && !isLabelText(t) ? compact : undefined
    case 'vehicle_class': {
      const m = /^([MNLO])([1-7İIL])?(G)?$/.exec(compact)
      return m ? `${m[1]}${(m[2] ?? '').replace(/[İIL]/, '1')}${m[3] ?? ''}` : undefined
    }
    case 'vehicle_type': {
      // "(D.5) CİNSİ OTOMOBİL (AA SEDAN)" — etiketi at, değeri olduğu gibi al
      const v = cleanSpaces(t.replace(/^.*?C[İIE]N[S5][İI1]?\s*/, '').replace(/^\([^)]{1,6}\)\s*/, ''))
      if (!/[A-ZÇĞİÖŞÜ]{3,}/.test(v)) return undefined
      let out = v.replace(/\(\s*/g, '(').replace(/\s*\)/g, ')')
      // kapanış parantezi "I" / "1" / "]" okunabiliyor: "(AA SEDANI" → "(AA SEDAN)"
      if ((out.match(/\(/g)?.length ?? 0) > (out.match(/\)/g)?.length ?? 0)) out = out.replace(/[I1l\]|]?$/, ')')
      return restoreTurkish(out)
    }
    case 'engine_number': {
      const v = compact.replace(/[^A-Z0-9]/g, '')
      return /^[A-Z0-9]{5,20}$/.test(v) && /\d/.test(v) && !isLabelText(t) ? v : undefined
    }
    case 'chassis_number': {
      const v = fixVin(compact.replace(/[^A-Z0-9İ]/g, ''))
      return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : undefined
    }
    case 'net_weight':
    case 'max_laden_weight':
    case 'train_weight':
    case 'trailer_max_weight':
    case 'engine_capacity':
      return num(/\b(\d{2,5})\b/)
    case 'seat_count':
    case 'standing_capacity':
      return num(/\b(\d{1,3})\b/)
    case 'power_weight_ratio':
      // otomobillerde "---"; motosiklette ondalıklı oran (0.08)
      return num(/\b(\d[.,]\d{1,3})\b/)?.replace(',', '.')
    case 'engine_power': {
      const v = num(/\b(\d{1,4}(?:[.,]\d{1,3})?)\b/)?.replace(',', '.')
      return v && !/^[0.]+$/.test(v) ? v : undefined
    }
    case 'fuel_type': {
      const v = textValue()
      if (!v) return undefined
      const k = trFold(v).replace(/[^a-z/]/g, '')
      const hit = FUELS.map((f) => ({ f, d: editDistance(trFold(f), k) })).sort((a, b) => a.d - b.d)[0]
      return hit && hit.d <= 2 ? hit.f : undefined
    }
    case 'type_approval_no': {
      const v = rawText.replace(/\s+/g, '')
      if (!/[*/]/.test(v) || !/\d{3,}/.test(v)) return undefined
      // "e19*2018/858*00001*00" — baştaki "e" küçük yazılır
      return v.replace(/^[Ee€é#]/, 'e').replace(/["“”]/g, '*')
    }
    case 'owner_tax_id': {
      const d = compact.replace(/[OQ]/g, '0').replace(/[Iİl|]/g, '1').replace(/\D/g, '')
      return /^\d{10,11}$/.test(d) ? d : undefined
    }
    case 'owner_surname':
    case 'owner_first_name':
    case 'brand':
    case 'commercial_name':
    case 'color':
    case 'usage_purpose':
    case 'rights_holders':
    case 'notary_name':
      return textValue()
    case 'issued_place': {
      const v = textValue(true)
      return v?.replace(/\s*\/\s*/g, ' / ').replace(/[)\]}]+$/, '')
    }
    case 'owner_address': {
      const v = textValue()
      return v ? formatAddress(v) : undefined
    }
    case 'notary_sale_no':
      return /\d/.test(t) && !isLabelText(t) ? cleanSpaces(stripLabelWords(t)) : undefined
    case 'other_info':
      // Diğer bilgiler olduğu gibi (küçük harfler korunur): "mua.geç.trh: 12-06-2026"
      return /[a-zA-Z0-9]{2,}/.test(rawText) && !isLabelText(t) ? rawText : undefined
    case 'document_serial': {
      const SERIAL = /([A-ZÇĞİÖŞÜ]{1,3})\s*(?:N[O0º°]\.?|№|NE|N)?\s*(\d{5,8})/
      const m = t.replace(/^.*SER[İI]\s*[:;]?\s*/, '').match(SERIAL)
      return m ? `${m[1]} ${m[2]}` : undefined
    }
  }
  return undefined
}

function mergeMissing(into: Record<string, unknown>, from: RegistrationFields) {
  for (const [k, v] of Object.entries(from)) if (into[k] == null || into[k] === '') into[k] = v
}

function cleanFlat(fields: RegistrationFields): RegistrationFields {
  const flat = { ...fields } as Record<string, unknown>
  // Düz metin yedeği etiket yazısı döndürebiliyor ("KİMLİK NO TİCARİ ÜNVANI") — onları at
  for (const [k, v] of Object.entries(flat)) if (typeof v === 'string' && (isLabelText(v) || /K[İI]ML[İI]K|ÜNVANI|SOYADI|ADRES[İI]|T[İI]CAR[İI] ADI/.test(v))) delete flat[k]
  return flat as RegistrationFields
}

class Votes {
  private m = new Map<string, Map<string, { value: string | number; score: number }>>()
  add(field: string, value: string | number | undefined | null, weight: number) {
    if (value == null || value === '') return
    const byVal = this.m.get(field) ?? new Map()
    const cur = byVal.get(String(value)) ?? { value, score: 0 }
    cur.score += weight
    byVal.set(String(value), cur)
    this.m.set(field, byVal)
  }
  addAll(fields: RegistrationFields, weight: number) {
    for (const [k, v] of Object.entries(fields)) this.add(k, v as string | number, weight)
  }
  options(field: string) {
    return [...(this.m.get(field)?.values() ?? [])].sort((a, b) => b.score - a.score)
  }
  best(field: string, valid?: (v: string) => boolean) {
    const opts = this.options(field)
    return (valid ? opts.find((o) => valid(String(o.value))) : undefined)?.value ?? opts[0]?.value
  }
  fields() {
    return [...this.m.keys()]
  }
}

export async function readRuhsatLocally(
  dataUrls: string[],
  onProgress?: (msg: string) => void,
): Promise<{ fields: RegistrationFields; text: string; uncertain: string[] }> {
  const result: Record<string, unknown> = {}
  const texts: string[] = []
  const uncertain = new Set<string>()
  const ocr = window.electronAPI?.nativeOcr

  // 1) İşletim sisteminin yazı tanıması (Mac: Apple Vision, Windows: Windows OCR)
  if (ocr) {
    const votes = new Votes()
    const templateVotes = new Votes()
    for (let i = 0; i < dataUrls.length; i++) {
      onProgress?.(dataUrls.length > 1 ? `${i + 1}. fotoğraf okunuyor…` : 'Ruhsat okunuyor…')
      const img = await loadImage(dataUrls[i])
      // a) Sayfaların tamamı: net + iki farklı bulanıklık
      const passes: [PageCrop[], number][] = [
        [colorCrops(img, 2000, 0), 1],
        [colorCrops(img, 2000, 0.0019), 1.2],
        [colorCrops(img, 2000, 0.003), 1.1],
      ]
      const all = passes.flatMap(([crops]) => crops)
      const lines = (await ocr(all.map((c) => c.dataUrl)).catch(() => null)) ?? []
      const placed: PlacedText[] = []
      let li = 0
      for (const [crops, weight] of passes) {
        const pages: OcrPage[] = []
        for (const [k, crop] of crops.entries()) {
          const W = Math.round((crop.box.x1 - crop.box.x0) * crop.scale)
          const H = Math.round((crop.box.y1 - crop.box.y0) * crop.scale)
          const page = linesToPage(lines[li++] ?? [], W, H, k < crops.length - 1)
          pages.push(page)
          for (const s of page.segments) placed.push({ text: s.text, x0: crop.box.x0 + s.x0 / crop.scale, y0: crop.box.y0 + s.y0 / crop.scale, x1: crop.box.x0 + s.x1 / crop.scale, y1: crop.box.y0 + s.y1 / crop.scale })
        }
        const pass: Record<string, unknown> = {}
        for (const p of pages) mergeMissing(pass, parseRuhsatLayout(p.segments, p.text))
        for (const p of pages) mergeMissing(pass, cleanFlat(parseRuhsatText(p.text)))
        votes.addAll(pass as RegistrationFields, weight)
        texts.push(...pages.map((p) => p.text))
      }

      // b) Ruhsat şablonu: etiketlerden kutuların yeri bulunur, her kutu ayrı ayrı 3 bulanıklıkta okunur
      const transforms = locateTemplate(placed)
      if (transforms.L || transforms.R) {
        onProgress?.('Ruhsat kutuları tek tek okunuyor…')
        const cells = cropTemplateCells(img, transforms, [0.75, 1.25, 1.75])
        // 3 parça halinde paralel (her biri ayrı süreç) — süre ~3'te 1'e iner
        const chunks = [0, 1, 2].map((p) => cells.slice(Math.floor((p * cells.length) / 3), Math.floor(((p + 1) * cells.length) / 3)))
        const cellLines = (await Promise.all(chunks.map((ch) => (ch.length ? ocr(ch.map((c) => c.dataUrl)).catch(() => null) : Promise.resolve([]))))).flatMap(
          (r, p) => r ?? chunks[p].map(() => []),
        )
        cells.forEach((c, k) => {
          const r = normalizeCell(c.field, cellLines[k] ?? [])
          if (r) templateVotes.add(c.field, r.value, r.conf)
        })
      }
    }

    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__ruhsatDebug = { templateVotes, votes }
    // Kutu okuması (şablon) ağırlıklı; sayfa okumasının oyları da eklenir (yarım ağırlıkla)
    const tc = (v: string) => v.length === 10 || isValidTc(v)
    const combined = new Votes()
    for (const f of new Set([...templateVotes.fields(), ...votes.fields()])) {
      for (const o of templateVotes.options(f)) combined.add(f, o.value, o.score)
      for (const o of votes.options(f)) combined.add(f, f === 'vehicle_type' ? undefined : f === 'owner_address' ? formatAddress(String(o.value)) : o.value, o.score * 0.5)
    }
    for (const f of combined.fields()) {
      if (['owner_surname', 'owner_first_name', 'brand', 'commercial_name', 'brand_model', 'owner_name'].includes(f)) continue
      const v = MEDOID_FIELDS.has(f) ? medoid(combined.options(f)) : combined.best(f, f === 'owner_tax_id' ? tc : undefined)
      if (v == null) continue
      // Okumalar tutarsızsa (zayıf ya da yakın ikinci aday) formda "kontrol edin" diye işaretlenir
      const [o1, o2] = combined.options(f)
      if (MEDOID_FIELDS.has(f)) {
        // benzerlik seçimi: seçilen metnin kendi desteği zayıfsa işaretle
        if ((combined.options(f).find((o) => String(o.value) === String(v))?.score ?? 0) < 0.6) uncertain.add(f)
      } else if (String(o1.value) !== String(v) || o1.score < 1 || (o2 && o2.score > o1.score * 0.6)) uncertain.add(f)
      result[f] = f === 'year' || f === 'seat_count' ? Number(v) : typeof v === 'string' && ['owner_address', 'usage_purpose', 'color', 'issued_place'].includes(f) ? restoreTurkish(v) : v
    }
    // Cinsi: şablon okuması tam değeri verir ("OTOMOBİL (AA SEDAN)"); yoksa sayfa okumasındaki tür
    if (result.vehicle_type == null) result.vehicle_type = votes.best('vehicle_type')
    const first = templateVotes.best('owner_first_name')
    const last = templateVotes.best('owner_surname')
    // Ad ya da soyad kutusu okunamadıysa sayfa okumasındaki tam ad (içinde okunan kısım geçiyorsa)
    // (sayfa okuması bazen sadece soyadını bulur: "YIĞIT" → ad kutusundaki "HANDAN" ile birleştirilir)
    const pageOwner = votes.best('owner_name')
    const pageWords = typeof pageOwner === 'string' ? restoreTurkish(pageOwner).split(' ').filter((w) => w && w !== first && w !== last) : []
    result.owner_name = first && last ? `${first} ${last}` : [first, ...pageWords, last].filter(Boolean).join(' ') || undefined
    if (!(first && last)) uncertain.add('owner_name')
    const brand = templateVotes.best('brand')
    const fromPages = votes.best('brand_model')
    if (brand) {
      // Ticari ad: listedeki bir modele uyan okuma tercih edilir ("YAI" yerine "TALIANT")
      const options = templateVotes.options('commercial_name').map((o) => String(o.value))
      const known = options.map((c) => findBrandModel(`${brand} ${c}`)).find((bm) => bm?.includes(' '))
      const brandName = findBrandModel(String(brand))
      result.brand_model =
        known ??
        (typeof fromPages === 'string' && fromPages.includes(' ') && brandName && fromPages.startsWith(brandName) ? fromPages : undefined) ??
        [brandName ?? brand, options[0]].filter(Boolean).join(' ')
    } else if (fromPages) result.brand_model = fromPages
    fixVinPrefix(result)
  }

  // 2) Eksik kalan temel alanlar (ya da sistem OCR'ı yoksa hepsi) Tesseract ile — bunlar her zaman "kontrol edin"
  const missing = REG_KEYS.some((k) => result[k] == null)
  if (missing) {
    const before = new Set(Object.keys(result).filter((k) => result[k] != null))
    const pages = await recognizeRuhsat(dataUrls, onProgress)
    for (const p of pages) mergeMissing(result, parseRuhsatLayout(p.segments, norm(p.text)))
    const text = pages.map((p) => p.text).join('\n')
    mergeMissing(result, cleanFlat(parseRuhsatText(text)))
    texts.push(text)
    for (const k of Object.keys(result)) if (!before.has(k) && result[k] != null) uncertain.add(k)
  }
  // Muayene tarihi ruhsatta "Diğer Bilgiler" içinde yazıyor ("mua.geç.trh: 12-06-2026")
  if (result.inspection_valid_until == null && typeof result.other_info === 'string') {
    const m = /MUA[^0-9]{0,15}(\d{1,2}[./-]\d{1,2}[./-]\d{4})/.exec(up(result.other_info))
    if (m) result.inspection_valid_until = toIso(m[1])
  }
  for (const k of Object.keys(result)) if (result[k] == null) delete result[k]
  return { fields: result as RegistrationFields, text: texts.join('\n'), uncertain: [...uncertain].filter((k) => result[k] != null) }
}

// Bunlardan biri eksikse Tesseract da çalıştırılır (sistem OCR'ı genelde hepsini bulur, Tesseract yavaş)
const REG_KEYS = ['plate_number', 'brand_model', 'year', 'chassis_number', 'engine_number', 'owner_name', 'owner_tax_id', 'owner_address', 'inspection_valid_until', 'document_serial'] as const
