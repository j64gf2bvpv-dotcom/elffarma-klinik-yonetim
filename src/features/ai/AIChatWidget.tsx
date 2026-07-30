import * as React from 'react'
import { Send, Loader2, X, Trash2, Mic, MicOff, Paperclip, Image as ImageIcon, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { readExcelFile } from '@/lib/importData'
import { useAIService } from './useAIService'
import { useAIWidgetVisibility } from './useAIWidgetVisibility'
import {
  useAISettings,
  useAIConversations,
  useCreateAIConversation,
  useAIMessages,
  useAppendAIMessage,
  useDeleteAIConversation,
} from './hooks'
import { AIServiceError, type AIMessage, type AIContentPart } from './types'

// lucide'nin genel "sparkle" (dört uçlu parıltı) şekli — CSS mask olarak kullanmak için data URI.
const SPARKLE_MASK_URL =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/></svg>',
  ) +
  '")'

/**
 * Dört uçlu bir parıltı simgesi — Google'ın Gemini logosu/asset dosyası
 * kullanılmadan (telif/marka), uygulamanın kendi tema renkleriyle (primary/
 * gold/accent) dolduruluyor ve hafif bir ışık kayması ile canlandırılıyor —
 * böylece hangi marka teması seçili olursa olsun panelle uyumlu kalıyor.
 */
function AiSparkleIcon({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block bg-[linear-gradient(120deg,var(--color-primary),var(--color-gold),var(--color-accent),var(--color-gold),var(--color-primary))]',
        animated && 'animate-ai-orb-shimmer',
        className,
      )}
      style={{
        WebkitMaskImage: SPARKLE_MASK_URL,
        maskImage: SPARKLE_MASK_URL,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        backgroundSize: '200% 200%',
      }}
    />
  )
}

const WIDGET_BUTTON_SIZE = 56
const WIDGET_OFFSET_KEY = 'ai_widget_offset'
const DEFAULT_OFFSET = { right: 24, bottom: 24 }
// Panel için nominal boyutlar (w-96 / h-[32rem] ile eşleşir) — simge ekranın
// neresine sürüklenirse sürüklensin panelin görünür alanın dışına taşmaması
// için konum hesabında kullanılır.
const PANEL_WIDTH = 384
const PANEL_HEIGHT = 512
const PANEL_MARGIN = 12

function loadOffset(): { right: number; bottom: number } {
  try {
    const raw = localStorage.getItem(WIDGET_OFFSET_KEY)
    if (!raw) return DEFAULT_OFFSET
    const parsed = JSON.parse(raw)
    if (typeof parsed?.right === 'number' && typeof parsed?.bottom === 'number') return parsed
  } catch {
    // bozuk kayıt varsa varsayılana düş
  }
  return DEFAULT_OFFSET
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } } & { length: number }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface PendingAttachment {
  file: File
  kind: 'image' | 'document'
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })
}

