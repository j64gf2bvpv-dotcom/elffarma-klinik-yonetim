import * as React from 'react'
import { AIService } from './AIService'
import { useAISettings, useMyAIKeys, useSharedAIKeys } from './hooks'
import { getApiKeyForProvider, personalKeyFieldForProvider } from './config'

/**
 * O anki ayarlara (sağlayıcı/model/base URL) göre yapılandırılmış, bileşen
 * ömrü boyunca stabil bir AIService örneği döner. Anahtar sırası: kişisel
 * (staff_ai_keys) → paylaşılan (ai_shared_keys, yönetici tarafından tüm
 * personel için ayarlanmış olabilir) → .env (paket zamanı gömülü). Paylaşılan
 * anahtar eklendi (kullanıcı isteği, 2026-08-25: "yapay zeka kısmı tüm
 * kullanıcılarda çalışmalı hata vermemeli") — önceden kişisel anahtarı
 * olmayan ve .env'de de gerçek bir anahtar bulunmayan bir personel her
 * zaman "API anahtarı geçersiz veya eksik" hatası alıyordu.
 */
export function useAIService(): AIService {
  const { data: settings } = useAISettings()
  const { data: myKeys } = useMyAIKeys()
  const { data: sharedKeys } = useSharedAIKeys()

  const field = personalKeyFieldForProvider(settings.provider)
  const personalApiKey = field ? myKeys?.[field] : null
  const sharedApiKey = field ? sharedKeys?.[field] : null

  return React.useMemo(
    () =>
      new AIService({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: personalApiKey || sharedApiKey || getApiKeyForProvider(settings.provider),
      }),
    [settings.provider, settings.baseUrl, settings.model, personalApiKey, sharedApiKey],
  )
}
