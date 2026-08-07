import type { AIService } from '@/features/ai/AIService'
import { parseAiJsonArray, parseAiJsonObject } from './parseAiJsonArray'
import type { ExtractedContent } from './extractFileContent'

/**
 * Bir TEK sayfanın (sheet) satırlarını hedef alan şemasına eşler — sütun
 * EŞLEMESİ AI'a soruluyor, değerler koddan doğrudan aktarılıyor (rakamların
 * AI tarafından yanlış "yeniden yazılması" riski böyle ortadan kalkıyor).
 */
async function mapSheetRows(
  aiService: AIService,
  rows: Record<string, unknown>[],
  fieldHeaders: string[],
  hints: string,
): Promise<Record<string, unknown>[]> {
  const sourceHeaders = Object.keys(rows[0])

  // Sadece sütun BAŞLIĞI metnini göndermek yetersiz kalabiliyor: gerçek
  // Excel dosyalarında başlık satırı üstte bir logo/başlık satırından sonra
  // geliyorsa (xlsx okuyucusu ilk satırı başlık sayar) ya da başlık hücreleri
  // birleşikse, sütun adları "__EMPTY", "__EMPTY_1" gibi anlamsız çıkabilir —
  // bu durumda AI'ın eşleştirecek hiçbir ipucu kalmıyor ve TÜM satırlarda
  // aynı alan (ör. ürün adı) boş dönüp topluca hataya düşüyor. Bir insan
  // böyle bir tabloya baktığında başlığa değil örnek DEĞERLERE bakıp
  // sütunu tanır — o yüzden her sütundan birkaç örnek değeri de mapping
  // isteğine ekliyoruz.
  const sampleValuesByHeader = new Map<string, string[]>()
  for (const h of sourceHeaders) sampleValuesByHeader.set(h, [])
  for (const row of rows.slice(0, 5)) {
    for (const h of sourceHeaders) {
      const v = row[h]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        sampleValuesByHeader.get(h)?.push(String(v).trim())
      }
    }
  }
  const columnsDescription = sourceHeaders
    .map((h) => `"${h}" (örnek değerler: ${(sampleValuesByHeader.get(h) ?? []).slice(0, 3).join(' | ') || 'yok'})`)
    .join('\n')

  const mappingInstruction =
    `Bir tablonun sütunları ve her birinden birkaç örnek değer aşağıda listelenmiştir:\n${columnsDescription}\n\n` +
    `Bu sütunlardan hangisinin şu hedef alanlara karşılık geldiğini belirle: ${fieldHeaders.map((h) => `"${h}"`).join(', ')}. ` +
    `Başlık metni anlamsız/otomatik üretilmiş görünse bile (ör. "__EMPTY" gibi), örnek değerlere bakarak içeriğin ne olduğunu ` +
    `anla ve buna göre eşleştir — bir insan da başlığa değil verinin içeriğine bakarak karar verir. ` +
    `SADECE şu formatta bir JSON objesi döndür (başka açıklama/metin ekleme): { "Hedef Alan": "Kaynak Sütun Adı", ... }. ` +
    `"Kaynak Sütun Adı" yukarıdaki sütun adlarından BİRİYLE (tırnak içindeki metinle) BİREBİR aynı olmalı. ` +
    `Bir hedef alan için uygun bir kaynak sütun yoksa değerini boş string "" yap. Değerleri KOPYALAMA, sadece sütun adlarını eşleştir.\n${hints}`

  const mappingResult = await aiService.chat([{ role: 'user', content: mappingInstruction }])
  const mapping = parseAiJsonObject(mappingResult.content)

  // AI bazen sütun adını birebir değil, boşluk/büyük-küçük harf farkıyla ya
  // da hafif parafrazla döndürebiliyor — birebir eşleşme yoksa normalize
  // edilmiş (boşluksuz, küçük harf) karşılaştırmayla asıl sütunu bul, yine
  // de bulunamazsa alan boş kalsın (hata mesajıyla kullanıcıya görünür).
  const normalize = (s: string) => s.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ')
  const normalizedToActual = new Map(sourceHeaders.map((h) => [normalize(h), h]))
  function resolveSourceColumn(name: string): string | null {
    if (sourceHeaders.includes(name)) return name
    return normalizedToActual.get(normalize(name)) ?? null
  }

  return rows.map((sourceRow) => {
    const out: Record<string, unknown> = {}
    for (const h of fieldHeaders) {
      const mapped = mapping[h]
      const sourceCol = typeof mapped === 'string' && mapped ? resolveSourceColumn(mapped) : null
      out[h] = sourceCol ? (sourceRow[sourceCol] ?? '') : ''
    }
    return out
  })
}

