import * as React from 'react'
import { Send, Loader2, X, Trash2, Mic, MicOff, Paperclip, Image as ImageIcon, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { extractFileContent } from '@/features/smartImport/extractFileContent'
import { useAIService } from './useAIService'
import { useAIChatOpen } from './useAIChatOpen'
import { useBusinessSnapshot } from './useBusinessSnapshot'
import { snapshotSystemMessage } from './snapshotSystemMessage'
import {
  useAISettings,
  useAIConversations,
  useCreateAIConversation,
  useAIMessages,
  useAppendAIMessage,
  useDeleteAIConversation,
} from './hooks'
import { AIServiceError, type AIMessage, type AIContentPart } from './types'

let aiIconGradientId = 0

// Merkezi bir "çekirdek" düğüm + üç uydu düğümden oluşan soyut bir sinir
// ağı/düğüm motifi — 120° aralıklarla simetrik.
const AI_ICON_CORE = { x: 50, y: 50, r: 15 }
const AI_ICON_NODES = [
  { x: 50, y: 18, r: 8 },
  { x: 77.7, y: 66, r: 8 },
  { x: 22.3, y: 66, r: 8 },
]

/**
 * Arka planı tamamen şeffaf, gradyanlı, soyut bir "sinir ağı düğümü" simgesi
 * — harf/logo değil, birbirine altın tonlu ince çizgilerle bağlı bir
 * çekirdek + üç uydu düğüm. Her düğüm radyal gradyanla camsı/mücevher gibi
 * bir küre hissi verir (üst-solda parlak, alt-sağda koyu), üzerinde küçük
 * bir parlak "glint" var. Düğümlerin arkasında yumuşak, bulanık kırmızı bir
 * "ambient glow" var. `animated` verilirse (a) uydu düğümler çekirdeğin
 * etrafında yavaşça döner, (b) şeklin üzerinden parlak bir ışık huzmesi
 * arada bir (sürekli değil) geçer; verilmezse tamamen sabit durur.
 */
export function AiSparkleIcon({ className, animated = false }: { className?: string; animated?: boolean }) {
  const uid = React.useRef(`ai-orb-${aiIconGradientId++}`).current
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-orb`} cx="32%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#fff1f1" />
          <stop offset="30%" stopColor="#fca5a5" />
          <stop offset="65%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#6b1414" />
        </radialGradient>
        <linearGradient id={`${uid}-wire`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.95" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {/* Dönen uydu düğümlerin konumundan bağımsız, tüm simgeyi kaplayan
            sabit dairesel maske — ışık huzmesi rotasyondan etkilenmeden
            düzgün akar. */}
        <mask id={`${uid}-shapemask`}>
          <rect x="0" y="0" width="100" height="100" fill="black" />
          <circle cx="50" cy="50" r="42" fill="white" />
        </mask>
      </defs>
      <circle cx={AI_ICON_CORE.x} cy={AI_ICON_CORE.y} r={AI_ICON_CORE.r} fill="#ef4444" opacity="0.5" filter={`url(#${uid}-glow)`} />
      <g className={animated ? 'animate-ai-orbit-spin' : undefined} style={{ transformOrigin: '50px 50px' }}>
        <g opacity="0.5" filter={`url(#${uid}-glow)`}>
          {AI_ICON_NODES.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="#ef4444" />
          ))}
        </g>
        {/* soluk "yörünge" halkası — üç uydu düğümü çevreleyen ince altın çember */}
        <circle
          cx={AI_ICON_CORE.x}
          cy={AI_ICON_CORE.y}
          r="32"
          fill="none"
          stroke={`url(#${uid}-wire)`}
          strokeOpacity="0.25"
          strokeWidth="0.75"
          strokeDasharray="2 3"
        />
        {AI_ICON_NODES.map((n, i) => (
          <line
            key={i}
            x1={AI_ICON_CORE.x}
            y1={AI_ICON_CORE.y}
            x2={n.x}
            y2={n.y}
            stroke={`url(#${uid}-wire)`}
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        ))}
        {AI_ICON_NODES.map((n, i) => (
          <React.Fragment key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={`url(#${uid}-orb)`}
              stroke="#450a0a"
              strokeWidth="0.6"
              strokeOpacity="0.35"
            />
            <ellipse cx={n.x - 2.6} cy={n.y - 3} rx={n.r * 0.32} ry={n.r * 0.2} fill="white" opacity="0.65" />
          </React.Fragment>
        ))}
      </g>
      <circle
        cx={AI_ICON_CORE.x}
        cy={AI_ICON_CORE.y}
        r={AI_ICON_CORE.r}
        fill={`url(#${uid}-orb)`}
        stroke="#450a0a"
        strokeWidth="0.6"
        strokeOpacity="0.35"
      />
      <ellipse
        cx={AI_ICON_CORE.x - 5}
        cy={AI_ICON_CORE.y - 6}
        rx={AI_ICON_CORE.r * 0.32}
        ry={AI_ICON_CORE.r * 0.2}
        fill="white"
        opacity="0.65"
      />
      {animated && (
        <rect
          x="-30"
          y="0"
          width="35"
          height="100"
          fill={`url(#${uid}-shine)`}
          mask={`url(#${uid}-shapemask)`}
          className="animate-ai-shine-sweep"
        />
      )}
    </svg>
  )
}

