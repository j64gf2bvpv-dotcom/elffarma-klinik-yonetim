import { AIServiceError, type AIChatOptions, type AIChatResult, type AIMessage } from './types'
import type { AIService } from './AIService'

/**
 * Sağlayıcı yoğun / kota dolu iken yedek modele geçen sohbet (2026-10-21).
 * Gemini'nin ücretsiz anahtarında modellerin kotası AYRI — ana model "istek
 * limiti aşıldı" (429) derken flash-lite hâlâ çalışıyor. Kurallar:
 *  - kota/limit (rate_limit) → beklemeden sıradaki modele geç
 *  - 5xx / yoğunluk → aynı modeli bir kez daha dene, sonra sıradakine geç
 *  - yedek model bulunamadı (404) → atla
 *  - anahtar geçersiz (auth) → hemen hata
 * Boş yanıt da başarısız sayılır.
 */
const FALLBACK_MODELS: Partial<Record<string, string[]>> = {
  gemini: ['gemini-flash-lite-latest', 'gemini-pro-latest'],
  openai: ['gpt-4o-mini'],
}

const OVERLOADED = /\b(500|502|503|504)\b|UNAVAILABLE|high demand|overloaded/i

export async function chatWithFallback(aiService: AIService, messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
  const candidates = [
    aiService,
    ...(FALLBACK_MODELS[aiService.providerName] ?? []).filter((m) => m !== aiService.modelName).map((m) => aiService.withModel(m)),
  ]
  let lastError: unknown = null
  for (const svc of candidates) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await svc.chat(messages, options)
        if (result.content.trim()) return result
        break // boş yanıt — sıradaki model
      } catch (err) {
        lastError = err
        const kind = err instanceof AIServiceError ? err.kind : 'unknown'
        const msg = err instanceof Error ? err.message : String(err)
        if (kind === 'auth') throw err
        if (kind === 'rate_limit' || kind === 'model_not_found') break
        if (OVERLOADED.test(msg) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 2500))
          continue
        }
        break
      }
    }
  }
  if (lastError instanceof AIServiceError && lastError.kind === 'rate_limit') {
    throw new AIServiceError(
      'Yapay zekâ kotası doldu (tüm modellerde). Birkaç dakika sonra "Tekrar oku"ya basın; sık oluyorsa Ayarlar > Yapay Zekâ\'ya kendi Gemini anahtarınızı girin.',
      'rate_limit',
    )
  }
  throw lastError ?? new Error('Yapay zekâdan yanıt alınamadı')
}
