// Supabase Storage'a Expo ImagePicker'ın base64 çıktısını yükleyen ortak
// yardımcı — RN'de Blob/File yok, resmi doğrudan ArrayBuffer'a çözüp
// yüklemek Supabase'in Expo için önerdiği yöntem (bkz. profile-images
// bucket, public=true, schema.sql "48. PERSONEL KENDİ PROFİLİNİ...").
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabaseClient'

export async function uploadBase64Image(bucket: string, path: string, base64: string, contentType = 'image/jpeg'): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, decode(base64), { contentType, upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
