import * as React from 'react'
import { Bot, Send, Loader2, User, X, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAIService } from './useAIService'
import { useAISettings, useAIConversations, useCreateAIConversation, useAIMessages, useAppendAIMessage } from './hooks'
import { AIServiceError, type AIMessage } from './types'

/**
 * Her sayfada görünen, açılıp kapanabilen yüzen AI sohbet paneli
 * (AppShell'e bir kez eklenir). Konuşma geçmişi ai_conversations/ai_messages
 * üzerinden kalıcıdır — panel kapatılıp açılsa da kaybolmaz.
 */
export function AIChatWidget() {
  const { data: settings } = useAISettings()
  const aiService = useAIService()
  const { data: conversations = [] } = useAIConversations()
  const createConversationMutation = useCreateAIConversation()
  const appendMessageMutation = useAppendAIMessage()

  const [open, setOpen] = React.useState(false)
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
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [storedMessages, streamingText, open])

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId
    const created = await createConversationMutation.mutateAsync({
      title: 'AI Asistan',
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
    <>
      <div
        className={cn(
          'fixed right-6 bottom-6 z-50 flex w-96 max-w-[calc(100vw-3rem)] origin-bottom-right flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl transition-all duration-300 ease-out',
          open ? 'h-[32rem] max-h-[calc(100vh-6rem)] scale-100 opacity-100' : 'h-0 scale-95 opacity-0',
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">AI Asistan</p>
              <p className="text-muted-foreground text-xs">
                {settings.provider} · {settings.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={handleNewConversation} title="Yeni Sohbet">
              <Trash2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)} title="Kapat">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="grid flex-1 gap-2 overflow-y-auto p-3">
          {storedMessages.length === 0 && !streamingText && (
            <p className="text-muted-foreground mt-8 text-center text-sm">
              Merhaba! Bir şey yazıp gönderin, birlikte deneyelim.
            </p>
          )}
          {storedMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex items-start gap-2 rounded-lg p-2 text-sm',
                m.role === 'user' ? 'bg-primary/5' : 'bg-muted/50',
              )}
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

        <div className="flex items-end gap-2 border-t p-3">
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
            rows={1}
            className="max-h-24 min-h-9 resize-none"
            disabled={sending}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !draft.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? 'AI Asistanı kapat' : 'AI Asistanı aç'}
        className={cn(
          'fixed right-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_8px_24px_-6px_var(--color-primary)] transition-all duration-300 ease-out hover:scale-105 active:scale-95',
          open && 'pointer-events-none scale-0 opacity-0',
        )}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        <Sparkles className="relative size-6" />
      </button>
    </>
  )
}
