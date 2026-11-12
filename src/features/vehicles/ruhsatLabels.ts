/**
 * Ruhsatı KUTU ETİKETLERİNDEN okuma (kullanıcı isteği, 2026-11-12: "ruhsatların bilgileri
 * okunamıyor, detaylı incelesin, hepsini eklesin"). Şablon yöntemi (ruhsatTemplate.ts) ruhsat
 * fotoğrafın küçük bir köşesindeyken ya da eğikken kayıyordu. Burada sistem yazı tanımasının
 * satır kutuları kullanılır: her etiketin ("(A) PLAKA", "(D.1) MARKASI"…) yeri bulunur, her
 * değer kendi sütununda üstündeki en yakın etikete verilir. Saf fonksiyon — DOM kullanmaz.
 */

/** Sistem OCR satırı: 0-1 oranında, orijin sol-ALT (Apple Vision / Windows OCR) */
export type OcrLine = { t: string; c?: number; x: number; y: number; w: number; h: number }

type Piece = { text: string; x0: number; x1: number; top: number; bottom: number; h: number; c: number }
type Label = Piece & { field: string; right: number }

/** Türkçe büyük harfe çevirip aksanları at — uzunluk değişmez (konum hesabı için) */
function fold(s: string): string {
  const up = s.toLocaleUpperCase('tr-TR')
  const map: Record<string, string> = { Á: 'A', À: 'A', É: 'E', İ: 'I', I: 'I', Ş: 'S', Ğ: 'G', Ü: 'U', Ö: 'O', Ç: 'C', Â: 'A', Î: 'I', Û: 'U', Í: 'I', Ì: 'I', Ô: 'O', Ò: 'O', Ó: 'O', '|': 'I' }
  return [...up].map((ch) => (map[ch] ?? ch).slice(0, 1)).join('')
}

const I = '[I1L]'
/**
 * Etiketler — sıra önemli: daha uzun/özel olan önce aranır ("İLK TESCİL TARİHİ" "TESCİL
 * TARİHİ"nden, "TİP ONAY NO" "TİPİ"nden, "TİCARİ ADI" "ADI"ndan önce).
 */
