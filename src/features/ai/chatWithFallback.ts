import type { AIService } from './AIService'
import type { AIChatOptions, AIChatResult, AIMessage } from './types'

/**
 * Sağlayıcı yoğunken (503 / 429 "high demand" — Gemini'de sık) her modelde 2
 * deneme, sonra aynı sağlayıcı/anahtarla daha hafif yedek modele geçer
 * (2026-10-21). Boş yanıt da başarısız sayılır. Kalıcı hatalar (anahtar yok,
 * yetki vb.) hemen fırlatılır.
 */
const FALLBACK_MODELS: Partial<Record<string, string[]>> = {
  gemini: ['gemini-flash-lite-latest', 'gemini-2.5-flash'],
  openai: ['gpt-4o-mini'],
}

const TRANSIENT = /\b(503|429|500|502|504)\b|UNAVAILABLE|high demand|overloaded|rate/i

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
      } catch (err) {
        lastError = err
        const msg = err instanceof Error ? err.message : String(err)
        if (!TRANSIENT.test(msg)) throw err
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2500))
      }
    }
  }
  throw lastError ?? new Error('Yapay zekâdan yanıt alınamadı')
}
