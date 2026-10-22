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
  issued_place?: string
  registration_sequence_no?: string
  model_type?: string
  net_weight?: string
  max_laden_weight?: string
  train_weight?: string
  trailer_max_weight?: string
  standing_capacity?: string
  power_weight_ratio?: string
  type_approval_no?: string
  rights_holders?: string
  notary_sale_date?: string
  notary_sale_no?: string
  notary_name?: string
  other_info?: string
}

export const REGISTRATION_LABELS: Record<keyof RegistrationFields, string> = {
  issued_place: 'Verildiği İl / İlçe (Y.1)',
  plate_number: 'Plaka (A)',
  first_registration_date: 'İlk Tescil Tarihi (B)',
  registration_sequence_no: 'Tescil Sıra No (Y.2)',
  registration_date: 'Tescil Tarihi (I)',
  brand_model: 'Markası / Ticari Adı (D.1, D.3)',
  model_type: 'Tipi (D.2)',
  year: 'Model Yılı (D.4)',
  vehicle_class: 'Araç Sınıfı (J)',
  vehicle_type: 'Cinsi (D.5)',
  color: 'Rengi (R)',
  engine_number: 'Motor No (P.5)',
  chassis_number: 'Şase No (E)',
  net_weight: 'Net Ağırlığı kg (G.1)',
  max_laden_weight: 'Azami Yüklü Ağırlığı kg (F.1)',
  train_weight: 'Katar Ağırlığı kg (G)',
  trailer_max_weight: 'Römork Azami Yüklü Ağırlığı kg (G.2)',
  seat_count: 'Koltuk Sayısı, Sür. Dahil (S.1)',
  standing_capacity: 'Ayakta Yolcu Sayısı (S.2)',
  engine_capacity: 'Silindir Hacmi cm³ (P.1)',
  engine_power: 'Motor Gücü kW (P.2)',
  fuel_type: 'Yakıt Cinsi (P.3)',
  power_weight_ratio: 'Güç Ağırlık Oranı kW/kg (Q)',
  usage_purpose: 'Kullanım Amacı (Y.3)',
  type_approval_no: 'Tip Onay No (K)',
  owner_tax_id: 'T.C. Kimlik No / Vergi No (Y.4)',
  owner_name: 'Adı Soyadı / Ticari Ünvanı (C.1.2, C.1.1)',
  owner_address: 'Adresi (C.1.3)',
  rights_holders: 'Araç Üzerinde Hak ve Menfaati Bulunanlar (Z.1)',
  notary_sale_date: 'Noter Satış Tarihi (Z.3.1)',
  notary_sale_no: 'Noter Satış No (Z.3.2)',
  notary_name: 'Noterin Adı (Z.3.3)',
  other_info: 'Diğer Bilgiler (Z.2)',
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
