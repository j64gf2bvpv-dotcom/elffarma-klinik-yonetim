export interface DocDates {
  documentDate?: string
  validUntil?: string
}

const MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık']
const pad = (n: number) => String(n).padStart(2, '0')

// Belge içindeki etiketler: geçerlilik / belge (düzenleme) tarihi / doğum (alınmaz)
const VALID_RE = /geçerl|gecerl|bitiş|bitis|son kullanma|valid|expir|tarihine kadar|\b4\s*b\b/i
const ISSUE_RE = /düzenle|duzenle|veriliş|verilis|verildiği|tanzim|issue|kayıt tarihi|başlangıç|baslangic|onay tarihi|rapor tarihi|\b4\s*a\b|tarih/i
const BIRTH_RE = /doğum|dogum|birth|^\s*3\s*[.)]/i

/** Satırdaki tarihler (yyyy-MM-dd): 13.11.2026, 13/11/2026, 2026-11-13, 13 Kasım 2026 */
function datesIn(line: string): string[] {
  const out: string[] = []
  for (const m of line.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/g)) {
    const d = +m[1], mo = +m[2], y = +m[3]
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1950 && y <= 2100) out.push(`${y}-${pad(mo)}-${pad(d)}`)
  }
  for (const m of line.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`)
  const low = line.toLocaleLowerCase('tr-TR')
  for (const m of low.matchAll(new RegExp(`(?<!\\d)(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'g'))) {
    out.push(`${m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(+m[1])}`)
  }
  return out
}

/** Belge metninden belge tarihi ve geçerlilik tarihi (etikete göre; etiket yoksa en eski/en ileri tarih) */
export function parseDocDates(text: string): DocDates {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const result: DocDates = {}
  const free: string[] = []
  lines.forEach((line, i) => {
    const dates = datesIn(line)
    if (!dates.length) return
    // Etiket aynı satırda ya da bir üst satırda olabilir ("Geçerlilik Tarihi" / "21.05.2034")
    const context = datesIn(lines[i - 1] ?? '').length ? line : `${lines[i - 1] ?? ''} ${line}`
    if (BIRTH_RE.test(context)) return
    if (VALID_RE.test(context)) result.validUntil ??= dates[dates.length - 1]
    else if (ISSUE_RE.test(context)) result.documentDate ??= dates[0]
    else free.push(...dates)
  })
  // Etiketi ayrı sütunda kalmış doğum tarihi: belgedeki en yeni tarihten 14 yıldan eskiyse belge tarihi sayılmaz
  // (e-Devlet adli sicil / askerlik belgelerinde "21.02.1996" belge tarihi sanılıyordu)
  const newest = [...free].sort().at(-1)
  const birthLike = (d: string) => !!newest && Date.parse(newest) - Date.parse(d) > 14 * 365 * 864e5
  const sorted = [...new Set(free)].filter((d) => !birthLike(d)).sort()
  if (!result.documentDate && sorted.length) result.documentDate = sorted[0]
  // Etiketsiz geçerlilik: belge tarihinden en az bir ay sonraki en ileri tarih
  if (!result.validUntil && sorted.length > 1) {
    const last = sorted[sorted.length - 1]
    if (result.documentDate && last > result.documentDate && Date.parse(last) - Date.parse(result.documentDate) > 30 * 864e5) result.validUntil = last
  }
  if (result.validUntil && result.documentDate && result.validUntil <= result.documentDate) delete result.validUntil
  return result
}

