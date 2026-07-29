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

  async chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    const start = performance.now()
    try {
      const result = await this.provider.chat(messages, options)
      this.logSuccess(start, result)
      return result
    } catch (err) {
      throw this.logFailure(start, err)
    }
  }

  async streamChat(
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
