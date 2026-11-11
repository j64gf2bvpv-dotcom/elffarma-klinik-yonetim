import { supabase } from '@/lib/supabaseClient'
import { resizeImageFile } from '@/lib/resizeImage'
import { bytesToBase64 } from '@/lib/ensureReadableImage'

/**
 * documents bucket'ındaki fatura/fiş ekleri (Giderler bölümleri ve Faturalar, 2026-11-11):
 * resimler okunur boyutta JPEG'e çevrilir, PDF'ler olduğu gibi saklanır.
 */
export const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

export function isPdfPath(path: string) {
  return /\.pdf$/i.test(path)
}

export async function uploadDocumentAttachment(file: File, folder: string): Promise<string> {
  const pdf = isPdfFile(file)
  const body: Blob = pdf ? file : await resizeImageFile(file, 2200, 0.85)
  const path = `${folder}/${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`
  const { error } = await supabase.storage.from('documents').upload(path, body, { contentType: pdf ? 'application/pdf' : 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

export async function downloadDocument(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from('documents').download(path)
  if (error) throw error
  return data
}

export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function removeDocuments(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from('documents').remove(paths)
}

/** Bilgisayarın kendi programında aç (resim → resim programı, PDF → PDF görüntüleyici). */
export async function openDocument(path: string, title: string): Promise<void> {
  const blob = await downloadDocument(path)
  const open = window.electronAPI?.openImageFile
  if (!open) {
    window.open(URL.createObjectURL(blob), '_blank')
    return
  }
  const ok = await open(bytesToBase64(new Uint8Array(await blob.arrayBuffer())), title)
  if (!ok) throw new Error('Dosya açılamadı')
}
