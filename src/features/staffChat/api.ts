import { supabase } from '@/lib/supabaseClient'
import type { StaffMessage } from '@/types/database'

/** İki personel arasındaki kişiye özel yazışma, eskiden yeniye. */
export async function fetchConversation(me: string, other: string): Promise<StaffMessage[]> {
  const { data, error } = await supabase
    .from('staff_messages')
    .select('*')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw error
  return data as StaffMessage[]
}

export async function sendDirectMessage(me: string, recipient: string, body: string): Promise<StaffMessage> {
  const { data, error } = await supabase
    .from('staff_messages')
    .insert({ sender_id: me, recipient_id: recipient, body })
    .select()
    .single()
  if (error) throw error
  return data as StaffMessage
}

/** Karşı taraftan gelen okunmamış mesajları okundu işaretler. */
export async function markConversationRead(me: string, other: string): Promise<void> {
  const { error } = await supabase
    .from('staff_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me)
    .eq('sender_id', other)
    .is('read_at', null)
  if (error) throw error
}

/** Bana gelen, okunmamış mesaj sayısı (gönderen bazında). */
export async function fetchUnreadCounts(me: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('staff_messages')
    .select('sender_id')
    .eq('recipient_id', me)
    .is('read_at', null)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = (row as { sender_id: string | null }).sender_id
    if (id) counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}
