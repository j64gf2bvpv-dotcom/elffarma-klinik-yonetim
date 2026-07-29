import type { AIProvider, AIProviderConfig } from '../types'
import { OllamaProvider } from './OllamaProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { GeminiProvider } from './GeminiProvider'
import { ClaudeProvider } from './ClaudeProvider'

/** Verilen yapılandırmaya göre doğru sağlayıcı örneğini üretir — tek geçiş noktası budur, başka yerde `new XProvider()` çağrılmaz. */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider(config.baseUrl, config.model)
    case 'openai':
      return new OpenAIProvider(config.baseUrl, config.model, config.apiKey)
    case 'gemini':
      return new GeminiProvider(config.baseUrl, config.model, config.apiKey)
    case 'claude':
      return new ClaudeProvider(config.baseUrl, config.model, config.apiKey)
  }
}
