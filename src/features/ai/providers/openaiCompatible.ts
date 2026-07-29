import { AIServiceError, type AIChatOptions, type AIChatResult, type AIConnectionTestResult, type AIMessage } from '../types'

/**
 * OpenAI'nin `/chat/completions` + `/models` sözleşmesini konuşan her sağlayıcı
 * (Ollama, OpenAI, Gemini'nin OpenAI-uyumlu katmanı) için ortak istemci.
 * Sağlayıcıya özgü olan tek şey base URL + API key + model adı.
 */
export interface OpenAICompatibleConfig {
  baseUrl: string
  apiKey?: string
  model: string
  /** Hata mesajlarında sağlayıcının adını göstermek için (örn. "Ollama", "OpenAI"). */
  providerLabel: string
}

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

async function parseErrorBody(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data?.error?.message ?? data?.message ?? JSON.stringify(data)
  } catch {
    return res.statusText
  }
}

function classifyHttpError(status: number, providerLabel: string, bodyMessage: string): AIServiceError {
  if (status === 401 || status === 403) {
    return new AIServiceError(`${providerLabel}: API anahtarı geçersiz veya eksik`, 'auth')
  }
  if (status === 404) {
    return new AIServiceError(`${providerLabel}: model veya uç nokta bulunamadı — ${bodyMessage}`, 'model_not_found')
  }
  if (status === 429) {
    return new AIServiceError(`${providerLabel}: istek limiti aşıldı, biraz sonra tekrar deneyin`, 'rate_limit')
  }
  return new AIServiceError(`${providerLabel} hatası (${status}): ${bodyMessage}`, 'unknown')
}

function classifyNetworkError(err: unknown, providerLabel: string): AIServiceError {
  if (err instanceof AIServiceError) return err
  const message = err instanceof Error ? err.message : String(err)
  return new AIServiceError(
    `${providerLabel}'e bağlanılamadı — çalıştığından ve adresin doğru olduğundan emin olun (${message})`,
    'connection',
    err,
  )
}

export async function openaiCompatibleChat(
  config: OpenAICompatibleConfig,
  messages: AIMessage[],
  options?: AIChatOptions,
): Promise<AIChatResult> {
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(config.apiKey) },
      signal: options?.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      }),
    })
    if (!res.ok) throw classifyHttpError(res.status, config.providerLabel, await parseErrorBody(res))
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new AIServiceError(`${config.providerLabel}: beklenmeyen yanıt biçimi`, 'invalid_response')
    }
    return {
      content,
      promptTokens: data?.usage?.prompt_tokens,
      completionTokens: data?.usage?.completion_tokens,
    }
  } catch (err) {
    throw classifyNetworkError(err, config.providerLabel)
  }
}

export async function openaiCompatibleStreamChat(
  config: OpenAICompatibleConfig,
  messages: AIMessage[],
  onToken: (delta: string) => void,
  options?: AIChatOptions,
): Promise<AIChatResult> {
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(config.apiKey) },
      signal: options?.signal,
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      }),
    })
    if (!res.ok) throw classifyHttpError(res.status, config.providerLabel, await parseErrorBody(res))
    if (!res.body) throw new AIServiceError(`${config.providerLabel}: akış desteklenmiyor`, 'invalid_response')

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
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const delta = json?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) {
            fullContent += delta
            onToken(delta)
          }
          if (json?.usage) {
            promptTokens = json.usage.prompt_tokens
            completionTokens = json.usage.completion_tokens
          }
        } catch {
          // Tek bir SSE parçası bozuksa akışın tamamını iptal etmeye değmez, atla.
        }
      }
    }

    return { content: fullContent, promptTokens, completionTokens }
  } catch (err) {
    throw classifyNetworkError(err, config.providerLabel)
  }
}

export async function openaiCompatibleTestConnection(config: OpenAICompatibleConfig): Promise<AIConnectionTestResult> {
  try {
    const res = await fetch(`${config.baseUrl}/models`, {
      headers: authHeaders(config.apiKey),
    })
    if (!res.ok) {
      const bodyMessage = await parseErrorBody(res)
      return { ok: false, message: classifyHttpError(res.status, config.providerLabel, bodyMessage).message }
    }
    const data = await res.json()
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: { id: string }) => m.id) : []
    const modelAvailable = models.length === 0 ? undefined : models.includes(config.model)
    return {
      ok: true,
      message: `${config.providerLabel} bağlantısı başarılı`,
      modelAvailable,
      availableModels: models,
    }
  } catch (err) {
    return { ok: false, message: classifyNetworkError(err, config.providerLabel).message }
  }
}
