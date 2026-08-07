// Masaüstündeki src/features/ai/types.ts'in kartvizit tarama için gereken alt
// kümesi — sadece tek seferlik (streaming olmayan) sohbet + görsel eki.
export type AIProviderId = 'ollama' | 'openai' | 'gemini' | 'claude'

export interface AIImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface AITextPart {
  type: 'text'
  text: string
}

export type AIContentPart = AITextPart | AIImagePart

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AIContentPart[]
}

export interface AIChatResult {
  content: string
}

export type AIServiceErrorKind = 'connection' | 'auth' | 'model_not_found' | 'rate_limit' | 'invalid_response' | 'unknown'

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly kind: AIServiceErrorKind,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

export interface AISettings {
  provider: AIProviderId
  baseUrl: string
  model: string
}
