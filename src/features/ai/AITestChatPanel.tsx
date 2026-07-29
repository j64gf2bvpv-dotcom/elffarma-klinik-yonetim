import * as React from 'react'
import { Bot, Send, Loader2, User, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAIService } from './useAIService'
import { useAISettings, useAIConversations, useCreateAIConversation, useAIMessages, useAppendAIMessage } from './hooks'
import { AIServiceError, type AIMessage } from './types'

/**
 * AI altyapısının uçtan uca (streaming + kalıcı geçmiş + loglama) gerçekten
 * çalıştığını doğrulamak için minimal bir sohbet paneli. Akıllı arama/rapor
 * gibi asıl AI özellikleri ayrı bir aşamada bu AIService üzerine kurulacak.
 */
export function AITestChatPanel() {
  const { data: settings } = useAISettings()
  const aiService = useAIService()
  const { data: conversations = [] } = useAIConversations()
  const createConversationMutation = useCreateAIConversation()
  const appendMessageMutation = useAppendAIMessage()

  const [conversationId, setConversationId] = React.useState<string | undefined>(undefined)
  const { data: storedMessages = [] } = useAIMessages(conversationId)
  const [draft, setDraft] = React.useState('')
  const [streamingText, setStreamingText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!conversationId && conversations.length > 0) setConversationId(conversations[0].id)
  }, [conversationId, conversations])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [storedMessages, streamingText])

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId
    const created = await createConversationMutation.mutateAsync({
      title: 'AI Test Sohbeti',
      provider: settings.provider,
      model: settings.model,
    })
    setConversationId(created.id)
    return created.id
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    setStreamingText('')

    try {
      const convId = await ensureConversation()
      await appendMessageMutation.mutateAsync({ conversation_id: convId, role: 'user', content: text })

      const history: AIMessage[] = [
        ...storedMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ]

      const result = await aiService.streamChat(history, (delta) => {
        setStreamingText((prev) => prev + delta)
      })

      await appendMessageMutation.mutateAsync({ conversation_id: convId, role: 'assistant', content: result.content })
      setStreamingText('')
    } catch (err) {
      const message = err instanceof AIServiceError ? err.message : 'Beklenmeyen bir hata oluştu'
      toast.error('AI yanıt veremedi', { description: message })
      setStreamingText('')
    } finally {
      setSending(false)
    }
  }

  function handleNewConversation() {
    setConversationId(undefined)
    setStreamingText('')
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5">
            <Bot className="size-5" />
          </span>
          <div>
            <CardTitle>AI Test Sohbeti</CardTitle>
            <CardDescription>
              {settings.provider} · {settings.model} — akışı ve geçmiş kaydını denemek için
            </CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewConversation}>
          <Trash2 className="size-3.5" /> Yeni Sohbet
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div ref={scrollRef} className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border p-3">
          {storedMessages.length === 0 && !streamingText && (
            <p className="text-muted-foreground text-center text-sm">Henüz mesaj yok — bir şey yazıp gönderin.</p>
          )}
          {storedMessages.map((m) => (
            <div
              key={m.id}
              className={cn('flex items-start gap-2 rounded-lg p-2 text-sm', m.role === 'user' ? 'bg-primary/5' : 'bg-muted/50')}
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
                {m.role === 'user' ? <User className="size-3" /> : <Bot className="size-3" />}
              </span>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {streamingText && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="size-3" />
              </span>
              <p className="whitespace-pre-wrap">
                {streamingText}
                <span className="animate-pulse">▍</span>
              </p>
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Bir mesaj yazın..."
            rows={2}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
