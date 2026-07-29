/**
 * AI altyapısının tek gerçek kaynağı olan tipler. Bu dosya dışındaki hiçbir
 * modül sağlayıcıya özgü (Ollama/OpenAI/Gemini/Claude) bir tipe veya isteğe
 * doğrudan bağımlı olmamalı — her şey AIService + bu arayüzler üzerinden akar.
 */

export type AIProviderId = 'ollama' | 'openai' | 'gemini' | 'claude'

export type AIMessageRole = 'system' | 'user' | 'assistant'

export interface AIMessage {
  role: AIMessageRole
  content: string
}

export interface AIChatOptions {
  temperature?: number
  maxTokens?: number
  /** İstek iptali için (kullanıcı "durdur" derse). */
  signal?: AbortSignal
}

export interface AIChatResult {
  content: string
  promptTokens?: number
  completionTokens?: number
}

export interface AIConnectionTestResult {
  ok: boolean
  message: string
  /** Yapılandırılan model gerçekten yüklü/erişilebilir mi (sağlayıcı destekliyorsa). */
  modelAvailable?: boolean
  availableModels?: string[]
}

/** Tüm sağlayıcıların uyması gereken tek sözleşme. */
export interface AIProvider {
  readonly id: AIProviderId
  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult>
  streamChat(
    messages: AIMessage[],
    onToken: (delta: string) => void,
    options?: AIChatOptions,
  ): Promise<AIChatResult>
  testConnection(): Promise<AIConnectionTestResult>
}

export interface AIProviderConfig {
  provider: AIProviderId
  baseUrl: string
  model: string
  /** Bulut sağlayıcılar için — asla Supabase'e/app_settings'e yazılmaz, sadece .env'den okunur. */
  apiKey?: string
}

/** `app_settings` tablosunda saklanan, gizli olmayan tek ayar bloğu (`ai_settings` anahtarı). */
export interface AISettings {
  provider: AIProviderId
  baseUrl: string
  model: string
}

export type AIServiceErrorKind = 'connection' | 'auth' | 'model_not_found' | 'rate_limit' | 'invalid_response' | 'unknown'

export class AIServiceError extends Error {
  readonly kind: AIServiceErrorKind
  readonly cause?: unknown

  constructor(message: string, kind: AIServiceErrorKind, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'AIServiceError'
  }
}