const LABELS: { field: string; re: RegExp }[] = [
  { field: 'plate_number', re: /PLAKA/ },
  { field: 'issued_place', re: new RegExp(`VER${I}LD${I}[GC]${I}\\s*${I}L\\s*\\/?\\s*${I}LCE`) },
  { field: 'first_registration_date', re: new RegExp(`${I}LK\\s*TESC${I}L\\s*TAR${I}H${I}?`) },
  { field: 'registration_sequence_no', re: new RegExp(`TESC${I}L\\s*S${I}RA\\s*N[O0]`) },
  { field: 'registration_date', re: new RegExp(`TESC${I}L\\s*TAR${I}H${I}?`) },
  { field: 'type_approval_no', re: new RegExp(`T${I}P\\s*ONAY\\s*N[O0]`) },
  { field: 'brand', re: new RegExp(`MARKAS${I}`) },
  { field: 'commercial_name', re: new RegExp(`T${I}CAR${I}\\s*AD${I}`) },
  { field: 'model_type', re: new RegExp(`\\bT${I}P${I}\\b`) },
  { field: 'year', re: new RegExp(`MODEL\\s*Y${I}L${I}`) },
  { field: 'vehicle_class', re: new RegExp(`ARA[CG]\\s*S${I}N${I}F${I}`) },
  { field: 'vehicle_type', re: new RegExp(`C[EI1L]NS${I}?`) },
  { field: 'color', re: new RegExp(`RENG${I}`) },
  { field: 'engine_number', re: /MOTOR\s*N[O0]/ },
  { field: 'chassis_number', re: /SASE\s*N[O0]/ },
  { field: 'net_weight', re: /NET\s*AG\w*/ },
  { field: 'trailer_max_weight', re: new RegExp(`ROMORK(?:\\s*AZAM${I})?(?:\\s*YUKLU)?`) },
  { field: 'max_laden_weight', re: new RegExp(`AZAM${I}\\s*YUKLU\\s*AG\\w*`) },
  { field: 'train_weight', re: /KATAR\s*AG\w*/ },
  { field: 'seat_count', re: new RegExp(`KOLTUK\\s*SAY${I}S${I}(?:\\s*\\(?\\s*SUR\\.?\\s*DAH${I}L\\s*\\)?)?`) },
  { field: 'standing_capacity', re: new RegExp(`AYAKTA\\s*YOLCU(?:\\s*SAY${I}S${I})?`) },
  { field: 'engine_capacity', re: new RegExp(`S${I}L${I}ND${I}R\\s*HACM${I}`) },
  { field: 'engine_power', re: /MOTOR\s*GUCU/ },
  { field: 'fuel_type', re: new RegExp(`YAK${I}T\\s*C${I}N\\w*`) },
  { field: 'power_weight_ratio', re: new RegExp(`GUC\\s*AG${I}RL${I}K\\s*ORAN${I}(?:\\s*\\(?\\s*MOTOS${I}KLET\\s*\\)?)?`) },
  { field: 'usage_purpose', re: new RegExp(`KULLAN${I}M\\s*AMAC${I}`) },
  { field: 'owner_tax_id', re: new RegExp(`K${I}ML${I}K\\s*N[O0]\\s*\\/?`) },
  { field: 'owner_surname', re: new RegExp(`SOYAD${I}\\s*\\/?`) },
  // Etiketin ikinci satırı da kendi kutusunun etiketi sayılır — değer çoğu zaman bu yazıyla aynı
  // satırda başlar ("TİCARİ ÜNVANI ZEPLİN TURİZM…", "VERGİ NO 9970221779")
  { field: 'owner_surname', re: new RegExp(`T${I}CAR${I}\\s*UNVAN${I}?`) },
  { field: 'owner_tax_id', re: new RegExp(`VERG${I}\\s*N[O0]`) },
  { field: 'rights_holders', re: new RegExp(`(?:VE\\s*)?MENFAAT${I}?\\s*BULUNANLAR`) },
  { field: 'owner_address', re: new RegExp(`ADRES${I}?`) },
  { field: 'rights_holders', re: /ARA[CG]\s*UZER\w*\s*HAK/ },
  { field: 'notary_sale_date', re: new RegExp(`NOTER\\s*SAT${I}S\\s*TAR${I}H${I}?`) },
  { field: 'notary_sale_no', re: new RegExp(`NOTER\\s*SAT${I}S\\s*N[O0]`) },
  { field: 'notary_name', re: new RegExp(`NOTER${I}N\\s*AD${I}`) },
  { field: 'other_info', re: new RegExp(`D${I}GER\\s*B${I}LG${I}LER`) },
  // Yarım okunan etiketler (kılıf parlaması, kesik baskı): "OLCU SAYISI", "KOLTUK", "IK ORANI"…
  { field: 'standing_capacity', re: new RegExp(`YOLCU\\s*SAY\\w*`) },
  { field: 'seat_count', re: /[KS]OLT\w*/ },
  { field: 'engine_capacity', re: new RegExp(`S${I}L${I}ND${I}R(?:\\s*H\\w*)?`) },
  { field: 'engine_power', re: /MOTOR\s*G\w*|\bG[UO]C[UE]\b/ },
  { field: 'power_weight_ratio', re: new RegExp(`(?:AG${I}RL${I}K\\s*)?OR\\s*AN${I}\\b`) },
  { field: 'max_laden_weight', re: new RegExp(`AZAM${I}\\s*YUKL\\w*`) },
  { field: 'fuel_type', re: new RegExp(`YAK${I}T`) },
  { field: 'usage_purpose', re: new RegExp(`KULLAN${I}M`) },
  { field: 'notary_sale_date', re: new RegExp(`NOTER\\s*SAT\\w*\\s*TAR\\w*`) },
  { field: 'rights_holders', re: /ARA[CG]\s*UZER\w*/ },
  { field: 'vehicle_class', re: new RegExp(`ARA[CG]\\s*S${I}N\\w*`) },
  // Değeri olmayan kutular — altındaki yazılar başka kutuya kaymasın diye sınır görevi görür
  { field: '_stamp', re: /NOTER\s*MUHUR|MUHUR|\bIMZA\b/ },
  { field: '_approver', re: /ONAYLAYAN/ },
  { field: '_document', re: /\bBELGE\b/ },
  { field: 'owner_first_name', re: new RegExp(`(?<![A-Z])AD${I}\\b`) },
]

