import type { AIChatOptions, AIChatResult, AIConnectionTestResult, AIMessage, AIProvider } from '../types'
import { openaiCompatibleChat, openaiCompatibleStreamChat, openaiCompatibleTestConnection } from './openaiCompatible'

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
// Google, belirli model sürümlerini (gemini-1.5-flash, sonra gemini-2.5-flash) yeni
// hesaplar için kullanımdan kaldırıyor — sabit bir sürüm yerine Google'ın her zaman
// güncel önerilen flash modeline işaret eden "latest" takma adı kullanılıyor, böylece
// bir sonraki kullanımdan kaldırmada bu varsayılan tekrar kırılmaz.
export const GEMINI_DEFAULT_MODEL = 'gemini-pro-latest'

/** Google'ın OpenAI-uyumlu katmanını kullanır — Gemini'ye özgü SDK'ya gerek yok. */
export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey?: string

  constructor(baseUrl: string = GEMINI_DEFAULT_BASE_URL, model: string = GEMINI_DEFAULT_MODEL, apiKey?: string) {
    this.baseUrl = baseUrl
    // Google'ın OpenAI-uyumlu katmanı "models/" önekini kabul etmiyor — kullanıcı
    // yanlışlıkla bu önekle ya da baştan/sondan boşlukla girerse Google
    // "unexpected model name format" (400) hatası döner; burada temizliyoruz.
    this.model = model.trim().replace(/^models\//, '')
    this.apiKey = apiKey
  }

  private get config() {
    return { baseUrl: this.baseUrl, model: this.model, apiKey: this.apiKey, providerLabel: 'Gemini' }
  }

  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    return openaiCompatibleChat(this.config, messages, options)
  }

  streamChat(messages: AIMessage[], onToken: (delta: string) => void, options?: AIChatOptions): Promise<AIChatResult> {
    return openaiCompatibleStreamChat(this.config, messages, onToken, options)
  }

  testConnection(): Promise<AIConnectionTestResult> {
    if (!this.apiKey) {
      return Promise.resolve({ ok: false, message: 'Gemini için API anahtarı tanımlı değil (VITE_GEMINI_API_KEY)' })
    }
    return openaiCompatibleTestConnection(this.config)
  }
}
