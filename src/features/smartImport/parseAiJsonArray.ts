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
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('AI yanıtında geçerli bir liste bulunamadı')
  }

  const parsed: unknown = JSON.parse(candidate.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('AI yanıtı bir liste değil')
  return parsed as Record<string, unknown>[]
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
