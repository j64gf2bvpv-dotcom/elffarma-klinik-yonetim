import type { AIChatOptions, AIChatResult, AIConnectionTestResult, AIMessage, AIProvider } from '../types'
import { openaiCompatibleChat, openaiCompatibleStreamChat, openaiCompatibleTestConnection } from './openaiCompatible'

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey?: string

  constructor(baseUrl: string = OPENAI_DEFAULT_BASE_URL, model: string = OPENAI_DEFAULT_MODEL, apiKey?: string) {
    this.baseUrl = baseUrl
    this.model = model
    this.apiKey = apiKey
  }

  private get config() {
    return { baseUrl: this.baseUrl, model: this.model, apiKey: this.apiKey, providerLabel: 'OpenAI' }
  }

  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    return openaiCompatibleChat(this.config, messages, options)
  }

  streamChat(messages: AIMessage[], onToken: (delta: string) => void, options?: AIChatOptions): Promise<AIChatResult> {
    return openaiCompatibleStreamChat(this.config, messages, onToken, options)
  }

  testConnection(): Promise<AIConnectionTestResult> {
    if (!this.apiKey) {
      return Promise.resolve({ ok: false, message: 'OpenAI için API anahtarı tanımlı değil (VITE_OPENAI_API_KEY)' })
    }
    return openaiCompatibleTestConnection(this.config)
  }
}
