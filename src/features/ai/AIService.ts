import { createAIProvider } from './providers/createProvider'
import { logUsage } from './api'
import {
  AIServiceError,
  type AIChatOptions,
  type AIChatResult,
  type AIConnectionTestResult,
  type AIMessage,
  type AIProvider,
  type AIProviderConfig,
} from './types'

/** Ana model başarısız olunca denenecek yedek modeller (sağlayıcı başına). */
const FALLBACK_MODELS: Partial<Record<AIProviderConfig['provider'], string[]>> = {
  gemini: ['gemini-flash-lite-latest'],
  openai: ['gpt-4o-mini'],
}
const RETRYABLE = new Set<AIServiceError['kind']>(['overloaded', 'rate_limit', 'model_not_found'])

function friendlyFinalError(err: AIServiceError | null): AIServiceError {
  if (!err) return new AIServiceError('Yapay zekâdan yanıt alınamadı', 'unknown')
  if (err.kind === 'overloaded') return new AIServiceError('Yapay zekâ sunucuları şu an çok yoğun — birkaç dakika sonra tekrar deneyin.', 'overloaded', err)
  if (err.kind === 'rate_limit')
    return new AIServiceError('Yapay zekâ kotası doldu (yedek model dahil) — birkaç dakika sonra tekrar deneyin.', 'rate_limit', err)
  return err
}

/**
 * Uygulamadaki her AI işleminin geçtiği tek kapı. Diğer hiçbir modül
 * doğrudan bir Provider sınıfı örneklemez veya `fetch` ile bir AI uç
 * noktasına gitmez — hepsi bu sınıf üzerinden akar, böylece loglama ve
 * hata sınıflandırması tek yerde garanti edilir.
 */
export class AIService {
  private readonly provider: AIProvider
  private readonly config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
    this.provider = createAIProvider(config)
  }

  /** Aynı sağlayıcı/anahtarla farklı bir model — yoğunlukta yedek modele geçmek için (2026-10-21). */
  withModel(model: string): AIService {
    return new AIService({ ...this.config, model })
  }

  get providerName(): AIProviderConfig['provider'] {
    return this.config.provider
  }

  get modelName(): string {
    return this.config.model
  }

  /**
   * Sohbet — ana model yoğun (503), limit dolu (429) ya da bulunamadı (404) ise
   * aynı soruyu yedek modelle tekrar sorar (kullanıcı bildirimi, 2026-10-27:
   * "yapay zekâ cevap vermiyor, hemen kota bitiyor" — gerçekte kota değil,
   * Google'ın ana modeli "high demand" 503 veriyordu; flash-lite çalışıyordu).
   * Sadece kullanıcının sorduğu soru için istek atılır; yedeğe geçiş en fazla bir
   * ek istek demektir.
   */
  async chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    let lastError: AIServiceError | null = null
    for (const svc of this.candidates()) {
      try {
        return await svc.chatOnce(messages, options)
      } catch (err) {
        lastError = err instanceof AIServiceError ? err : new AIServiceError('Beklenmeyen AI hatası', 'unknown', err)
        if (!RETRYABLE.has(lastError.kind)) throw lastError
      }
    }
    throw friendlyFinalError(lastError)
  }

  async streamChat(
    messages: AIMessage[],
    onToken: (delta: string) => void,
    options?: AIChatOptions,
  ): Promise<AIChatResult> {
    let lastError: AIServiceError | null = null
    for (const svc of this.candidates()) {
      let emitted = false
      try {
        return await svc.streamChatOnce(
          messages,
          (delta) => {
            emitted = true
            onToken(delta)
          },
          options,
        )
      } catch (err) {
        lastError = err instanceof AIServiceError ? err : new AIServiceError('Beklenmeyen AI hatası', 'unknown', err)
        // Yanıt yazılmaya başladıysa yarıda başka modele geçilmez
        if (emitted || !RETRYABLE.has(lastError.kind)) throw lastError
      }
    }
    throw friendlyFinalError(lastError)
  }

  /** Bu model + (aynı sağlayıcının) yedek modelleri, sırayla. */
  private candidates(): AIService[] {
    const fallbacks = (FALLBACK_MODELS[this.config.provider] ?? []).filter((m) => m !== this.config.model)
    return [this, ...fallbacks.map((m) => this.withModel(m))]
  }

  private async chatOnce(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    const start = performance.now()
    try {
      const result = await this.provider.chat(messages, options)
      this.logSuccess(start, result)
      return result
    } catch (err) {
      throw this.logFailure(start, err)
    }
  }

  private async streamChatOnce(
    messages: AIMessage[],
    onToken: (delta: string) => void,
    options?: AIChatOptions,
  ): Promise<AIChatResult> {
    const start = performance.now()
    try {
      const result = await this.provider.streamChat(messages, onToken, options)
      this.logSuccess(start, result)
      return result
    } catch (err) {
      throw this.logFailure(start, err)
    }
  }

  testConnection(): Promise<AIConnectionTestResult> {
    return this.provider.testConnection()
  }

  private logSuccess(start: number, result: AIChatResult) {
    void logUsage({
      provider: this.config.provider,
      model: this.config.model,
      success: true,
      durationMs: Math.round(performance.now() - start),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    })
  }

  private logFailure(start: number, err: unknown): AIServiceError {
    const serviceError =
      err instanceof AIServiceError ? err : new AIServiceError('Beklenmeyen AI hatası', 'unknown', err)
    void logUsage({
      provider: this.config.provider,
      model: this.config.model,
      success: false,
      durationMs: Math.round(performance.now() - start),
      errorMessage: serviceError.message,
    })
    return serviceError
  }
}
