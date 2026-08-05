import type { AIService } from '@/features/ai/AIService'
import { parseAiJsonArray, parseAiJsonObject } from './parseAiJsonArray'
import type { ExtractedContent } from './extractFileContent'

/**
 * Çıkarılmış dosya içeriğini (bkz. extractFileContent) hedef alan şemasına
 * göre yapılandırılmış satırlara çevirir — SmartImportDialog ve Yapay Zeka
 * Analiz > Dosya Özetle'nin "ilgili bölüme aktar" adımı bu TEK fonksiyonu
 * paylaşıyor (tekrar yazılmasın diye). Tablo (Excel/CSV) ise sadece SÜTUN
 * EŞLEMESİ AI'a soruluyor — değerler koddan doğrudan aktarılıyor, rakamların
 * AI tarafından yanlış "yeniden yazılması" riski böyle ortadan kalkıyor;
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
    if (content.rows.length === 0) throw new Error('Dosyada satır bulunamadı')
    const sourceHeaders = Object.keys(content.rows[0])
    const mappingInstruction =
      `Bir tablonun sütun başlıkları şunlar: ${sourceHeaders.map((h) => `"${h}"`).join(', ')}. ` +
      `Bu sütunlardan hangisinin şu hedef alanlara karşılık geldiğini belirle: ${fieldHeaders.map((h) => `"${h}"`).join(', ')}. ` +
      `SADECE şu formatta bir JSON objesi döndür (başka açıklama/metin ekleme): { "Hedef Alan": "Kaynak Sütun Adı", ... }. ` +
      `Bir hedef alan için uygun bir kaynak sütun yoksa değerini boş string "" yap. Değerleri KOPYALAMA, sadece sütun adlarını eşleştir.\n${hints}`

    const mappingResult = await aiService.chat([{ role: 'user', content: mappingInstruction }])
    const mapping = parseAiJsonObject(mappingResult.content)

    return content.rows.map((sourceRow) => {
      const out: Record<string, unknown> = {}
      for (const h of fieldHeaders) {
        const sourceCol = mapping[h]
        out[h] = typeof sourceCol === 'string' && sourceCol ? (sourceRow[sourceCol] ?? '') : ''
      }
      return out
    })
  }

  const instruction =
    `Aşağıdaki belgeden/görselden ${targetLabel} kayıtlarını EKSİKSİZ çıkar — belgede görünen HER kaydı ` +
    `atlamadan listeye ekle, sadece ilk birkaçını değil. Dikkatlice oku: el yazısı, tablo, liste veya serbest ` +
    `metin formatında olabilir; birimi/biçimi farklı yazılmış değerleri (ör. tarih, telefon, tutar) hedef alanın ` +
    `beklediği formata normalize et. SADECE bir JSON dizisi döndür (başka açıklama/metin ekleme). ` +
    `Her eleman şu alanlara sahip bir obje olsun: ${fieldHeaders.map((h) => `"${h}"`).join(', ')}. ` +
    `Bir alan belgede gerçekten yoksa boş string "" kullan — ama önce belgede o bilginin başka bir ` +
    `adla/yerde geçip geçmediğini kontrol et.\n${hints}`

  const result = await aiService.chat([
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
  ])

  const parsedRows = parseAiJsonArray(result.content)
  if (parsedRows.length === 0) throw new Error('Belgeden kayıt çıkarılamadı')
  return parsedRows
}
