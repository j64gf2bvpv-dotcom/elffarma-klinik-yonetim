import {
  AIServiceError,
  type AIChatOptions,
  type AIChatResult,
  type AIConnectionTestResult,
  type AIMessage,
  type AIProvider,
} from '../types'

export const CLAUDE_DEFAULT_BASE_URL = 'https://api.anthropic.com/v1'
export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-5'

const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 2048

/**
 * Anthropic'in Messages API'si OpenAI uyumlu değil (system prompt ayrı
 * gönderilir, `max_tokens` zorunludur, streaming olay tipleri farklıdır) —
 * bu yüzden diğer üçünden farklı olarak kendi isteğini kendi kurar, ama dışa
 * aynı `AIProvider` sözleşmesini sunar.
 */
export class ClaudeProvider implements AIProvider {
  readonly id = 'claude' as const
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey?: string

  constructor(baseUrl: string = CLAUDE_DEFAULT_BASE_URL, model: string = CLAUDE_DEFAULT_MODEL, apiKey?: string) {
    this.baseUrl = baseUrl
    this.model = model
    this.apiKey = apiKey
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey ?? '',
      'anthropic-version': ANTHROPIC_VERSION,
    }
  }

  /** Ortak `AIContentPart[]` şemasını (OpenAI-uyumlu) Anthropic'in kendi blok şemasına çevirir. */
  private toClaudeContent(content: AIMessage['content']): unknown {
    if (typeof content === 'string') return content
    return content.map((part) => {
      if (part.type === 'text') return { type: 'text', text: part.text }
      const match = /^data:(.+);base64,(.*)$/.exec(part.image_url.url)
      if (!match) return { type: 'text', text: '[görsel okunamadı]' }
      return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
    })
  }

  private splitSystem(messages: AIMessage[]): { system?: string; rest: { role: 'user' | 'assistant'; content: unknown }[] } {
    const systemMsg = messages.find((m) => m.role === 'system')?.content
    const system = typeof systemMsg === 'string' ? systemMsg : undefined
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: this.toClaudeContent(m.content) }))
    return { system, rest }
  }

  async chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    const { system, rest } = this.splitSystem(messages)
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers(),
        signal: options?.signal,
        body: JSON.stringify({
          model: this.model,
          system,
          messages: rest,
          max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options?.temperature,
          stream: false,
        }),
      })
      if (!res.ok) throw await this.classifyError(res)
      const data = await res.json()
      const content = data?.content?.map((block: { text?: string }) => block.text ?? '').join('') ?? ''
      return {
        content,
        promptTokens: data?.usage?.input_tokens,
        completionTokens: data?.usage?.output_tokens,
      }
    } catch (err) {
      throw this.wrapNetworkError(err)
    }
  }

  async streamChat(
    messages: AIMessage[],
    onToken: (delta: string) => void,
    options?: AIChatOptions,
  ): Promise<AIChatResult> {
    const { system, rest } = this.splitSystem(messages)
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers(),
        signal: options?.signal,
        body: JSON.stringify({
          model: this.model,
          system,
          messages: rest,
          max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options?.temperature,
          stream: true,
        }),
      })
      if (!res.ok) throw await this.classifyError(res)
      if (!res.body) throw new AIServiceError('Claude: akış desteklenmiyor', 'invalid_response')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let promptTokens: number | undefined
      let completionTokens: number | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload) continue
          try {
            const json = JSON.parse(payload)
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
              fullContent += json.delta.text
              onToken(json.delta.text as string)
            } else if (json.type === 'message_start') {
              promptTokens = json.message?.usage?.input_tokens
            } else if (json.type === 'message_delta') {
              completionTokens = json.usage?.output_tokens
            }
          } catch {
            // Bozuk bir SSE parçası akışın tamamını iptal ettirmemeli.
          }
        }
      }

      return { content: fullContent, promptTokens, completionTokens }
    } catch (err) {
      throw this.wrapNetworkError(err)
    }
  }

  async testConnection(): Promise<AIConnectionTestResult> {
    if (!this.apiKey) {
      return { ok: false, message: 'Claude için API anahtarı tanımlı değil (VITE_ANTHROPIC_API_KEY)' }
    }
    try {
      // Anthropic'in genel bir /models listeleme uç noktası kararlı değil; bağlantıyı
      // en ucuz şekilde doğrulamak için tek token'lık gerçek bir mesaj isteği atıyoruz.
      await this.chat([{ role: 'user', content: 'ping' }], { maxTokens: 1 })
      return { ok: true, message: 'Claude bağlantısı başarılı', modelAvailable: true }
    } catch (err) {
      const message = err instanceof AIServiceError ? err.message : 'Claude bağlantı testi başarısız'
      return { ok: false, message }
    }
  }

  private async classifyError(res: Response): Promise<AIServiceError> {
    let bodyMessage = res.statusText
    try {
      const data = await res.json()
      bodyMessage = data?.error?.message ?? bodyMessage
    } catch {
      // yanıt JSON değilse statusText ile devam
    }
    if (res.status === 401) return new AIServiceError('Claude: API anahtarı geçersiz', 'auth')
    if (res.status === 404) return new AIServiceError(`Claude: model bulunamadı — ${bodyMessage}`, 'model_not_found')
    if (res.status === 429) return new AIServiceError('Claude: istek limiti aşıldı', 'rate_limit')
    return new AIServiceError(`Claude hatası (${res.status}): ${bodyMessage}`, 'unknown')
  }

  private wrapNetworkError(err: unknown): AIServiceError {
    if (err instanceof AIServiceError) return err
    const message = err instanceof Error ? err.message : String(err)
    return new AIServiceError(`Claude'a bağlanılamadı: ${message}`, 'connection', err)
  }
}