/**
 * Çıkarılmış dosya içeriğini (bkz. extractFileContent) hedef alan şemasına
 * göre yapılandırılmış satırlara çevirir — SmartImportDialog ve Yapay Zeka
 * Analiz > Dosya Özetle'nin "ilgili bölüme aktar" adımı bu TEK fonksiyonu
 * paylaşıyor (tekrar yazılmasın diye). Tablo (Excel/CSV) bir çalışma
 * kitabındaki BİRDEN FAZLA sayfayı (ör. bir sekmede doktorlar, başka bir
 * sekmede ek bir doktor listesi) içerebilir — her sayfa kendi sütun
 * başlıklarıyla AYRI AYRI eşlenir (sayfalar arasında başlıklar farklı
 * olabilir) ve sonuçlar birleştirilip TEK bir satır listesi olarak döner;
 * metin/görsel ise kayıtların tamamı AI'dan JSON dizisi olarak isteniyor.
 */
export async function extractRowsWithAI(
  aiService: AIService,
  content: ExtractedContent,
  targetLabel: string,
  fieldHeaders: string[],
  fieldHints?: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const hints = fieldHints ? Object.entries(fieldHints).map(([k, v]) => `- "${k}": ${v}`).join('\n') : ''

  if (content.kind === 'table') {
    const nonEmptySheets = content.sheets.filter((s) => s.rows.length > 0)
    if (nonEmptySheets.length === 0) throw new Error('Dosyada satır bulunamadı')

    const allRows: Record<string, unknown>[] = []
    for (const sheet of nonEmptySheets) {
      allRows.push(...(await mapSheetRows(aiService, sheet.rows, fieldHeaders, hints)))
    }
    return allRows
  }

  const instruction =
    `Aşağıdaki belgeden/görselden ${targetLabel} kayıtlarını EKSİKSİZ çıkar — belgede görünen HER kaydı ` +
    `atlamadan listeye ekle, sadece ilk birkaçını değil. Dikkatlice oku: el yazısı, tablo, liste veya serbest ` +
    `metin formatında olabilir; birimi/biçimi farklı yazılmış değerleri (ör. tarih, telefon, tutar) hedef alanın ` +
    `beklediği formata normalize et. SADECE bir JSON dizisi döndür (başka açıklama/metin ekleme). ` +
    `Her eleman şu alanlara sahip bir obje olsun: ${fieldHeaders.map((h) => `"${h}"`).join(', ')}. ` +
    `Bir alan belgede gerçekten yoksa boş string "" kullan — ama önce belgede o bilginin başka bir ` +
    `adla/yerde geçip geçmediğini kontrol et.\n${hints}`

  const result = await aiService.chat(
    [
      {
        role: 'user',
        content:
          content.kind === 'image'
            ? [
                { type: 'text', text: instruction },
                ...content.dataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
              ]
            : `${instruction}\n\nBelge içeriği:\n${content.text}`,
      },
    ],
    // Sağlayıcı varsayılanı (ör. Claude'da 2048 token) çok kayıtlı bir belgede
    // yanıtı ortasından keser — parseAiJsonArray o durumda elden geleni kurtarır
    // ama asıl çözüm baştan yeterli tavan tanımak: onlarca/yüzlerce kayıt JSON
    // olarak sığsın diye üst sınırı yükselt.
    { maxTokens: 8000 },
  )

  const parsedRows = parseAiJsonArray(result.content)
  if (parsedRows.length === 0) throw new Error('Belgeden kayıt çıkarılamadı')
  return parsedRows
}
