// Masaüstündeki src/features/attachments/api.ts'in mobil karşılığı — aynı
// attachments tablosu + documents bucket (private, auth.uid()-gated), şema
// değişikliği yok. Masaüstü File nesnesiyle yüklüyor (tarayıcı-only); mobilde
// expo-image-picker'ın base64 çıktısı base64-arraybuffer ile çözülüp
// yükleniyor (bkz. lib/uploadImage.ts'teki aynı desen, profile-images'tan
// farkı: documents private bucket olduğu için görüntülemek imzalı URL ister).
import { decode } from 'base64-arraybuffer'
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Attachment, AttachmentOwnerType } from '@shared/types/database'

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
  fileName: string,
  base64: string,
  contentType = 'image/jpeg',
): Promise<Attachment> {
  const path = `${ownerType}/${ownerId}/${Date.now()}-${fileName}`
  const { error: uploadError } = await supabase.storage.from('documents').upload(path, decode(base64), { contentType, upsert: true })
  if (uploadError) throw uploadError

  const uploadedBy = await getCurrentUserId()
  return offlineInsert<Attachment>(
    'attachments',
    {
      owner_type: ownerType,
      owner_id: ownerId,
      file_path: path,
      file_name: fileName,
      uploaded_by: uploadedBy,
    },
    `Belge: ${fileName}`,
  )
}

/** Stok listesindeki her ürün satırı için ayrı sorgu atmamak üzere — hangi
 * ürünlerin en az bir belgesi (PDF/katalog) var, tek sorguda öğrenilir. */
export async function fetchProductIdsWithAttachments(): Promise<string[]> {
  const { data, error } = await supabase.from('attachments').select('owner_id').eq('owner_type', 'product')
  if (error) throw error
  return [...new Set((data as { owner_id: string }[]).map((r) => r.owner_id))]
}

/** "Dökümanlar" ekranı — her ürüne tek tek girmeden, admin'in ürünlere
 * eklediği TÜM broşür/katalog belgelerini tek listede göstermek için
 * (kullanıcı isteği, 2026-08-17). `attachments` polimorfik olduğundan
 * (owner_id herhangi bir tabloya işaret edebiliyor) gerçek bir FK/join
 * yok — ürün adı, hooks katmanında `useProducts` ile ayrıca eşleştiriliyor. */
export async function fetchAllProductAttachments(): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('owner_type', 'product')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Attachment[]
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
