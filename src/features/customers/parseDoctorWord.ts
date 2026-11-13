import * as mammoth from 'mammoth'

/** Word'den okunan tek doktor — önizlemede düzenlenip Cari Kart'a aktarılır */
export interface WordDoctorRow {
  name: string
  phone: string
  notes: string
}

// Cep (05xx), sabit hat (0212 vb.) ve +90'lı yazımlar; araları boşluk/nokta/tire/parantez olabilir
const PHONE_RE = /(?:\+?\s?90[\s.-]?)?(?:0\s?)?\(?0?\s?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/
const TITLE_RE = /^(dr|prof|doç|doc|uzm|op|dt|ecz)\b\.?/i
const NAME_LABEL_RE = /^(ad[ıi]?\s*soyad[ıi]?|isim|ad[ıi]|doktor(\s*ad[ıi])?|dr\.?\s*ad[ıi])\s*[:：]\s*/i
const PHONE_LABEL_RE = /^(tel(efon)?|gsm|cep(\s*tel(efonu)?)?|numara|no)\s*[:：]\s*/i
const NOTES_LABEL_RE = /^(a[çc][ıi]klama|not(lar)?|bilgi)\s*[:：]\s*/i
const SEP = /^[\s\-–—:|/,;•·]+|[\s\-–—:|/,;•·]+$/g

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(SEP, '').trim()
/** Baştaki sıra numarasını ("1.", "1-", "1)") atar */
const stripNumbering = (s: string) => s.replace(/^\s*\d{1,3}\s*[.)\-–]\s*/, '')

function isNameLike(line: string): boolean {
  if (TITLE_RE.test(line)) return true
  if (/\d/.test(line)) return false
  const words = line.split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 5 && words.every((w) => /^[A-ZÇĞİÖŞÜ]/.test(w))
}

const isHeaderJunk = (r: WordDoctorRow) => !r.phone && !r.notes && /liste|rehber|doktorlar|telefon|isim/.test(r.name.toLocaleLowerCase('tr-TR'))

function appendNote(row: WordDoctorRow, text: string) {
  const t = clean(text)
  if (t) row.notes = row.notes ? `${row.notes} · ${t}` : t
}

/** Tablo satırları: başlık satırı varsa sütunlara göre, yoksa içerikten (telefon sütunu, ilk metin = ad) */
function parseTable(table: HTMLTableElement): WordDoctorRow[] {
  const rows = [...table.rows].map((tr) => [...tr.cells].map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()))
  if (!rows.length) return []
  const head = rows[0].map((c) => c.toLocaleLowerCase('tr-TR'))
  const nameCol = head.findIndex((c) => /ad|isim|doktor|hekim/.test(c) && !/adres/.test(c))
  const phoneCol = head.findIndex((c) => /tel|gsm|cep|numara/.test(c))
  const hasHeader = nameCol >= 0 || phoneCol >= 0
  const out: WordDoctorRow[] = []
  for (const cells of hasHeader ? rows.slice(1) : rows) {
    if (!cells.some(Boolean)) continue
    const row: WordDoctorRow = { name: '', phone: '', notes: '' }
    cells.forEach((cell, i) => {
      if (!cell) return
      if (hasHeader) {
        if (i === nameCol) row.name = clean(cell)
        else if (i === phoneCol) row.phone = cell
        else if (/^(sıra|no|#)/i.test(head[i]) && /^\d+$/.test(cell)) return
        else appendNote(row, head[i] && !/a[çc][ıi]klama|not/.test(head[i]) ? `${rows[0][i]}: ${cell}` : cell)
        return
      }
      if (/^\d{1,3}\.?$/.test(cell)) return // sıra numarası sütunu
      if (!row.phone && PHONE_RE.test(cell) && cell.replace(/\D/g, '').length >= 10) row.phone = cell.match(PHONE_RE)![0]
      else if (!row.name) row.name = clean(stripNumbering(cell))
      else appendNote(row, cell)
    })
    if (row.name || row.phone) out.push(row)
  }
  return out
}

/** Paragraf metni: "Dr. Ad - 0532… - açıklama" satırları, "Ad: … / Tel: …" etiketli bloklar ya da alt alta bloklar */
function parseLines(lines: string[]): WordDoctorRow[] {
  const out: WordDoctorRow[] = []
  let cur: WordDoctorRow | null = null
  const close = () => {
    if (cur && (cur.name || cur.phone)) out.push(cur)
    cur = null
  }
  const nextHasPhone = (i: number) => {
    for (let j = i + 1; j < lines.length && lines[j].trim(); j++) {
      if (PHONE_RE.test(lines[j])) return true
      if (isNameLike(lines[j])) return false
    }
    return false
  }

  lines.forEach((raw, i) => {
    const line = stripNumbering(raw).trim()
    if (!line) {
      close()
      return
    }
    if (NAME_LABEL_RE.test(line)) {
      close()
      cur = { name: clean(line.replace(NAME_LABEL_RE, '')), phone: '', notes: '' }
      return
    }
    if (PHONE_LABEL_RE.test(line) && cur) {
      const m = line.match(PHONE_RE)
      if (m && !cur.phone) cur.phone = m[0]
      else appendNote(cur, line)
      return
    }
    if (NOTES_LABEL_RE.test(line)) {
      if (!cur) cur = { name: '', phone: '', notes: '' }
      appendNote(cur, line.replace(NOTES_LABEL_RE, ''))
      return
    }
    const m = line.match(PHONE_RE)
    if (m && m[0].replace(/\D/g, '').length >= 10) {
      const before = clean(line.slice(0, m.index))
      const after = line.slice(m.index! + m[0].length)
      if (/[a-zçğıöşü]/i.test(before)) {
        if (cur?.name && !cur.phone && !cur.notes && !isNameLike(before)) {
          // "Dr. Ayşe Yılmaz" satırının altında "Cep 0532…" gibi
          cur.phone = m[0]
          appendNote(cur, `${before} ${after}`)
          return
        }
        close()
        cur = { name: before, phone: m[0], notes: '' }
        appendNote(cur, after)
      } else if (cur && !cur.phone) {
        cur.phone = m[0]
        appendNote(cur, after)
      } else {
        close()
        cur = { name: '', phone: m[0], notes: '' }
        appendNote(cur, after)
      }
      return
    }
    // Telefonsuz satır
    if (!cur) {
      cur = { name: clean(line), phone: '', notes: '' }
    } else if (!cur.name) {
      cur.name = clean(line)
    } else if (isNameLike(line) && (cur.phone || TITLE_RE.test(line) || nextHasPhone(i))) {
      close()
      cur = { name: clean(line), phone: '', notes: '' }
    } else {
      appendNote(cur, line)
    }
  })
  close()
  return out
}

/** .docx dosyasındaki doktorları (ad, telefon, açıklama) sırayla çıkarır */
export async function parseDoctorWord(file: File): Promise<WordDoctorRow[]> {
  if (!/\.docx$/i.test(file.name)) throw new Error('Sadece .docx Word dosyaları okunabiliyor (eski .doc ise Word\'de "Farklı Kaydet > .docx" yapın).')
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { ignoreEmptyParagraphs: false })
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const rows: WordDoctorRow[] = []
  for (const table of [...doc.querySelectorAll('table')]) {
    rows.push(...parseTable(table as HTMLTableElement))
    table.remove()
  }
  const lines = [...doc.body.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6')].map((el) => el.textContent ?? '')
  rows.push(...parseLines(lines))
  return rows
    .map((r) => ({ name: r.name, phone: r.phone.trim(), notes: r.notes }))
    .filter((r) => !isHeaderJunk(r))
}