async function documentToText(file: File): Promise<string> {
  if (/\.txt$/i.test(file.name)) {
    return `Dosya: ${file.name}\n\n${await file.text()}`
  }
  const rows = await readExcelFile(file)
  const preview = rows.slice(0, 50)
  return `Dosya: ${file.name}\nToplam satır: ${rows.length}\n\nÖrnek veri (JSON):\n${JSON.stringify(preview, null, 2)}`
}

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
  const deleteConversationMutation = useDeleteAIConversation()

  const [open, setOpen] = React.useState(false)
  const [conversationId, setConversationId] = React.useState<string | undefined>(undefined)
  const { data: storedMessages = [] } = useAIMessages(conversationId)
  const [draft, setDraft] = React.useState('')
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([])
  const [streamingText, setStreamingText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [listening, setListening] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const hasAutoSelectedRef = React.useRef(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const speechSupported = React.useMemo(() => getSpeechRecognition() !== null, [])

  const { hidden, setHidden } = useAIWidgetVisibility()
  const [offset, setOffset] = React.useState(loadOffset)
  const dragStateRef = React.useRef<{
    startX: number
    startY: number
    startRight: number
    startBottom: number
    moved: boolean
  } | null>(null)

  React.useEffect(() => {
    // Ekran/pencere boyutu değiştiyse (örn. farklı bir monitöre geçildiyse) simge
    // görünür alanın dışında kalmasın diye tekrar sınırlar içine çekilir.
    setOffset((prev) => ({
      right: clamp(prev.right, 8, window.innerWidth - WIDGET_BUTTON_SIZE - 8),
      bottom: clamp(prev.bottom, 8, window.innerHeight - WIDGET_BUTTON_SIZE - 8),
    }))
  }, [])

  React.useEffect(() => {
    localStorage.setItem(WIDGET_OFFSET_KEY, JSON.stringify(offset))
  }, [offset])

  const [viewport, setViewport] = React.useState({ width: window.innerWidth, height: window.innerHeight })
  React.useEffect(() => {
    function handleResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const anchorStyle: React.CSSProperties = { right: offset.right, bottom: offset.bottom }

  // Panel her zaman görünür alanın (pencerenin) içinde kalsın diye kendi konumu
  // simgenin konumundan ayrı hesaplanır — simge ekranın neresine sürüklenirse
  // sürüklensin (üst kenar, sol kenar vb.) panel taşmadan açılır/kapanır.
  const panelStyle = React.useMemo<React.CSSProperties>(() => {
    const buttonLeft = viewport.width - offset.right - WIDGET_BUTTON_SIZE
    const buttonTop = viewport.height - offset.bottom - WIDGET_BUTTON_SIZE
    const buttonRight = buttonLeft + WIDGET_BUTTON_SIZE
    const buttonBottom = buttonTop + WIDGET_BUTTON_SIZE

    let left = buttonRight - PANEL_WIDTH
    let top = buttonTop - PANEL_HEIGHT - 8
    if (top < PANEL_MARGIN) {
      top = Math.min(buttonBottom + 8, viewport.height - PANEL_HEIGHT - PANEL_MARGIN)
    }

    left = clamp(left, PANEL_MARGIN, viewport.width - PANEL_WIDTH - PANEL_MARGIN)
    top = clamp(top, PANEL_MARGIN, viewport.height - PANEL_HEIGHT - PANEL_MARGIN)

    return { left, top }
  }, [offset, viewport])

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, startRight: offset.right, startBottom: offset.bottom, moved: false }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true
    if (!drag.moved) return
    setOffset({
      right: clamp(drag.startRight - dx, 8, window.innerWidth - WIDGET_BUTTON_SIZE - 8),
      bottom: clamp(drag.startBottom - dy, 8, window.innerHeight - WIDGET_BUTTON_SIZE - 8),
    })
  }

  function handlePointerUp() {
    const drag = dragStateRef.current
    dragStateRef.current = null
    if (drag?.moved) return
    setOpen((v) => !v)
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) {
      toast.error('Bu tarayıcı sesli girişi desteklemiyor')
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'tr-TR'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript
      setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const next: PendingAttachment[] = []
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} çok büyük — en fazla 8MB olabilir`)
        continue
      }
      if (file.type.startsWith('image/')) {
        next.push({ file, kind: 'image' })
      } else if (/\.(xlsx|xls|csv|txt)$/i.test(file.name)) {
        next.push({ file, kind: 'document' })
      } else {
        toast.error(`${file.name}: desteklenmeyen dosya türü — sadece resim ve Excel/CSV/txt eklenebilir`)
      }
    }
    setAttachments((prev) => [...prev, ...next])
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  React.useEffect(() => {
    // Sadece ilk açılışta son konuşmayı otomatik geri yükle — "Yeni Sohbet"
    // conversationId'yi bilerek undefined yaptığında burada tekrar en son
    // konuşmaya sıçramamalı (bu, "silinmiyor" gibi görünen asıl hataydı).
    if (hasAutoSelectedRef.current) return
    if (conversations.length === 0) return
    hasAutoSelectedRef.current = true
    setConversationId(conversations[0].id)
  }, [conversations])

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
    const currentAttachments = attachments
    if ((!text && currentAttachments.length === 0) || sending) return
    setSending(true)
    setDraft('')
    setAttachments([])
    setStreamingText('')

    let hadImages = false
    try {
      const convId = await ensureConversation()

      const documentTexts: string[] = []
      const imageParts: AIContentPart[] = []
      const fileNotes: string[] = []
      for (const att of currentAttachments) {
        if (att.kind === 'document') {
          try {
            documentTexts.push(await documentToText(att.file))
            fileNotes.push(`${att.file.name} (belge)`)
          } catch {
            toast.error(`${att.file.name} okunamadı`)
          }
        } else {
          try {
            const dataUrl = await fileToDataUrl(att.file)
            imageParts.push({ type: 'image_url', image_url: { url: dataUrl } })
            fileNotes.push(`${att.file.name} (resim)`)
            hadImages = true
          } catch {
            toast.error(`${att.file.name} okunamadı`)
          }
        }
      }

      const persistedText = [text, ...documentTexts, fileNotes.length > 0 ? `[Ekler: ${fileNotes.join(', ')}]` : '']
        .filter(Boolean)
        .join('\n\n')
      await appendMessageMutation.mutateAsync({ conversation_id: convId, role: 'user', content: persistedText })

      const userTextPart = [text, ...documentTexts].filter(Boolean).join('\n\n') || '(dosya gönderildi)'
      const currentUserMessage: AIMessage =
        imageParts.length > 0
          ? { role: 'user', content: [{ type: 'text', text: userTextPart }, ...imageParts] }
          : { role: 'user', content: userTextPart }

      const history: AIMessage[] = [
        {
          role: 'system',
          content: 'Sadece Türkçe yanıt ver. Başka bir dilde (Çince, İngilizce vb.) tek kelime bile yazma.',
        },
        ...storedMessages.map((m) => ({ role: m.role, content: m.content })),
        currentUserMessage,
      ]

      const result = await aiService.streamChat(history, (delta) => {
        setStreamingText((prev) => prev + delta)
      })

      await appendMessageMutation.mutateAsync({ conversation_id: convId, role: 'assistant', content: result.content })
      setStreamingText('')
    } catch (err) {
      const message = err instanceof AIServiceError ? err.message : 'Beklenmeyen bir hata oluştu'
      const hint =
        hadImages && settings.provider === 'ollama'
          ? ' (Yerel Ollama modeli resim analiz edemeyebilir — Gemini/OpenAI/Claude gibi bir bulut sağlayıcıya geçmeyi deneyin.)'
          : ''
      toast.error('AI yanıt veremedi', { description: message + hint })
      setStreamingText('')
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteConversation() {
    setStreamingText('')
    if (conversationId) {
      await deleteConversationMutation.mutateAsync(conversationId)
    }
    setConversationId(undefined)
  }

  if (hidden) return null

  return (
    <>
      <div
        className={cn(
          'fixed z-50 flex w-96 max-w-[calc(100vw-3rem)] origin-bottom-right flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl transition-all duration-300 ease-out',
          open ? 'h-[32rem] max-h-[calc(100vh-6rem)] scale-100 opacity-100' : 'h-0 scale-95 opacity-0',
        )}
        style={panelStyle}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-black/5">
              <AiSparkleIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">AI Asistan</p>
              <p className="text-muted-foreground text-xs">
                {settings.provider} · {settings.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={handleDeleteConversation} title="Sohbeti Sil">
              <Trash2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)} title="Kapat">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="grid flex-1 gap-3 overflow-y-auto p-4">
          {storedMessages.length === 0 && !streamingText && (
            <p className="text-muted-foreground mt-8 text-center text-sm">
              Merhaba! Bir şey yazıp gönderin, birlikte deneyelim.
            </p>
          )}
          {storedMessages.map((m) => (
            <div key={m.id} className={cn('flex gap-2 text-sm', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-black/5">
                  <AiSparkleIcon className="size-4" />
                </span>
              )}
              <p
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap',
                  m.role === 'user' ? 'rounded-2xl rounded-br-sm bg-primary/10 px-3 py-2' : 'px-0 py-0.5',
                )}
              >
                {m.content}
              </p>
            </div>
          ))}
          {streamingText && (
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-black/5">
                <AiSparkleIcon className="size-4" />
              </span>
              <p className="whitespace-pre-wrap px-0 py-0.5">
                {streamingText}
                <span className="animate-pulse">▍</span>
              </p>
            </div>
          )}
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t px-3 pt-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1 rounded-full border bg-muted/40 py-1 pr-1.5 pl-2 text-xs">
                {att.kind === 'image' ? (
                  <ImageIcon className="size-3 shrink-0" />
                ) : (
                  <FileSpreadsheet className="size-3 shrink-0" />
                )}
                <span className="max-w-[7rem] truncate">{att.file.name}</span>
                <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5 border-t p-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={() => fileInputRef.current?.click()}
            title="Dosya/resim ekle"
            type="button"
          >
            <Paperclip className="size-4" />
          </Button>
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
            className="max-h-24 min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            disabled={sending}
          />
          {speechSupported && (
            <Button
              size="icon"
              variant={listening ? 'destructive' : 'ghost'}
              className="rounded-full"
              onClick={toggleListening}
              title={listening ? 'Dinlemeyi durdur' : 'Sesli giriş'}
              type="button"
            >
              {listening ? <MicOff /> : <Mic />}
            </Button>
          )}
          <Button
            size="icon"
            className="rounded-full"
            onClick={handleSend}
            disabled={sending || (!draft.trim() && attachments.length === 0)}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </div>

      <div className="group fixed z-50" style={{ ...anchorStyle, touchAction: 'none' }}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          title={open ? 'AI Asistanı kapat' : 'AI Asistanı aç (sürükleyerek taşıyabilirsiniz)'}
          className={cn(
            'relative flex size-14 cursor-grab items-center justify-center rounded-2xl bg-background shadow-lg ring-1 ring-black/10 transition-all duration-300 ease-out select-none hover:scale-105 active:cursor-grabbing active:scale-95',
            open && 'pointer-events-none scale-0 opacity-0',
          )}
        >
          <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/15" />
          <AiSparkleIcon className="relative z-10 size-8" animated />
        </button>
        {!open && (
          <button
            type="button"
            onClick={() => setHidden(true)}
            title="AI Asistan simgesini ana ekrandan gizle (Ayarlar > Yapay Zeka'dan geri açabilirsiniz)"
            className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </>
  )
}
