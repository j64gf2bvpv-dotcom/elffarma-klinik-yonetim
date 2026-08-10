// "Ekip Sohbeti" — tek paylaşımlı kanal (supabase/schema.sql "50. EKİP
// SOHBETİ"). Ekler mevcut documents bucket'ının 'chat/' alt yolunu kullanır
// (attachments.ts'teki desenle aynı: decode(base64) + upload).
import { decode } from 'base64-arraybuffer'
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, getCurrentUserId } from '@/lib/offlineMutation'
import type { StaffMessage } from '@shared/types/database'

export interface StaffMessageWithSender extends StaffMessage {
  sender_name: string
}

export async function fetchMessages(limit = 100): Promise<StaffMessageWithSender[]> {
  const { data, error } = await supabase
    .from('staff_messages')
    .select('*, staff:sender_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .map((r) => {
      const row = r as unknown as StaffMessage & { staff?: { full_name: string } | null }
      return { ...row, sender_name: row.staff?.full_name ?? 'Bilinmeyen' }
    })
    .reverse()
}

export interface SendMessageInput {
  body: string | null
  attachmentBase64?: string | null
  attachmentFileName?: string | null
}

export async function sendMessage(input: SendMessageInput): Promise<StaffMessage> {
  const senderId = await getCurrentUserId()
  let attachmentPath: string | null = null
  if (input.attachmentBase64 && input.attachmentFileName) {
    attachmentPath = `chat/${Date.now()}-${input.attachmentFileName}`
    const { error } = await supabase.storage
      .from('documents')
      .upload(attachmentPath, decode(input.attachmentBase64), { contentType: 'image/jpeg' })
    if (error) throw error
  }
  return offlineInsert<StaffMessage>(
    'staff_messages',
    {
      sender_id: senderId,
      body: input.body,
      attachment_path: attachmentPath,
      attachment_name: input.attachmentFileName ?? null,
    },
    'Ekip sohbeti mesajı',
  )
}

export async function getMessageAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
