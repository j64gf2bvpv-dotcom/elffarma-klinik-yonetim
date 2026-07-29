import * as React from 'react'
import { AIService } from './AIService'
import { useAISettings } from './hooks'
import { getApiKeyForProvider } from './config'

/** O anki ayarlara (sağlayıcı/model/base URL) göre yapılandırılmış, bileşen ömrü boyunca stabil bir AIService örneği döner. */
export function useAIService(): AIService {
  const { data: settings } = useAISettings()

  return React.useMemo(
    () =>
      new AIService({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: getApiKeyForProvider(settings.provider),
      }),
    [settings.provider, settings.baseUrl, settings.model],
  )
}
