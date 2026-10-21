import { supabase } from '@/lib/supabaseClient'
import { resizeImageFile } from '@/lib/resizeImage'

/**
 * Araç ruhsatı (Araç Tescil Belgesi) — fotoğraf yükleme + yapay zekâ ile okuma
 * (kullanıcı isteği, 2026-10-21: "ruhsatın resmini ekle kısmı olsun, ekleyince
 * bütün bilgiler eklensin"). Fotoğraf private 'documents' bucket'ına küçültülerek
 * yüklenir (ruhsat kişisel veri — public değil, imzalı URL ile gösterilir).
 * Okuma bilgisayarın kendisinde yazı tanımayla yapılır (ruhsatOcr.ts — kullanıcı
 * isteği, 2026-10-21: "gemini kullanmasın, otomatik tanısın"); sonuç forma
 * doldurulur, kullanıcı kontrol edip kaydeder.
 */

export interface RegistrationFields {
  plate_number?: string
  brand_model?: string
  year?: number
  owner_name?: string
  owner_tax_id?: string
  owner_address?: string
  chassis_number?: string
  engine_number?: string
  first_registration_date?: string
  registration_date?: string
  vehicle_class?: string
  vehicle_type?: string
  color?: string
  fuel_type?: string
  engine_capacity?: string
  engine_power?: string
  seat_count?: number
  usage_purpose?: string
  document_serial?: string
  inspection_valid_until?: string
}

export const REGISTRATION_LABELS: Record<keyof RegistrationFields, string> = {
  plate_number: 'Plaka (A)',
  brand_model: 'Marka / Ticari Adı (D.1, D.3)',
  year: 'Model Yılı',
  owner_name: 'Ruhsat Sahibi (C.1)',
  owner_tax_id: 'T.C. Kimlik / Vergi No (Y.1)',
  owner_address: 'Adres (C.1.3)',
  chassis_number: 'Şase No (E)',
  engine_number: 'Motor No (P.5)',
  first_registration_date: 'İlk Tescil Tarihi (B)',
  registration_date: 'Tescil Tarihi (I)',
  vehicle_class: 'Araç Sınıfı (J)',
  vehicle_type: 'Cinsi (D.5)',
  color: 'Rengi (R)',
  fuel_type: 'Yakıt Cinsi (P.3)',
  engine_capacity: 'Silindir Hacmi (P.1)',
  engine_power: 'Motor Gücü (P.2)',
  seat_count: 'Koltuk Sayısı (S.1)',
  usage_purpose: 'Kullanım Amacı (Z.1)',
  document_serial: 'Belge Seri No',
  inspection_valid_until: 'Muayene Geçerlilik Tarihi',
}

export async function uploadRegistrationImage(file: File): Promise<string> {
  // Yazılar okunabilsin diye profil fotoğraflarından daha büyük tutuluyor
  const blob = await resizeImageFile(file, 1800, 0.85)
  const path = `vehicles/ruhsat/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

export async function getRegistrationImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function fileToDataUrl(file: File, maxDimension = 1800): Promise<string> {
  const blob = await resizeImageFile(file, maxDimension, 0.85)
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}
