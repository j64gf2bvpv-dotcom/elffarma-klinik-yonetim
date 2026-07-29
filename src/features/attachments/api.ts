import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Attachment, AttachmentOwnerType } from '@/types/database'

export async function fetchAttachments(ownerType: AttachmentOwnerType, ownerId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Attachment[]
}

export async function uploadAttachment(
  ownerType: AttachmentOwnerType,
  ownerId: string,
  file: File,
): Promise<Attachment> {
  const path = `${ownerType}/${ownerId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const uploadedBy = await getCurrentUserId()
  return offlineInsert<Attachment>(
    'attachments',
    {
      owner_type: ownerType,
      owner_id: ownerId,
      file_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    },
    `Belge: ${file.name}`,
  )
}

export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function deleteAttachment(id: string, filePath: string): Promise<void> {
  await supabase.storage.from('documents').remove([filePath])
  return offlineDelete('attachments', id, 'Belge silme')
}
