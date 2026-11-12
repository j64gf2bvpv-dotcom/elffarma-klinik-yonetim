/**
 * Standart özlük dosyası evrakları (iş hukuku / SGK uygulamasında genelde istenenler).
 * `expires`: süreli belge — geçerlilik tarihi sorulur, süresi geçince kırmızı görünür.
 */
export interface PersonnelDocType {
  key: string
  label: string
  expires?: boolean
}

export const PERSONNEL_DOC_TYPES: PersonnelDocType[] = [
  { key: 'nufus_cuzdani', label: 'Nüfus Cüzdanı / Kimlik Fotokopisi' },
  { key: 'vesikalik', label: 'Vesikalık Fotoğraf' },
  { key: 'ikametgah', label: 'İkametgâh (Yerleşim Yeri) Belgesi' },
  { key: 'adli_sicil', label: 'Adli Sicil Kaydı', expires: true },
  { key: 'nufus_kayit', label: 'Nüfus Kayıt Örneği' },
  { key: 'diploma', label: 'Diploma / Mezuniyet Belgesi' },
  { key: 'saglik_raporu', label: 'Sağlık Raporu', expires: true },
  { key: 'is_sozlesmesi', label: 'İş Sözleşmesi' },
  { key: 'sgk_giris', label: 'SGK İşe Giriş Bildirgesi' },
  { key: 'askerlik', label: 'Askerlik Durum Belgesi' },
  { key: 'ehliyet', label: 'Ehliyet Fotokopisi', expires: true },
  { key: 'aile_durum', label: 'Aile Durum Bildirimi' },
  { key: 'banka', label: 'Banka Hesap (IBAN) Bilgisi' },
  { key: 'kvkk', label: 'KVKK Aydınlatma ve Açık Rıza Metni' },
  { key: 'isg_egitim', label: 'İş Sağlığı ve Güvenliği Eğitim Belgesi', expires: true },
  { key: 'cv', label: 'Özgeçmiş (CV)' },
]

export const DOC_TYPE_BY_KEY = new Map(PERSONNEL_DOC_TYPES.map((d) => [d.key, d]))

export function docTypeLabel(key: string, title?: string | null): string {
  if (key === 'diger') return title?.trim() || 'Diğer Evrak'
  return DOC_TYPE_BY_KEY.get(key)?.label ?? key
}
