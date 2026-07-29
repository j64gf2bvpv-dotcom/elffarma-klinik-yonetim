import type { AIChatOptions, AIChatResult, AIConnectionTestResult, AIMessage, AIProvider } from '../types'
import { openaiCompatibleChat, openaiCompatibleStreamChat, openaiCompatibleTestConnection } from './openaiCompatible'

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const GEMINI_DEFAULT_MODEL = 'gemini-1.5-flash'

/** Google'ın OpenAI-uyumlu katmanını kullanır — Gemini'ye özgü SDK'ya gerek yok. */
export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey?: string

  constructor(baseUrl: string = GEMINI_DEFAULT_BASE_URL, model: string = GEMINI_DEFAULT_MODEL, apiKey?: string) {
    this.baseUrl = baseUrl
    this.model = model
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
