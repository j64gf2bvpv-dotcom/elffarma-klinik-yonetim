/**
 * AI'ın serbest metin yanıtından bir JSON dizisi çıkarır — önce ```json
 * çitli bloğu dener, sonra ilk `[` ile son `]` arasındaki alt metni. AI
 * modelleri saf JSON istense de bazen açıklama ekleyebiliyor; bu yüzden
 * "sadece JSON döndür" talimatına güvenmek yerine savunmacı ayrıştırma
 * yapılıyor.
 */
export function parseAiJsonArray(raw: string): Record<string, unknown>[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : raw

  const start = candidate.indexOf('[')
  if (start === -1) throw new Error('AI yanıtında geçerli bir liste bulunamadı')
  const end = candidate.lastIndexOf(']')

  if (end !== -1 && end > start) {
    try {
      const parsed: unknown = JSON.parse(candidate.slice(start, end + 1))
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
    } catch {
      // Aşağıya düş — muhtemelen yanıt token limitinde kesilmiş, tek tek kurtar.
    }
  }

  // Yanıt kesilmiş (ör. çok kayıtlı bir belge token limitini aştı) ya da
  // dizinin dışına metin sızmış olabilir. Tüm listeyi tek seferde ayrıştırmak
  // yerine dizinin içindeki TAM objeleri teker teker çıkar — yarım kalmış son
  // objeyi sessizce atla ama öncesindeki her kaydı koru, hepsini kaybetme.
  const recovered = recoverJsonObjects(candidate.slice(start + 1))
  if (recovered.length === 0) throw new Error('AI yanıtında geçerli bir liste bulunamadı')
  return recovered
}

function recoverJsonObjects(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []
  let i = 0
  while (i < text.length) {
    const objStart = text.indexOf('{', i)
    if (objStart === -1) break
    let depth = 0
    let inString = false
    let escape = false
    let objEnd = -1
    for (let j = objStart; j < text.length; j++) {
      const ch = text[j]
      if (inString) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          objEnd = j
          break
        }
      }
    }
    if (objEnd === -1) break // kesilmiş obje kurtarılamaz, dur — öncekiler korunur
    try {
      const obj: unknown = JSON.parse(text.slice(objStart, objEnd + 1))
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) results.push(obj as Record<string, unknown>)
    } catch {
      // Bozuk tekil obje — atla, sonrakilerle devam et.
    }
    i = objEnd + 1
  }
  return results
}

/**
 * AI'ın serbest metin yanıtından bir JSON OBJESİ çıkarır (dizi değil) — sütun
 * eşleme yanıtları için kullanılır: `{ "Hedef Alan": "Kaynak Sütun Adı" }`.
 */
export function parseAiJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : raw

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('AI yanıtında geçerli bir obje bulunamadı')
  }

  const parsed: unknown = JSON.parse(candidate.slice(start, end + 1))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI yanıtı bir obje değil')
  }
  return parsed as Record<string, unknown>
}
