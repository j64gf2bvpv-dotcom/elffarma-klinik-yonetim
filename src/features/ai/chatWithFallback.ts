import { AIServiceError, type AIChatOptions, type AIChatResult, type AIMessage } from './types'
import type { AIService } from './AIService'

/**
 * Yedek modele geçiş artık AIService.chat'in içinde (2026-10-27) — burada sadece
 * boş yanıt kontrolü kaldı (boş gelirse bir kez daha sorulur). Geriye dönük uyum için.
 */
export async function chatWithFallback(aiService: AIService, messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
  const first = await aiService.chat(messages, options)
  if (first.content.trim()) return first
  const second = await aiService.chat(messages, options)
  if (second.content.trim()) return second
  throw new AIServiceError('Yapay zekâ boş yanıt verdi — biraz sonra tekrar deneyin.', 'invalid_response')
}
