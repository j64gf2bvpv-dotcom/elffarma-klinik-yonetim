import * as React from 'react'
import { Bot, CheckCircle2, XCircle, Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAISettings, useSaveAISettings, useMyAIKeys, useSaveMyAIKeys } from './hooks'
import { providerDefaults, providerLabels, getApiKeyForProvider, personalKeyFieldForProvider } from './config'
import { AIService } from './AIService'
import type { AIProviderId, AIConnectionTestResult } from './types'

export function AIProviderSettings() {
  const { data: settings } = useAISettings()
  const saveMutation = useSaveAISettings()
  const { data: myKeys } = useMyAIKeys()
  const saveKeyMutation = useSaveMyAIKeys()

  const [provider, setProvider] = React.useState<AIProviderId>(settings.provider)
  const [baseUrl, setBaseUrl] = React.useState(settings.baseUrl)
  const [model, setModel] = React.useState(settings.model)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<AIConnectionTestResult | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = React.useState('')

  React.useEffect(() => {
    setProvider(settings.provider)
    setBaseUrl(settings.baseUrl)
    setModel(settings.model)
  }, [settings.provider, settings.baseUrl, settings.model])

  const keyField = personalKeyFieldForProvider(provider)

  React.useEffect(() => {
    setApiKeyDraft((keyField && myKeys?.[keyField]) || '')
  }, [keyField, myKeys])

  function handleProviderChange(next: AIProviderId) {
    setProvider(next)
    setBaseUrl(providerDefaults[next].baseUrl)
    setModel(providerDefaults[next].model)
    setTestResult(null)
  }

  async function handleSave() {
    await saveMutation.mutateAsync({ provider, baseUrl, model })
    toast.success('AI ayarları kaydedildi')
    setTestResult(null)
  }

  async function handleSaveApiKey() {
    if (!keyField) return
    await saveKeyMutation.mutateAsync({ [keyField]: apiKeyDraft.trim() || null })
    toast.success('API anahtarınız kaydedildi — sadece kendi hesabınızda saklanır, diğer personel göremez')
    setTestResult(null)
  }

  const effectiveApiKey = apiKeyDraft.trim() || getApiKeyForProvider(provider)

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const service = new AIService({ provider, baseUrl, model, apiKey: effectiveApiKey })
      const result = await service.testConnection()
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Bilinmeyen hata' })
    } finally {
      setTesting(false)
    }
  }

  const hasApiKey = !!effectiveApiKey
  const keyDirty = apiKeyDraft.trim() !== ((keyField && myKeys?.[keyField]) || '')
  const dirty = provider !== settings.provider || baseUrl !== settings.baseUrl || model !== settings.model

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5">
          <Bot className="size-5" />
        </span>
        <div>
          <CardTitle>Yapay Zeka</CardTitle>
          <CardDescription>
            AI sağlayıcısını, adresini ve modelini yönetin — tüm AI işlemleri buradaki ayara göre tek bir
            AIService üzerinden çalışır. Sohbet etmek için sağ alt köşedeki AI simgesini kullanın.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Sağlayıcı</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProviderId)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(providerLabels) as AIProviderId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {providerLabels[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-model">Model</Label>
            <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="qwen2.5:7b" />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ai-base-url">Base URL</Label>
          <Input
            id="ai-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </div>

        {provider !== 'ollama' && keyField && (
          <div className="grid gap-1.5 rounded-lg border p-3">
            <Label htmlFor="ai-personal-key" className="flex items-center gap-2">
              <KeyRound className="size-3.5" /> Kendi API Anahtarım
            </Label>
            <p className="text-xs text-muted-foreground">
              Buraya girdiğiniz anahtar sadece sizin hesabınıza kaydedilir — diğer personel göremez ve
              paketlenmiş uygulamaya gömülmez. Boş bırakırsanız (varsa) uygulamanın ortak <code>.env</code>{' '}
              anahtarı kullanılır.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="ai-personal-key"
                type="password"
                autoComplete="off"
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                placeholder="API anahtarınızı yapıştırın"
                className="max-w-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveApiKey}
                disabled={!keyDirty || saveKeyMutation.isPending}
              >
                {saveKeyMutation.isPending && <Loader2 className="animate-spin" />}
                Anahtarı Kaydet
              </Button>
            </div>
            <p className="text-xs">
              {hasApiKey ? (
                <span className="text-success">
                  Aktif bir anahtar var ({apiKeyDraft.trim() ? 'kişisel' : '.env (ortak)'}).
                </span>
              ) : (
                <span className="text-destructive">Tanımlı bir anahtar yok.</span>
              )}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="animate-spin" />}
            Kaydet
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
            {testing && <Loader2 className="animate-spin" />}
            Bağlantıyı Test Et
          </Button>
          {testResult && (
            <Badge
              variant="outline"
              className={
                testResult.ok
                  ? 'border-transparent bg-success/15 text-success'
                  : 'border-transparent bg-destructive/15 text-destructive'
              }
            >
              {testResult.ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {testResult.message}
            </Badge>
          )}
        </div>
        {testResult?.availableModels && testResult.availableModels.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Yüklü modeller: {testResult.availableModels.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
