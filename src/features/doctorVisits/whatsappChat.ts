import { addDays, startOfWeek } from 'date-fns'

import { parseVisitLines, type ImageVisitRow } from './visitText'

const TITLE_RE = /^(prof|doç|doc|op|uzm|dr)\b/i

interface ChatMessage {
  date: string
  sender: string
  lines: string[]
}

// iOS: "[23.10.2026 00:02:15] Duygu: …" / "[23.10.2026, 00:02:15] …"
// Android: "23.10.2026 00:02 - Duygu: …" / "10/23/26, 12:02 AM - Duygu: …"
const MESSAGE_RE =
  /^\[?(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[AaPp][Mm])?\]?\s*(?:-\s*)?([^:]{1,60}?):\s?(.*)$/

/** Sohbet dışa aktarımında dosya/medya ve sistem satırları ("<Medya dahil edilmedi>", "görüntü dahil edilmedi"…) */
const NOISE_RE = /(dahil edilmedi|omitted|<attached|<ek:|medya|bu mesaj silindi|this message was deleted|şifreleme|end-to-end|uçtan uca|\.(jpe?g|png|pdf|opus|mp4|webp)\b)/i

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').trim()

function toDate(d: string, m: string, y: string): string | null {
  let day = +d
  let month = +m
  if (month > 12 && day <= 12) [day, month] = [month, day] // ABD sırası (ay/gün)
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  const year = y.length === 2 ? 2000 + +y : +y
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function splitMessages(text: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const raw of text.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/ /g, ' ').split(/\r?\n/)) {
    const m = raw.match(MESSAGE_RE)
    const date = m && toDate(m[1], m[2], m[3])
    if (m && date) messages.push({ date, sender: m[4].trim(), lines: [m[5]] })
    else if (messages.length) messages[messages.length - 1].lines.push(raw) // çok satırlı mesajın devamı
  }
  return messages
}

/**
 * WhatsApp "Sohbeti Dışa Aktar" dosyasından (.txt ya da .zip içindeki _chat.txt) ziyaret edilen doktorları
 * tarih tarih çıkarır (kullanıcı isteği, 2026-11-13: "gereksiz konuşmaları almasın, sadece doktor bilgileri").
 * Sohbette temsilcinin mesajları varsa yalnız onlar okunur; her mesaj kendi tarihine yazılır (mesajın içinde
 * gün başlığı varsa o geçerli). Sadece ünvanlı ("Dr.", "Prof." …) ya da telefonlu kayıtlar alınır —
 * selamlaşma, toplantı, medya satırları gibi konuşmalar atılır.
 */
export function parseWhatsAppChat(text: string, repName: string): ImageVisitRow[] {
  const messages = splitMessages(text)
  if (!messages.length) throw new Error('Bu dosya WhatsApp sohbet dışa aktarımına benzemiyor.')

  const repKey = fold(repName.split(/\s+/)[0] ?? '')
  const fromRep = messages.filter((m) => repKey && fold(m.sender).split(/\s+/)[0] === repKey)
  const source = fromRep.length ? fromRep : messages

  const out: ImageVisitRow[] = []
  for (const msg of source) {
    const lines = msg.lines.filter((l) => !NOISE_RE.test(l))
    if (!lines.join('').trim()) continue
    const weekStart = startOfWeek(new Date(`${msg.date}T00:00:00`), { weekStartsOn: 1 })
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    for (const row of parseVisitLines(lines, days, repName)) {
      if (!TITLE_RE.test(row.name) && !row.phone) continue
      out.push({ ...row, date: row.date ?? msg.date })
    }
  }
  // Aynı gün aynı doktor iki mesajda geçtiyse açıklamalar birleştirilir
  const merged = new Map<string, ImageVisitRow>()
  for (const row of out) {
    const key = `${row.date}|${fold(row.name)}`
    const prev = merged.get(key)
    if (!prev) merged.set(key, { ...row })
    else {
      if (!prev.phone) prev.phone = row.phone
      if (row.notes && !prev.notes.includes(row.notes)) prev.notes = prev.notes ? `${prev.notes} ${row.notes}` : row.notes
    }
  }
  return [...merged.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
}

/** .txt ya da WhatsApp'ın .zip dışa aktarımından sohbet metnini okur */
export async function readWhatsAppChatFile(file: File): Promise<string> {
  if (/\.zip$/i.test(file.name)) {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const entry = Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name))
    if (!entry) throw new Error('Zip dosyasında sohbet metni (_chat.txt) bulunamadı.')
    return entry.async('string')
  }
  return file.text()
}

