import * as React from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/auth'

export interface OnlinePeer {
  staff_id: string
  full_name: string
  avatar_url: string | null
}

const PresenceContext = React.createContext<OnlinePeer[]>([])

const PRESENCE_CHANNEL = 'staff-presence'

/**
 * Admin Ana Panel'de kimin şu an çevrimiçi olduğunu görebilsin diye —
 * AppShell'e (her oturumda bir kez) sarılır, tek bir Supabase Realtime
 * Presence kanalına hem kendi varlığını bildirir (`track`) hem de diğer
 * herkesin durumunu dinler (`presence` `sync` olayı) — iki ayrı hook/kanal
 * yerine tek abonelik, gereksiz ikinci bir bağlantı açmamak için.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useAuth()
  const [online, setOnline] = React.useState<OnlinePeer[]>([])

  React.useEffect(() => {
    if (!staff) {
      setOnline([])
      return
    }

    const channel = supabase.channel(PRESENCE_CHANNEL, { config: { presence: { key: staff.id } } })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<OnlinePeer>()
      // Aynı personel aynı `key` altında birden fazla presence kaydına sahip
      // olabilir (sekme/pencere yeniden bağlanırken eski bağlantı henüz
      // düşmemişken yenisi track edilmesi gibi) — listede aynı kişi iki kez
      // görünmesin diye staff_id başına tek kayda indiriyoruz.
      const byStaffId = new Map<string, OnlinePeer>()
      for (const entries of Object.values(state)) {
        for (const e of entries) byStaffId.set(e.staff_id, { ...e })
      }
      setOnline(Array.from(byStaffId.values()))
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ staff_id: staff.id, full_name: staff.full_name, avatar_url: staff.avatar_url })
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staff?.id, staff?.full_name, staff?.avatar_url])

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>
}

/** Şu an çevrimiçi olan personelin listesi (kendisi dahil). */
export function useOnlineStaff(): OnlinePeer[] {
  return React.useContext(PresenceContext)
}
