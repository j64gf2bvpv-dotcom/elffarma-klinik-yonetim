import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete } from '@/lib/offlineMutation'
import { resizeImageFile } from '@/lib/resizeImage'
import type { SalesRep } from '@/types/database'

export async function fetchSalesReps(): Promise<SalesRep[]> {
  const { data, error } = await supabase.from('sales_reps').select('*').order('name')
  if (error) throw error
  return data as SalesRep[]
}

export async function createSalesRep(name: string): Promise<SalesRep> {
  return offlineInsert<SalesRep>('sales_reps', { name }, `Satış temsilcisi: ${name}`)
}

export interface SalesRepUpdateInput {
  name?: string
  photo_url?: string | null
  /** Aylık satış hedefi (TL) — Personel Satış Raporu'ndaki Hedef ve Prim bölümünde kullanılır. */
  sales_target?: number | null
  /** Prim oranı (%) — hak edilen prim, dönemin net cirosunun bu yüzdesi olarak hesaplanır. */
  commission_rate?: number | null
}

export async function updateSalesRep(id: string, input: SalesRepUpdateInput): Promise<SalesRep> {
  return offlineUpdate<SalesRep>('sales_reps', id, { ...input }, 'Satış temsilcisi güncelleme')
}

/**
 * profile-images bucket'ı PUBLIC (bkz. congresses/api.ts uploadCongressImage
 * ile aynı bucket, farklı path prefix'i) — temsilci fotoğrafı gizli belge
 * değil, kalıcı bir public URL alınıp sales_reps.photo_url'e yazılıyor.
 * Yüklenen fotoğraf, çözünürlüğü/boyutu ne olursa olsun önce
 * resizeImageFile ile küçük bir JPEG'e indirgeniyor.
 */
export async function uploadSalesRepPhoto(file: File): Promise<string> {
  const resized = await resizeImageFile(file)
  const path = `sales-rep/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('profile-images').upload(path, resized, {
    contentType: 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from('profile-images').getPublicUrl(path)
  return data.publicUrl
}

export async function setSalesRepActive(id: string, is_active: boolean): Promise<void> {
  await offlineUpdate('sales_reps', id, { is_active }, 'Satış temsilcisi durumu güncelleme')
}

export async function deleteSalesRep(id: string): Promise<void> {
  return offlineDelete('sales_reps', id, 'Satış temsilcisi silme')
}
