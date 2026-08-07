// Masaüstündeki src/features/ai/providers/openaiCompatible.ts +
// ClaudeProvider.ts'in kartvizit tarama için gereken alt kümesi — sadece
// tek seferlik (streaming olmayan) sohbet. React Native'in fetch'i akış
// (ReadableStream) okumayı güvenilir desteklemediği için streamChat hiç
// taşınmadı; bu ekranda zaten tek bir yanıt yeterli.
import { supabase } from '@/lib/supabaseClient'
import { getCurrentUserId } from '@/lib/offlineMutation'
import { AIServiceError, type AIMessage, type AIProviderId, type AISettings } from './types'

const AI_SETTINGS_KEY = 'ai_settings'

const providerDefaults: Record<Exclude<AIProviderId, 'ollama'>, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5' },
}

function envKeyForProvider(provider: AIProviderId): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.EXPO_PUBLIC_OPENAI_API_KEY || undefined
    case 'gemini':
      return process.env.EXPO_PUBLIC_GEMINI_API_KEY || undefined
    case 'claude':
      return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || undefined
    case 'ollama':
      return undefined
  }
}

function personalKeyField(provider: AIProviderId): 'openai_api_key' | 'gemini_api_key' | 'anthropic_api_key' | null {
  switch (provider) {
    case 'openai':
      return 'openai_api_key'
    case 'gemini':
      return 'gemini_api_key'
    case 'claude':
      return 'anthropic_api_key'
    case 'ollama':
      return null
  }
}

async function resolveConfig(): Promise<{ provider: AIProviderId; baseUrl: string; model: string; apiKey?: string }> {
  const { data: settingsRow } = await supabase.from('app_settings').select('value').eq('key', AI_SETTINGS_KEY).maybeSingle()
  const settings = (settingsRow?.value as AISettings | undefined) ?? { provider: 'gemini', ...providerDefaults.gemini }

  if (settings.provider === 'ollama') {
    throw new AIServiceError(
      'Etkin AI sağlayıcısı (Ollama, yerel) görsel giriş desteklemiyor — Ayarlar > Yapay Zekâ\'dan OpenAI/Gemini/Claude seçin.',
      'invalid_response',
    )
  }

  const userId = await getCurrentUserId()
  let personalKey: string | undefined
  const field = personalKeyField(settings.provider)
  if (field && userId) {
    const { data } = await supabase.from('staff_ai_keys').select(field).eq('staff_id', userId).maybeSingle()
    personalKey = (data as Record<string, string | null> | null)?.[field] ?? undefined
  }

  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl || providerDefaults[settings.provider as Exclude<AIProviderId, 'ollama'>].baseUrl,
    model: settings.model || providerDefaults[settings.provider as Exclude<AIProviderId, 'ollama'>].model,
    apiKey: personalKey || envKeyForProvider(settings.provider),
  }
}

async function openaiCompatibleChat(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: AIMessage[],
  providerLabel: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, messages, stream: false }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const bodyMessage = body?.error?.message ?? res.statusText
    if (res.status === 401 || res.status === 403) throw new AIServiceError(`${providerLabel}: API anahtarı geçersiz veya eksik`, 'auth')
    if (res.status === 429) throw new AIServiceError(`${providerLabel}: istek limiti aşıldı`, 'rate_limit')
    throw new AIServiceError(`${providerLabel} hatası (${res.status}): ${bodyMessage}`, 'unknown')
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new AIServiceError(`${providerLabel}: beklenmeyen yanıt biçimi`, 'invalid_response')
  return content
}

async function claudeChat(baseUrl: string, apiKey: string | undefined, model: string, messages: AIMessage[]): Promise<string> {
  const claudeContent = (content: AIMessage['content']): unknown => {
    if (typeof content === 'string') return content
    return content.map((part) => {
      if (part.type === 'text') return { type: 'text', text: part.text }
      const match = /^data:(.+);base64,(.*)$/.exec(part.image_url.url)
      if (!match) return { type: 'text', text: '[görsel okunamadı]' }
      return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
    })
  }
  const system = messages.find((m) => m.role === 'system')?.content
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: claudeContent(m.content) }))

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      system: typeof system === 'string' ? system : undefined,
      messages: rest,
      max_tokens: 1024,
      stream: false,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const bodyMessage = body?.error?.message ?? res.statusText
    if (res.status === 401) throw new AIServiceError('Claude: API anahtarı geçersiz', 'auth')
    if (res.status === 429) throw new AIServiceError('Claude: istek limiti aşıldı', 'rate_limit')
    throw new AIServiceError(`Claude hatası (${res.status}): ${bodyMessage}`, 'unknown')
  }
  const data = await res.json()
  return data?.content?.map((block: { text?: string }) => block.text ?? '').join('') ?? ''
}

/** Tek bir görsel + talimat metniyle AIService'e tek seferlik sohbet isteği atar. */
export async function chatWithImage(imageBase64: string, mimeType: string, instruction: string): Promise<string> {
  const config = await resolveConfig()
  const messages: AIMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: instruction },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      ],
    },
  ]

  try {
    if (config.provider === 'claude') return await claudeChat(config.baseUrl, config.apiKey, config.model, messages)
    const label = config.provider === 'gemini' ? 'Gemini' : 'OpenAI'
    return await openaiCompatibleChat(config.baseUrl, config.apiKey, config.model, messages, label)
  } catch (err) {
    if (err instanceof AIServiceError) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw new AIServiceError(`AI sağlayıcısına bağlanılamadı: ${message}`, 'connection', err)
  }
}

async function resolveTextConfig(): Promise<{ provider: AIProviderId; baseUrl: string; model: string; apiKey?: string }> {
  const { data: settingsRow } = await supabase.from('app_settings').select('value').eq('key', AI_SETTINGS_KEY).maybeSingle()
  const settings = (settingsRow?.value as AISettings | undefined) ?? { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:3b' }

  if (settings.provider === 'ollama') {
    return {
      provider: 'ollama',
      baseUrl: settings.baseUrl || 'http://localhost:11434',
      model: settings.model || 'qwen2.5:3b',
      apiKey: undefined,
    }
  }

  const userId = await getCurrentUserId()
  let personalKey: string | undefined
  const field = personalKeyField(settings.provider)
  if (field && userId) {
    const { data } = await supabase.from('staff_ai_keys').select(field).eq('staff_id', userId).maybeSingle()
    personalKey = (data as Record<string, string | null> | null)?.[field] ?? undefined
  }

  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl || providerDefaults[settings.provider as Exclude<AIProviderId, 'ollama'>].baseUrl,
    model: settings.model || providerDefaults[settings.provider as Exclude<AIProviderId, 'ollama'>].model,
    apiKey: personalKey || envKeyForProvider(settings.provider),
  }
}

/** Metin-only sohbet — Ollama dahil tüm sağlayıcılar. AI Analiz ekranı için. */
export async function chatWithText(prompt: string): Promise<string> {
  const config = await resolveTextConfig()
  const messages: AIMessage[] = [
    { role: 'user', content: prompt },
  ]

  try {
    if (config.provider === 'claude') return await claudeChat(config.baseUrl, config.apiKey, config.model, messages)
    const label = config.provider === 'ollama' ? 'Ollama' : config.provider === 'gemini' ? 'Gemini' : 'OpenAI'
    return await openaiCompatibleChat(config.baseUrl, config.apiKey, config.model, messages, label)
  } catch (err) {
    if (err instanceof AIServiceError) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw new AIServiceError(`AI sağlayıcısına bağlanılamadı: ${message}`, 'connection', err)
  }
}
