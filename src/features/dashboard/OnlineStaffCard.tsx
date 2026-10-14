import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth'
import { useOnlineStaff } from '@/features/presence/PresenceProvider'
import { MessageCircle, Users } from 'lucide-react'
import { useStaffChat } from '@/features/staffChat/StaffChatProvider'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/**
 * Diğer personelin şu an uygulamayı açık tutup tutmadığını gösterir; bir kişiye
 * tıklayınca onunla kişiye özel sohbet açılır (2026-10-14 — mesajlaşma herkes
 * için olduğundan kart artık tüm kullanıcılara görünür; okunmamış mesaj sayısı
 * rozetle gösterilir).
 */
export function OnlineStaffCard() {
  const { staff } = useAuth()
  const online = useOnlineStaff()
  const others = online.filter((o) => o.staff_id !== staff?.id)
  const { openChat, unread } = useStaffChat()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" /> Çevrimiçi Personel
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {others.length === 0 && <p className="text-muted-foreground text-sm">Şu an başka çevrimiçi personel yok</p>}
        {others.map((o) => (
          <button
            type="button"
            key={o.staff_id}
            onClick={() => openChat(o.staff_id)}
            title={`${o.full_name} ile mesajlaş`}
            className="group flex items-center gap-2.5 rounded-lg border p-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="relative shrink-0">
              <Avatar className="size-8">
                {o.avatar_url && <AvatarImage src={o.avatar_url} alt={o.full_name} />}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials(o.full_name)}</AvatarFallback>
              </Avatar>
              <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-[oklch(0.72_0.16_150)]" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{o.full_name}</span>
            {unread[o.staff_id] ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {unread[o.staff_id]}
              </span>
            ) : null}
            <MessageCircle className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