/** Etiketin alt satırına taşan devamı ve birimler — değerden atılır */
const CONTINUATION = [
  /\bT\s*\.?\s*C\s*\.?(?=\s*K)/,
  new RegExp(`VERG${I}\\s*N[O0]`),
  new RegExp(`T${I}CAR${I}\\s*UNVAN${I}?`),
  new RegExp(`VE\\s*MENFAAT${I}?\\s*BULUNANLAR`),
  new RegExp(`MENFAAT${I}?\\s*BULUNANLAR`),
  /\bAG[I1L]RL[I1L][GC][I1L]\b/,
  new RegExp(`\\(?\\s*SUR\\.?\\s*DAH${I}L\\s*\\)?`),
  new RegExp(`\\(?\\s*MOTOS${I}KLET\\s*\\)?`),
  /\bKG\.?(?=\s|$)/,
  /\bCM['3³]?(?=\s|$)/,
  /\bKW(?:\s*\/\s*KG)?(?=\s|$)/,
  new RegExp(`\\bS${I}C${I}L\\s*-?\\s*${I}MZA`),
]

/** "(A)", "(D.4)", "(C.1.2)", "(V.1)", ".3)" gibi kutu kodları */
const CODE = /(?<![A-Z0-9])\(?\s*[A-Z]?\s*(?:[.,]\s*[0-9IL]){0,3}\s*\)(?=\s|[A-Z]|$)|^\(\s*[A-Z](?:\s*[.,]\s*[0-9IL]){0,3}\s*\)?/g

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/** Bir OCR satırını etiket/değer parçalarına böl; x konumu karakter sırasıyla orantılı */
function splitLine(line: OcrLine): { labels: Label[]; values: Piece[] } {
  const raw = line.t
  const f = fold(raw)
  const top = 1 - (line.y + line.h)
  const bottom = 1 - line.y
  const at = (i: number) => line.x + (line.w * i) / Math.max(1, raw.length)
  // Etiket aralıkları
  const spans: { s: number; e: number; field?: string }[] = []
  const taken = (s: number, e: number) => spans.some((p) => s < p.e && e > p.s)
  for (const { field, re } of LABELS) {
    const g = new RegExp(re.source, 'g')
    for (const m of f.matchAll(g)) {
      const s = m.index ?? 0
      const e = s + m[0].length
      if (!taken(s, e)) spans.push({ s, e, field })
    }
  }
  for (const re of CONTINUATION) {
    for (const m of f.matchAll(new RegExp(re.source, 'g'))) {
      const s = m.index ?? 0
      const e = s + m[0].length
      if (!taken(s, e)) spans.push({ s, e })
    }
  }
  for (const m of f.matchAll(CODE)) {
    const s = m.index ?? 0
    const e = s + m[0].length
    if (m[0].replace(/[\s()]/g, '').length && !taken(s, e)) spans.push({ s, e })
  }
  spans.sort((a, b) => a.s - b.s)
  // Etiketin başı kodun başıdır: "(D.1) MARKASI" — değerler kodun hizasından başlar
  for (let k = 1; k < spans.length; k++) {
    const prev = spans[k - 1]
    const cur = spans[k]
    if (cur.field && !prev.field && /^\s{0,2}$/.test(raw.slice(prev.e, cur.s)) && /\(|\)/.test(raw.slice(prev.s, prev.e))) {
      cur.s = prev.s
      spans.splice(k - 1, 1)
      k--
    }
  }
  // Satırın başındaki kısa, boşluksuz parça bozuk okunmuş koddur ("IDUSYCENSİ" = "(D.5) CİNSİ")
  const firstLabel = spans.find((sp) => sp.field)
  if (firstLabel && firstLabel === spans[0] && firstLabel.s > 0 && firstLabel.s <= 6 && !/\s/.test(raw.slice(0, firstLabel.s).trim())) firstLabel.s = 0
  const labels: Label[] = []
  const values: Piece[] = []
  let cursor = 0
  const pushValue = (s: number, e: number) => {
    const text = raw.slice(s, e).replace(/^[\s:;,.\-—*'"/|]+|[\s:;,\-—*'"/|]+$/g, '').trim()
    if (text) values.push({ text, x0: at(s), x1: at(e), top, bottom, h: line.h, c: line.c ?? 1 })
  }
  for (const sp of spans) {
    if (sp.s > cursor) pushValue(cursor, sp.s)
    if (sp.field) labels.push({ text: raw.slice(sp.s, sp.e), field: sp.field, x0: at(sp.s), x1: at(sp.e), top, bottom, h: line.h, c: line.c ?? 1, right: 1 })
    cursor = Math.max(cursor, sp.e)
  }
  if (cursor < raw.length) pushValue(cursor, raw.length)
  return { labels, values }
}

/** Aynı sırada duran etiket çiftleri — sayfanın eğimini bulmak için */
const ROW_PAIRS: [string, string][] = [
  ['plate_number', 'first_registration_date'],
  ['registration_sequence_no', 'registration_date'],
  ['brand', 'model_type'],
  ['commercial_name', 'year'],
  ['vehicle_type', 'color'],
  ['net_weight', 'max_laden_weight'],
  ['train_weight', 'trailer_max_weight'],
  ['seat_count', 'standing_capacity'],
  ['engine_capacity', 'engine_power'],
  ['fuel_type', 'power_weight_ratio'],
  ['usage_purpose', 'type_approval_no'],
  ['rights_holders', 'notary_sale_date'],
  ['other_info', '_stamp'],
]
const RIGHT_PAGE = new Set(['owner_tax_id', 'owner_surname', 'owner_first_name', 'owner_address', 'rights_holders', 'notary_sale_date', 'notary_sale_no', 'notary_name', 'other_info', '_stamp', '_approver', '_document'])

/**
 * Eğik fotoğraf (2026-11-12, Opel ruhsatı): sağa doğru yükselen uzun bir satırın kutusu, kendi
 * etiketinin ÜSTÜNDE görünür. Her sayfanın eğimi (sol ve sağ sayfa ayrı katlanır) aynı sıradaki
 * etiket çiftlerinden bulunur; parçaların yüksekliği satırın SOL UCUNA göre düzeltilir.
 */
function deskew(labels: Label[], values: Piece[]) {
  const slopeOf = (pairs: [string, string][]) => {
    const ss: number[] = []
    for (const [a, b] of pairs) {
      const la = labels.find((l) => l.field === a)
      const lb = labels.find((l) => l.field === b)
      if (!la || !lb || lb.x0 - la.x0 < 0.05) continue
      ss.push(((lb.top + lb.bottom) / 2 - (la.top + la.bottom) / 2) / (lb.x0 - la.x0))
    }
    return ss.length ? median(ss) : undefined
  }
  const left = slopeOf(ROW_PAIRS.filter(([a]) => !RIGHT_PAGE.has(a)))
  let right = slopeOf(ROW_PAIRS.filter(([a]) => RIGHT_PAGE.has(a)))
  const rightLabels = labels.filter((l) => RIGHT_PAGE.has(l.field))
  const split = rightLabels.length ? Math.min(...rightLabels.map((l) => l.x0)) - 0.02 : Infinity
  // Sağ sayfada aynı sırada iki etiket okunamadıysa eğim, uzun satırların kutu yüksekliğinden
  // (yazı yüksekliğini aşan kısım / genişlik) tahmin edilir; yönü sol sayfanınki (yoksa yükselen)
  if (right == null && split < Infinity) {
    const textH = median(labels.map((l) => l.h))
    const est = values.filter((v) => v.x0 >= split && v.x1 - v.x0 > 0.12).map((v) => Math.max(0, v.h - textH) / (v.x1 - v.x0))
    if (est.length) right = (left != null && left > 0 ? 1 : -1) * median(est)
  }
  if (left == null && right == null) return
  const fix = (p: Piece) => {
    const s = (p.x0 >= split ? (right ?? left) : (left ?? right)) ?? 0
    const w = p.x1 - p.x0
    // eğik satırın kutusu: yazı yüksekliği + eğimin getirdiği fark
    const textH = Math.max(p.h * 0.35, p.h - Math.abs(s) * w)
    const leftTop = s < 0 ? p.top - s * w : p.top
    const top = leftTop - s * p.x0
    p.top = top
    p.bottom = top + textH
  }
  for (const l of labels) fix(l)
  for (const v of values) fix(v)
}

/**
 * Etiketlere göre alan → değer satırları. Dönen satırlar normalizeCellText'e verilecek
 * biçimde (0-1, sol-alt orijin).
 */
export function assignRuhsatCells(lines: OcrLine[]): Record<string, OcrLine[]> {
  const labels: Label[] = []
  const values: (Piece & { sameLine?: Label })[] = []
  for (const l of lines) {
    if (!l.t.trim()) continue
    const r = splitLine(l)
    labels.push(...r.labels)
    for (const v of r.values) {
      // Etiketle aynı OCR satırında ve hemen sağında duran değer o etiketindir ("(D.5) CİNSİ OTOMOBİL")
      const before = r.labels.filter((lb) => lb.x1 <= v.x0 + 1e-6).sort((a, b) => b.x1 - a.x1)[0]
      values.push({ ...v, sameLine: before })
    }
  }
  if (labels.length < 4) return {}
  // Konum karşılaştırmaları eğim düzeltilmiş yüksekliklerle; dönen satırlar yine özgün kutularla
  const original = new Map(values.map((v) => [v, { top: v.top, bottom: v.bottom }]))
  deskew(labels, values)
  const lh = median(labels.map((l) => l.bottom - l.top)) || 0.015
  // Ruhsatın genişliği (yaklaşık) — yatay tolerans buna göre
  const docW = Math.max(0.2, Math.max(...labels.map((l) => l.x1)) - Math.min(...labels.map((l) => l.x0)))
  const tol = docW * 0.03
  // Her etiketin sağ sınırı: aynı sıradaki (aynı yükseklikteki) sağ komşu etiketin başı
  for (const l of labels) {
    // aynı sıradaki ya da hemen üst/alt sıralardaki (sağ sayfa kutuları kaydırmalı durur) sağdaki etiketler
    const row = labels.filter((o) => o !== l && Math.abs(o.top - l.top) < lh * 2.5 && o.x0 > Math.max(l.x1 - tol, l.x0 + docW * 0.12))
    l.right = row.length ? Math.min(...row.map((o) => o.x0)) : 1
  }

  // Sol/sağ sayfa sınırı: sağ sayfadaki değer sol sayfa kutusuna verilmez (ve tersi)
  const rightLabels = labels.filter((l) => RIGHT_PAGE.has(l.field))
  const split = rightLabels.length >= 2 ? Math.min(...rightLabels.map((l) => l.x0)) - tol : Infinity

  const out: Record<string, OcrLine[]> = {}
  const add = (field: string, v: Piece) => {
    if (field.startsWith('_')) return
    const o = original.get(v as never) ?? v
    ;(out[field] ??= []).push({ t: v.text, c: v.c, x: v.x0, w: Math.max(1e-4, v.x1 - v.x0), y: 1 - o.bottom, h: v.h })
  }
  for (const v of values) {
    if (v.sameLine) {
      add(v.sameLine.field, v)
      continue
    }
    const vMid = (v.top + v.bottom) / 2
    let best: Label | undefined
    let bestGap = Infinity
    for (const l of labels) {
      const gap = vMid - (l.top + l.bottom) / 2
      if (gap < -lh * 0.4 || gap > lh * 6) continue
      // Sütun: değer etiketin başından sonra ve sağ komşu etiketten önce başlamalı
      if (v.x0 < l.x0 - tol || v.x0 >= l.right - tol) continue
      if (v.x0 >= split !== RIGHT_PAGE.has(l.field)) continue
      if (gap < bestGap) {
        bestGap = gap
        best = l
      }
    }
    if (best) add(best.field, v)
  }
  // Ünvan etiketi okunamadıysa (bozuk: "TICUATOYVAN…") vergi no kutusuna düşen yazılı satırlar ünvandır
  if (!out.owner_surname && out.owner_tax_id) {
    const text = out.owner_tax_id.filter((l) => (fold(l.t).match(/[A-Z]/g)?.length ?? 0) >= 6 && !/\d{6,}/.test(l.t))
    if (text.length) {
      out.owner_surname = text
      out.owner_tax_id = out.owner_tax_id.filter((l) => !text.includes(l))
    }
  }
  return out
}

/** Belge seri no: "Seri: HG № 196356" — etiketsiz, satır içinden */
export function findDocumentSerial(lines: OcrLine[]): string | undefined {
  for (const l of lines) {
    const m = /SER[I1L]\s*[:;.]?\s*([A-Z]{1,3})\s*(?:N[O0º°]\.?|№|NE|N)?\s*(\d{5,8})/.exec(fold(l.t))
    if (m) return `${m[1]} ${m[2]}`
  }
  return undefined
}

/** Sadece etiket kelimelerinden oluşan metin mi ("SATIŞ NO", "NOTERİN ADI", "VE MENFAATİ BULUNANLAR") */
export function isRuhsatLabelText(v: string): boolean {
  let f = fold(v)
  for (const { re } of LABELS) f = f.replace(new RegExp(re.source, 'g'), ' ')
  for (const re of CONTINUATION) f = f.replace(new RegExp(re.source, 'g'), ' ')
  f = f.replace(/\b(?:NOTER\w*|SATIS|SATIŞ|NO|N0|ADI|VE|HAK|MENFAAT\w*|BULUNANLAR|D[I1]GER|B[I1]LG[I1]LER)\b/g, ' ').replace(CODE, ' ')
  return (f.match(/[A-Z0-9]/g)?.length ?? 0) < 3
}
