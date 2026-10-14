import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth'
import { cn, getErrorMessage } from '@/lib/utils'
import { useStaffList } from '@/features/staff/hooks'
import { useOnlineStaff } from '@/features/presence/PresenceProvider'
import { fetchConversation, fetchUnreadCounts, markConversationRead, sendDirectMessage } from './api'
import type { StaffMessage } from '@/types/database'

/**
 * Personel arası kişiye özel mesajlaşma (kullanıcı isteği, 2026-10-14:
 * "çevrimiçi personelin üzerine tıklayıp mesaj atabileyim"). AppShell'e bir
 * kez sarılır:
 *  - openChat(staffId) ile herhangi bir yerden sohbet penceresi açılır
 *    (Çevrimiçi Personel kartı bunu kullanır)
 *  - bana gelen her yeni mesaj realtime ile yakalanır; o kişiyle sohbet açık
 *    değilse bildirim (toast + masaüstü bildirimi) çıkar, "Yanıtla" ile açılır
 *  - okunmamış sayıları useStaffChat().unread ile alınır
 */

interface StaffChatContextValue {
  openChat: (staffId: string) => void
  unread: Record<string, number>
}

const StaffChatContext = React.createContext<StaffChatContextValue>({ openChat: () => {}, unread: {} })

export function useStaffChat() {
  return React.useContext(StaffChatContext)
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function StaffChatProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useAuth()
  const me = staff?.id
  const queryClient = useQueryClient()
  const { data: staffList = [] } = useStaffList()
  const [openWith, setOpenWith] = React.useState<string | null>(null)
  const openWithRef = React.useRef<string | null>(null)
  openWithRef.current = openWith

  const { data: unread = {} } = useQuery({
    queryKey: ['staff_messages', 'unread', me],
    queryFn: () => fetchUnreadCounts(me as string),
    enabled: !!me,
  })

  const nameOf = React.useCallback(
    (id: string | null) => staffList.find((s) => s.id === id)?.full_name ?? 'Bir personel',
    [staffList],
  )
  const nameRef = React.useRef(nameOf)
  nameRef.current = nameOf

  // Bana gelen yeni mesajlar — anlık
  React.useEffect(() => {
    if (!me) return
    const channel = supabase
      .channel(`staff-dm-${me}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staff_messages', filter: `recipient_id=eq.${me}` },
        (payload) => {
          const msg = payload.new as StaffMessage
          queryClient.invalidateQueries({ queryKey: ['staff_messages'] })
          if (openWithRef.current === msg.sender_id) return
          const from = nameRef.current(msg.sender_id)
          const preview = (msg.body ?? '').slice(0, 120)
          toast(`${from} size mesaj gönderdi`, {
            description: preview,
            duration: 10000,
            action: msg.sender_id ? { label: 'Yanıtla', onClick: () => setOpenWith(msg.sender_id) } : undefined,
          })
          void window.electronAPI?.notify?.(`${from} — yeni mesaj`, preview)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [me, queryClient])

  const value = React.useMemo(() => ({ openChat: (id: string) => setOpenWith(id), unread }), [unread])

  return (
    <StaffChatContext.Provider value={value}>
      {children}
      {me && openWith && (
        <ChatDialog
          me={me}
          otherId={openWith}
          otherName={nameOf(openWith)}
          otherAvatar={staffList.find((s) => s.id === openWith)?.avatar_url ?? null}
          onClose={() => setOpenWith(null)}
        />
      )}
    </StaffChatContext.Provider>
  )
}

function ChatDialog({
  me,
  otherId,
  otherName,
  otherAvatar,
  onClose,
}: {
  me: string
  otherId: string
  otherName: string
  otherAvatar: string | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const online = useOnlineStaff()
  const isOnline = online.some((o) => o.staff_id === otherId)
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['staff_messages', 'conversation', me, otherId],
    queryFn: () => fetchConversation(me, otherId),
  })
  const [text, setText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Açıkken gelenleri okundu işaretle
  React.useEffect(() => {
    if (messages.some((m) => m.sender_id === otherId && !m.read_at)) {
      markConversationRead(me, otherId)
        .then(() => queryClient.invalidateQueries({ queryKey: ['staff_messages', 'unread', me] }))
        .catch(() => {})
    }
  }, [messages, me, otherId, queryClient])

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await sendDirectMessage(me, otherId, body)
      setText('')
      await queryClient.invalidateQueries({ queryKey: ['staff_messages', 'conversation', me, otherId] })
    } catch (err) {
      toast.error('Mesaj gönderilemedi', { description: getErrorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="relative">
              <Avatar className="size-8">
                {otherAvatar && <AvatarImage src={otherAvatar} alt={otherName} />}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials(otherName)}</AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-[oklch(0.72_0.16_150)]" />
              )}
            </span>
            {otherName}
          </DialogTitle>
          <DialogDescription>{isOnline ? 'Çevrimiçi' : 'Şu an çevrimdışı — mesajı programı açınca görecek'}</DialogDescription>
        </DialogHeader>

        <div ref={listRef} className="flex h-80 flex-col gap-1.5 overflow-y-auto rounded-md border bg-muted/20 p-3">
          {isLoading && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
          {!isLoading && messages.length === 0 && (
            <p className="text-muted-foreground m-auto text-sm">Henüz mesaj yok — ilk mesajı yazın.</p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === me
            const date = new Date(m.created_at)
            return (
              <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words',
                    mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border rounded-bl-sm',
                  )}
                >
                  {m.body}
                </div>
                <span className="text-muted-foreground mt-0.5 px-1 text-[10px]">
                  {format(date, isToday(date) ? 'HH:mm' : 'd MMM HH:mm', { locale: trLocale })}
                  {mine && (m.read_at ? ' · Okundu' : ' · İletildi')}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            autoFocus
            rows={2}
            value={text}
            placeholder="Mesaj yazın… (Enter gönderir, Shift+Enter alt satır)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            className="min-h-0 flex-1 resize-none"
          />
          <Button onClick={() => void send()} disabled={!text.trim() || sending}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Gönder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
