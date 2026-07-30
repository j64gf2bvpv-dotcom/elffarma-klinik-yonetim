import type { AIProviderId, AISettings } from './types'
import { OLLAMA_DEFAULT_BASE_URL, OLLAMA_DEFAULT_MODEL } from './providers/OllamaProvider'
import { OPENAI_DEFAULT_BASE_URL, OPENAI_DEFAULT_MODEL } from './providers/OpenAIProvider'
import { GEMINI_DEFAULT_BASE_URL, GEMINI_DEFAULT_MODEL } from './providers/GeminiProvider'
import { CLAUDE_DEFAULT_BASE_URL, CLAUDE_DEFAULT_MODEL } from './providers/ClaudeProvider'

/** app_settings'te henüz bir kayıt yokken (ilk kurulum) kullanılacak varsayılan — talep gereği Ollama + Qwen. */
export const defaultAISettings: AISettings = {
  provider: 'ollama',
  baseUrl: (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined) || OLLAMA_DEFAULT_BASE_URL,
  model: (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) || OLLAMA_DEFAULT_MODEL,
}

export const providerDefaults: Record<AIProviderId, { baseUrl: string; model: string }> = {
  ollama: {
    baseUrl: (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined) || OLLAMA_DEFAULT_BASE_URL,
    model: (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) || OLLAMA_DEFAULT_MODEL,
  },
  openai: { baseUrl: OPENAI_DEFAULT_BASE_URL, model: OPENAI_DEFAULT_MODEL },
  gemini: { baseUrl: GEMINI_DEFAULT_BASE_URL, model: GEMINI_DEFAULT_MODEL },
  claude: { baseUrl: CLAUDE_DEFAULT_BASE_URL, model: CLAUDE_DEFAULT_MODEL },
}

export const providerLabels: Record<AIProviderId, string> = {
  ollama: 'Ollama (yerel)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
}

/**
 * Bulut sağlayıcıların API anahtarları kasıtlı olarak sadece burada, build
 * zamanında `.env`'den okunur — hiçbir zaman Supabase'e/app_settings'e
 * yazılmaz (tüm personelin okuyabildiği paylaşılan bir tablo, sır saklamaya
 * uygun değil).
 */
export function getApiKeyForProvider(provider: AIProviderId): string | undefined {
  switch (provider) {
    case 'ollama':
      return undefined
    case 'openai':
      return (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || undefined
    case 'gemini':
      return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || undefined
    case 'claude':
      return (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) || undefined
  }
}

/**
 * Personel kendi bulut AI aboneliğinin API anahtarını `staff_ai_keys`'e (kendi
 * satırına, RLS ile korumalı) kaydettiyse hangi kolonun ona karşılık geldiği.
 * Ollama yerel çalıştığı için anahtar gerektirmez.
 */
export function personalKeyFieldForProvider(
  provider: AIProviderId,
): 'openai_api_key' | 'gemini_api_key' | 'anthropic_api_key' | null {
  switch (provider) {
    case 'ollama':
      return null
    case 'openai':
      return 'openai_api_key'
    case 'gemini':
      return 'gemini_api_key'
    case 'claude':
      return 'anthropic_api_key'
  }
}
