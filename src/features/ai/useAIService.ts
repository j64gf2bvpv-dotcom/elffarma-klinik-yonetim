import * as React from 'react'
import { AIService } from './AIService'
import { useAISettings, useMyAIKeys } from './hooks'
import { getApiKeyForProvider, personalKeyFieldForProvider } from './config'

/** O anki ayarlara (sağlayıcı/model/base URL) göre yapılandırılmış, bileşen ömrü boyunca stabil bir AIService örneği döner. */
export function useAIService(): AIService {
  const { data: settings } = useAISettings()
  const { data: myKeys } = useMyAIKeys()

  const field = personalKeyFieldForProvider(settings.provider)
  const personalApiKey = field ? myKeys?.[field] : null

  return React.useMemo(
    () =>
      new AIService({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: personalApiKey || getApiKeyForProvider(settings.provider),
      }),
    [settings.provider, settings.baseUrl, settings.model, personalApiKey],
  )
}