// Panel için nominal boyutlar (w-96 / h-[32rem] ile eşleşir) — yüzen
// tetikleyici düğmenin hemen üstünde, görünür alanın dışına taşmadan
// açılması için konum hesabında kullanılır.
const PANEL_WIDTH = 384
const PANEL_HEIGHT = 512
const PANEL_MARGIN = 12

// Yüzen, sürüklenebilir tetikleyici düğme.
const BUTTON_SIZE = 64
const BUTTON_MARGIN = 24
const BUTTON_POSITION_KEY = 'ai_button_position'
const PANEL_POSITION_KEY = 'ai_panel_position'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function loadPosition(key: string): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') return parsed
  } catch {
    // bozuk kayıt varsa yok say
  }
  return null
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

/**
 * Bir eki (resim/PDF/Word/Excel/CSV/txt) AI'a gönderilecek biçime çevirir —
 * Akıllı İçe Aktar'daki aynı `extractFileContent` mantığı kullanılıyor, bu
 * yüzden taranmış (görsel) PDF'ler de otomatik olarak vision yoluyla okunuyor.
 */
async function attachmentToParts(file: File): Promise<{ text?: string; imageUrls: string[] }> {
  const content = await extractFileContent(file)
  if (content.kind === 'image') return { imageUrls: content.dataUrls }
  if (content.kind === 'table') {
    const preview = content.rows.slice(0, 50)
    return {
      text: `Dosya: ${file.name}\nToplam satır: ${content.rows.length}\n\nÖrnek veri (JSON):\n${JSON.stringify(preview, null, 2)}`,
      imageUrls: [],
    }
  }
  return { text: `Dosya: ${file.name}\n\n${content.text}`, imageUrls: [] }
}

/**
 * Her sayfada görünen, açılıp kapanabilen yüzen AI sohbet paneli
 * (AppShell'e bir kez eklenir). Konuşma geçmişi ai_conversations/ai_messages
 * üzerinden kalıcıdır — panel kapatılıp açılsa da kaybolmaz.
 */
