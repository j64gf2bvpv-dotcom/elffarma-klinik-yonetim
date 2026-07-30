import type { AIChatOptions, AIChatResult, AIConnectionTestResult, AIMessage, AIProvider } from '../types'
import { openaiCompatibleChat, openaiCompatibleStreamChat, openaiCompatibleTestConnection } from './openaiCompatible'

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1'
export const OLLAMA_DEFAULT_MODEL = 'qwen2.5:3b'

/**
 * Yerel Ollama çalışma zamanı — varsayılan sağlayıcı. API anahtarı gerekmez;
 * Ollama'nın OpenAI-uyumlu `/v1` katmanını kullanır, böylece OpenAI/Gemini ile
 * aynı istemci kodunu paylaşır.
 */
export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const
  private readonly baseUrl: string
  private readonly model: string

  constructor(baseUrl: string = OLLAMA_DEFAULT_BASE_URL, model: string = OLLAMA_DEFAULT_MODEL) {
    this.baseUrl = baseUrl
    this.model = model
  }

  private get config() {
    return { baseUrl: this.baseUrl, model: this.model, providerLabel: 'Ollama' }
  }

  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult> {
    return openaiCompatibleChat(this.config, messages, options)
  }

  streamChat(messages: AIMessage[], onToken: (delta: string) => void, options?: AIChatOptions): Promise<AIChatResult> {
    return openaiCompatibleStreamChat(this.config, messages, onToken, options)
  }

  async testConnection(): Promise<AIConnectionTestResult> {
    const result = await openaiCompatibleTestConnection(this.config)
    if (result.ok && result.modelAvailable === false) {
      return {
        ...result,
        message: `Ollama çalışıyor ama "${this.model}" modeli yüklü değil — terminalde "ollama pull ${this.model}" çalıştırın.`,
      }
    }
    return result
  }
}