export function AIChatWidget() {
  const { data: settings } = useAISettings()
  const aiService = useAIService()
  const businessSnapshot = useBusinessSnapshot()
  const { data: conversations = [] } = useAIConversations()
  const createConversationMutation = useCreateAIConversation()
  const appendMessageMutation = useAppendAIMessage()
  const deleteConversationMutation = useDeleteAIConversation()

  const [open, setOpen] = useAIChatOpen()
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

  const [viewport, setViewport] = React.useState({ width: window.innerWidth, height: window.innerHeight })
  React.useEffect(() => {
    function handleResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Yüzen tetikleyici düğme varsayılan olarak sağ-alt köşede durur;
  // kullanıcı sürükleyince konum hatırlanır (localStorage).
  const defaultButtonPosition = React.useMemo<{ left: number; top: number }>(
    () => ({
      left: clamp(viewport.width - BUTTON_SIZE - BUTTON_MARGIN, BUTTON_MARGIN, viewport.width - BUTTON_SIZE - BUTTON_MARGIN),
      top: clamp(viewport.height - BUTTON_SIZE - BUTTON_MARGIN, BUTTON_MARGIN, viewport.height - BUTTON_SIZE - BUTTON_MARGIN),
    }),
    [viewport],
  )

  const [buttonOffset, setButtonOffset] = React.useState<{ left: number; top: number } | null>(() =>
    loadPosition(BUTTON_POSITION_KEY),
  )
  const buttonDragStateRef = React.useRef<{
    startX: number
    startY: number
    startLeft: number
    startTop: number
    moved: boolean
  } | null>(null)
  const [buttonDragging, setButtonDragging] = React.useState(false)

  React.useEffect(() => {
    if (buttonOffset) localStorage.setItem(BUTTON_POSITION_KEY, JSON.stringify(buttonOffset))
  }, [buttonOffset])

  const buttonStyle = React.useMemo<React.CSSProperties>(() => {
    const base = buttonOffset ?? defaultButtonPosition
    return {
      left: clamp(base.left, BUTTON_MARGIN, viewport.width - BUTTON_SIZE - BUTTON_MARGIN),
      top: clamp(base.top, BUTTON_MARGIN, viewport.height - BUTTON_SIZE - BUTTON_MARGIN),
    }
  }, [buttonOffset, defaultButtonPosition, viewport])

  function handleButtonPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const current = buttonOffset ?? defaultButtonPosition
    buttonDragStateRef.current = { startX: e.clientX, startY: e.clientY, startLeft: current.left, startTop: current.top, moved: false }
  }

  function handleButtonPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = buttonDragStateRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      drag.moved = true
      setButtonDragging(true)
    }
    if (!drag.moved) return
    setButtonOffset({
      left: clamp(drag.startLeft + dx, BUTTON_MARGIN, window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN),
      top: clamp(drag.startTop + dy, BUTTON_MARGIN, window.innerHeight - BUTTON_SIZE - BUTTON_MARGIN),
    })
  }

  function handleButtonPointerUp() {
    const drag = buttonDragStateRef.current
    buttonDragStateRef.current = null
    setButtonDragging(false)
    if (!drag?.moved) setOpen((v) => !v)
  }

  // Panel varsayılan olarak yüzen düğmenin hemen üstünde, sağa yaslı açılır.
  // Kullanıcı paneli kendi sürüklediğinde bu varsayılan yerine panelOffset
  // kullanılır ve konum hatırlanır.
  const defaultPanelPosition = React.useMemo<{ left: number; top: number }>(() => {
    const buttonPos = buttonOffset ?? defaultButtonPosition
    const left = clamp(
      buttonPos.left + BUTTON_SIZE - PANEL_WIDTH,
      PANEL_MARGIN,
      viewport.width - PANEL_WIDTH - PANEL_MARGIN,
    )
    const top = clamp(buttonPos.top - PANEL_HEIGHT - 12, PANEL_MARGIN, viewport.height - PANEL_HEIGHT - PANEL_MARGIN)
    return { left, top }
  }, [viewport, buttonOffset, defaultButtonPosition])

  const [panelOffset, setPanelOffset] = React.useState<{ left: number; top: number } | null>(() =>
    loadPosition(PANEL_POSITION_KEY),
  )
  const panelDragStateRef = React.useRef<{
    startX: number
    startY: number
    startLeft: number
    startTop: number
    moved: boolean
  } | null>(null)
  // Sürükleme sırasında true — panelin konum geçişini (transition) anlık
  // takip etsin diye kapatmak (aksi halde 300ms'lik ease imleci "kovalar"
  // gibi gecikmeli/doğal olmayan bir his verir) ve sürüklenirken hafif
  // şeffaflaşma göstermek için kullanılıyor.
  const [panelDragging, setPanelDragging] = React.useState(false)

  React.useEffect(() => {
    if (panelOffset) localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(panelOffset))
  }, [panelOffset])

  const panelStyle = React.useMemo<React.CSSProperties>(() => {
    const base = panelOffset ?? defaultPanelPosition
    return {
      left: clamp(base.left, PANEL_MARGIN, viewport.width - PANEL_WIDTH - PANEL_MARGIN),
      top: clamp(base.top, PANEL_MARGIN, viewport.height - PANEL_HEIGHT - PANEL_MARGIN),
    }
  }, [panelOffset, defaultPanelPosition, viewport])

  function handlePanelPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const current = panelOffset ?? defaultPanelPosition
    panelDragStateRef.current = { startX: e.clientX, startY: e.clientY, startLeft: current.left, startTop: current.top, moved: false }
  }

  function handlePanelPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = panelDragStateRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      drag.moved = true
      setPanelDragging(true)
    }
    if (!drag.moved) return
    setPanelOffset({
      left: clamp(drag.startLeft + dx, PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN),
      top: clamp(drag.startTop + dy, PANEL_MARGIN, window.innerHeight - PANEL_HEIGHT - PANEL_MARGIN),
    })
  }

  function handlePanelPointerUp() {
    panelDragStateRef.current = null
    setPanelDragging(false)
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
      } else if (/\.(xlsx|xls|csv|txt|pdf|docx)$/i.test(file.name)) {
        next.push({ file, kind: 'document' })
      } else {
        toast.error(`${file.name}: desteklenmeyen dosya türü — resim, PDF, Word (.docx) veya Excel/CSV/txt eklenebilir`)
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
        try {
          const { text, imageUrls } = await attachmentToParts(att.file)
          if (text) documentTexts.push(text)
          if (imageUrls.length > 0) {
            for (const url of imageUrls) imageParts.push({ type: 'image_url', image_url: { url } })
            hadImages = true
          }
          fileNotes.push(`${att.file.name} (${imageUrls.length > 0 ? 'görsel' : 'belge'})`)
        } catch {
          toast.error(`${att.file.name} okunamadı`)
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
        snapshotSystemMessage(businessSnapshot),
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

  return (
    <>
      <button
        type="button"
        onPointerDown={handleButtonPointerDown}
        onPointerMove={handleButtonPointerMove}
        onPointerUp={handleButtonPointerUp}
        title="Yapay Zeka Asistanı — sürükleyerek taşıyabilirsiniz"
        className={cn(
          'fixed z-50 flex touch-none items-center justify-center rounded-2xl border bg-popover/95 text-popover-foreground shadow-2xl ring-1 ring-black/5 backdrop-blur-xl select-none',
          buttonDragging ? 'cursor-grabbing' : 'cursor-grab',
          !buttonDragging && 'animate-ai-button-float',
        )}
        style={{ ...buttonStyle, width: BUTTON_SIZE, height: BUTTON_SIZE }}
      >
        <AiSparkleIcon className="size-9" animated />
      </button>

      <div
        className={cn(
          'fixed z-50 flex w-96 max-w-[calc(100vw-3rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/5',
          panelDragging ? '' : 'transition-all duration-300 ease-out',
          open ? 'h-[32rem] max-h-[calc(100vh-6rem)] scale-100 opacity-100' : 'h-0 scale-95 opacity-0',
          panelDragging && 'opacity-70',
        )}
        style={panelStyle}
        aria-hidden={!open}
      >
        <div
          className="flex cursor-grab items-center justify-between border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 shadow-sm touch-none select-none active:cursor-grabbing"
          onPointerDown={handlePanelPointerDown}
          onPointerMove={handlePanelPointerMove}
          onPointerUp={handlePanelPointerUp}
          title="Sürükleyerek taşıyabilirsiniz"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full">
              <AiSparkleIcon className="size-5" animated />
            </span>
            <div>
              <p className="text-sm font-semibold">AI Asistan</p>
              <p className="text-muted-foreground text-xs">
                {settings.provider} · {settings.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={handleDeleteConversation} title="Sohbeti Sil">
              <Trash2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => setOpen(false)} title="Kapat">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="grid flex-1 auto-rows-min gap-4 overflow-y-auto p-4">
          {storedMessages.length === 0 && !streamingText && !sending && (
            <div className="mt-10 flex flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full">
                <AiSparkleIcon className="size-7" animated />
              </span>
              <p className="text-muted-foreground text-sm">
                Merhaba! Bir şey yazıp gönderin, birlikte deneyelim.
              </p>
            </div>
          )}
          {storedMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'animate-in fade-in slide-in-from-bottom-1 flex gap-2 text-sm duration-300',
                m.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {m.role === 'assistant' && (
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                  <AiSparkleIcon className="size-4" animated />
                </span>
              )}
              <p
                className={cn(
                  'max-w-[85%] leading-relaxed whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm'
                    : 'px-0 py-0.5 text-foreground/90',
                )}
              >
                {m.content}
              </p>
            </div>
          ))}
          {sending && !streamingText && (
            <div className="animate-in fade-in flex items-start gap-2 text-sm duration-200">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                <AiSparkleIcon className="size-4" animated />
              </span>
              <div className="flex items-center gap-1 rounded-2xl bg-muted/60 px-3.5 py-3">
                <span className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                <span className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                <span className="bg-muted-foreground/50 size-1.5 animate-bounce rounded-full" />
              </div>
            </div>
          )}
          {streamingText && (
            <div className="animate-in fade-in flex items-start gap-2 text-sm duration-200">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                <AiSparkleIcon className="size-4" animated />
              </span>
              <p className="leading-relaxed px-0 py-0.5 whitespace-pre-wrap text-foreground/90">
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

        <div className="border-t p-2.5">
          <div className="flex items-end gap-1 rounded-3xl border bg-muted/30 pr-1 pl-1 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary/30">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.xlsx,.xls,.csv,.txt,.pdf,.docx"
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
              className="max-h-24 min-h-9 resize-none border-0 bg-transparent py-2.5 shadow-none focus-visible:ring-0"
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
      </div>

    </>
  )
}
